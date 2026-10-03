import { randomUUID } from 'node:crypto'
import { closeSync, lstatSync, mkdirSync, openSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import type { DiagnosticBundle } from './diagnostic-bundle.ts'
import type { Captured } from './diagnostic-types.ts'
import {
  isPreparedExecution,
  bindExecutionJournal,
  type DiagnosticExecution,
} from './diagnostic-execution.ts'

const { DatabaseSync: SqliteDatabaseSync } = createRequire(import.meta.url)(
  'node:sqlite'
) as typeof import('node:sqlite')
export type SqliteDatabase = InstanceType<typeof SqliteDatabaseSync>
const fail = (code: string): never => {
  throw new Error(`Invalid diagnostic run: ${code}`)
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (
  item_id TEXT NOT NULL, attempt INTEGER NOT NULL,
  reserved_microusd INTEGER NOT NULL, reserved_tokens INTEGER NOT NULL,
  reserved_at_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(item_id, attempt)
);
CREATE TABLE IF NOT EXISTS captures (
  item_id TEXT NOT NULL, attempt INTEGER NOT NULL, body TEXT NOT NULL,
  response_id TEXT UNIQUE, model_version TEXT,
  PRIMARY KEY(item_id, attempt),
  FOREIGN KEY(item_id, attempt) REFERENCES attempts(item_id, attempt)
);
CREATE TABLE IF NOT EXISTS controls (
  control_id TEXT PRIMARY KEY, kind TEXT NOT NULL,
  request_sha256 TEXT NOT NULL, receipt TEXT,
  reserved_microusd INTEGER NOT NULL DEFAULT 0,
  reserved_tokens INTEGER NOT NULL DEFAULT 0
);`
const transaction = <T>(db: SqliteDatabase, work: () => T): T => {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
const prepareJournalFile = (runDir: string): string => {
  try {
    mkdirSync(runDir, { mode: 0o700 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  const stat = lstatSync(runDir)
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0)
    return fail('run_directory_permissions')
  const path = join(runDir, 'diagnostic.sqlite')
  try {
    const fd = openSync(path, 'wx', 0o600)
    closeSync(fd)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  const dbStat = lstatSync(path)
  if (!dbStat.isFile() || (dbStat.mode & 0o077) !== 0)
    return fail('database_permissions')
  return path
}
export const openRun = (
  runDir: string,
  bundle: DiagnosticBundle,
  now: Date,
  execution?: DiagnosticExecution
): SqliteDatabase => {
  if (
    execution &&
    (!isPreparedExecution(execution) ||
      execution.bundleSha256 !== bundle.bindingSha256 ||
      execution.runDir !== resolve(runDir) ||
      execution.utcDay !== now.toISOString().slice(0, 10))
  )
    return fail('unprepared_execution')
  const path = prepareJournalFile(runDir)
  const journalClaim = execution ? bindExecutionJournal(execution) : null
  const db = new SqliteDatabaseSync(path, { timeout: 0 })
  try {
    db.exec(
      'PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;'
    )
    db.exec(SCHEMA)
    const attemptColumns = db.prepare('PRAGMA table_info(attempts)').all() as {
      name: string
    }[]
    if (!attemptColumns.some(column => column.name === 'reserved_at_ms'))
      db.exec(
        'ALTER TABLE attempts ADD COLUMN reserved_at_ms INTEGER NOT NULL DEFAULT 0'
      )
    const columns = db.prepare('PRAGMA table_info(controls)').all() as {
      name: string
    }[]
    for (const name of ['reserved_microusd', 'reserved_tokens'])
      if (!columns.some(column => column.name === name))
        db.exec(
          `ALTER TABLE controls ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`
        )
    transaction(db, () => {
      const rows = db.prepare('SELECT key,value FROM meta').all() as {
        key: string
        value: string
      }[]
      const meta = new Map(rows.map(row => [row.key, row.value]))
      const day = now.toISOString().slice(0, 10)
      if (meta.size === 0) {
        if (journalClaim && !journalClaim.created)
          return fail('journal_initialization_incomplete')
        const insert = db.prepare('INSERT INTO meta(key,value) VALUES (?,?)')
        for (const [key, value] of Object.entries({
          binding_sha256: bundle.bindingSha256,
          utc_day: day,
          run_id: execution?.runId ?? randomUUID(),
          transport_kind: execution?.origin ?? 'fake',
          active_owner: '',
          active_until: '0',
          ...(execution
            ? {
                execution_sha256: execution.sha256,
                implementation_sha256: execution.implementationSha256,
                count_cost: String(execution.countCost),
                metadata_cost: String(execution.metadataCost),
                cost_policy: execution.costPolicy,
                generation_attempts_per_meaning_max: String(
                  execution.maxAttempts
                ),
                generation_request_limit: String(
                  bundle.meanings.length * execution.maxAttempts
                ),
                account_ref: execution.accountRef,
                approval_ref: execution.approvalRef,
                control_billing_ref: execution.billingRef ?? '',
                journal_nonce: journalClaim?.nonce ?? fail('journal_binding'),
              }
            : {}),
        }))
          insert.run(key, value)
      } else if (
        meta.get('binding_sha256') !== bundle.bindingSha256 ||
        meta.get('utc_day') !== day ||
        meta.get('transport_kind') !== (execution?.origin ?? 'fake') ||
        meta.get('execution_sha256') !== execution?.sha256 ||
        (journalClaim && meta.get('journal_nonce') !== journalClaim.nonce) ||
        (execution && meta.get('run_id') !== execution.runId)
      ) {
        return fail('resume_binding_or_day')
      }
    })
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
const leaseMeta = (db: SqliteDatabase, key: string): string =>
  (
    db.prepare('SELECT value FROM meta WHERE key=?').get(key) as
      { value: string } | undefined
  )?.value ?? fail('missing_run_meta')
const assertLease = (db: SqliteDatabase, owner: string): void => {
  if (
    leaseMeta(db, 'active_owner') !== owner ||
    Number(leaseMeta(db, 'active_until')) <= Date.now()
  )
    fail('run_lease_lost')
}
export const claimLease = (db: SqliteDatabase, owner: string): void =>
  transaction(db, () => {
    if (
      leaseMeta(db, 'active_owner') &&
      Number(leaseMeta(db, 'active_until')) > Date.now()
    )
      fail('run_already_active')
    db.prepare("UPDATE meta SET value=? WHERE key='active_owner'").run(owner)
    db.prepare("UPDATE meta SET value=? WHERE key='active_until'").run(
      String(Date.now() + 10_000)
    )
  })
export const renewLease = (db: SqliteDatabase, owner: string): void =>
  transaction(db, () => {
    assertLease(db, owner)
    db.prepare("UPDATE meta SET value=? WHERE key='active_until'").run(
      String(Date.now() + 10_000)
    )
  })
export const releaseLease = (db: SqliteDatabase, owner: string): void =>
  transaction(db, () => {
    if (leaseMeta(db, 'active_owner') === owner) {
      db.prepare("UPDATE meta SET value='' WHERE key='active_owner'").run()
      db.prepare("UPDATE meta SET value='0' WHERE key='active_until'").run()
    }
  })
export const assertNotRejected = (db: SqliteDatabase): void => {
  const rejected = db
    .prepare(
      "SELECT 1 FROM meta WHERE key='rejection_reason' UNION ALL SELECT 1 FROM captures WHERE json_extract(body, '$.outcome')='failed' LIMIT 1"
    )
    .get()
  if (rejected) fail('provider_rejected')
}
export const countAttempts = (db: SqliteDatabase, id: string): number =>
  Number(
    (
      db
        .prepare('SELECT COUNT(*) AS total FROM attempts WHERE item_id=?')
        .get(id) as { total: number }
    ).total
  )
export const lastCapture = (
  db: SqliteDatabase,
  id: string
): Captured | null => {
  const row = db
    .prepare(
      'SELECT c.body FROM captures c WHERE c.item_id=? ORDER BY c.attempt DESC LIMIT 1'
    )
    .get(id) as { body: string } | undefined
  return row ? (JSON.parse(row.body) as Captured) : null
}
export const reserve = (
  db: SqliteDatabase,
  bundle: DiagnosticBundle,
  id: string,
  owner: string,
  nowMs = Date.now()
): number | null =>
  transaction(db, () => {
    assertLease(db, owner)
    const prior = countAttempts(db, id)
    const attemptLimit = Number(
      (
        db
          .prepare(
            "SELECT value FROM meta WHERE key='generation_attempts_per_meaning_max'"
          )
          .get() as { value: string } | undefined
      )?.value ?? bundle.maxAttempts
    )
    if (prior >= attemptLimit) return null
    const latest = lastCapture(db, id)
    if (latest && latest.outcome !== 'retry') return null
    const totals = db
      .prepare(
        'SELECT COUNT(*) AS requests, COALESCE(SUM(reserved_microusd),0) AS cost FROM attempts'
      )
      .get() as { requests: number; cost: number }
    const controlCost = Number(
      (
        db
          .prepare(
            'SELECT COALESCE(SUM(reserved_microusd),0) AS total FROM controls'
          )
          .get() as { total: number }
      ).total
    )
    if (
      totals.requests >=
        Number(
          (
            db
              .prepare(
                "SELECT value FROM meta WHERE key='generation_request_limit'"
              )
              .get() as { value: string } | undefined
          )?.value ?? bundle.maxRequests
        ) ||
      totals.cost + controlCost + bundle.costPerAttempt > bundle.ceiling
    )
      return null
    const attempt = prior + 1
    db.prepare(
      'INSERT INTO attempts(item_id,attempt,reserved_microusd,reserved_tokens,reserved_at_ms) VALUES (?,?,?,?,?)'
    ).run(id, attempt, bundle.costPerAttempt, bundle.tokensPerAttempt, nowMs)
    return attempt
  })
export const retryNotBefore = (db: SqliteDatabase, id: string): number => {
  const row = db
    .prepare(
      'SELECT a.reserved_at_ms,c.body FROM attempts a LEFT JOIN captures c USING(item_id,attempt) WHERE a.item_id=? ORDER BY a.attempt DESC LIMIT 1'
    )
    .get(id) as { reserved_at_ms: number; body: string | null } | undefined
  if (!row) return 0
  return row.body === null
    ? row.reserved_at_ms + 1000
    : ((JSON.parse(row.body) as Captured).retry_not_before ?? 0)
}
export const capture = (
  db: SqliteDatabase,
  id: string,
  attempt: number,
  result: Captured,
  owner: string
): void => {
  const rejection = transaction(db, () => {
    assertLease(db, owner)
    const prior = db
      .prepare(
        'SELECT DISTINCT model_version FROM captures WHERE model_version IS NOT NULL'
      )
      .all() as { model_version: string }[]
    const duplicate =
      result.response_id &&
      db
        .prepare('SELECT 1 FROM captures WHERE response_id=?')
        .get(result.response_id)
    const reason = duplicate
      ? 'duplicate_response_identity'
      : result.model_version &&
          prior.some(row => row.model_version !== result.model_version)
        ? 'mixed_resolved_model_versions'
        : null
    if (reason) {
      db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)').run(
        'rejection_reason',
        reason
      )
      return reason
    }
    db.prepare(
      'INSERT INTO captures(item_id,attempt,body,response_id,model_version) VALUES (?,?,?,?,?)'
    ).run(
      id,
      attempt,
      JSON.stringify(result),
      result.response_id,
      result.model_version
    )
    return null
  })
  if (rejection) fail(rejection)
}

export interface ControlKey {
  id: string
  kind: 'count_tokens' | 'model_metadata'
  requestSha256: string
}
const assertControlDay = (db: SqliteDatabase, now: Date): void => {
  if (leaseMeta(db, 'utc_day') !== now.toISOString().slice(0, 10))
    fail('control_day_changed')
}
// Reservations record accounting only; the runner separately gates dispatch.
export const reserveControl = (
  db: SqliteDatabase,
  bundle: DiagnosticBundle,
  key: ControlKey,
  owner: string,
  now: Date
): string | null =>
  transaction(db, () => {
    assertLease(db, owner)
    assertControlDay(db, now)
    if (
      !/^[a-f0-9]{64}$/.test(key.requestSha256) ||
      (key.kind === 'model_metadata'
        ? key.id !== 'model_metadata'
        : key.kind !== 'count_tokens' ||
          !bundle.meanings.some(meaning => meaning.id === key.id))
    )
      fail('invalid_control_key')
    const row = db
      .prepare(
        'SELECT kind,request_sha256,receipt FROM controls WHERE control_id=?'
      )
      .get(key.id) as
      | { kind: string; request_sha256: string; receipt: string | null }
      | undefined
    if (row) {
      if (row.kind !== key.kind || row.request_sha256 !== key.requestSha256)
        fail('control_request_changed')
      if (row.receipt === null) fail('control_outcome_unknown')
      return row.receipt
    }
    const count = Number(
      (
        db
          .prepare('SELECT COUNT(*) AS total FROM controls WHERE kind=?')
          .get(key.kind) as { total: number }
      ).total
    )
    if (count >= (key.kind === 'model_metadata' ? 1 : bundle.meanings.length))
      fail('control_request_limit')
    const costKey = key.kind === 'count_tokens' ? 'count_cost' : 'metadata_cost'
    const cost = Number(
      (
        db.prepare('SELECT value FROM meta WHERE key=?').get(costKey) as
          { value: string } | undefined
      )?.value ?? 0
    )
    const total = Number(
      (
        db
          .prepare(
            'SELECT (SELECT COALESCE(SUM(reserved_microusd),0) FROM attempts) + (SELECT COALESCE(SUM(reserved_microusd),0) FROM controls) AS total'
          )
          .get() as { total: number }
      ).total
    )
    if (total + cost > bundle.ceiling) fail('combined_cost_bound')
    db.prepare(
      'INSERT INTO controls(control_id,kind,request_sha256,reserved_microusd,reserved_tokens) VALUES (?,?,?,?,?)'
    ).run(
      key.id,
      key.kind,
      key.requestSha256,
      cost,
      costKey === 'count_cost' && leaseMeta(db, 'transport_kind') !== 'fake'
        ? bundle.maxInputTokens
        : 0
    )
    return null
  })

export const captureControl = (
  db: SqliteDatabase,
  key: ControlKey,
  receipt: string,
  owner: string
): void =>
  transaction(db, () => {
    assertLease(db, owner)
    if (Buffer.byteLength(receipt, 'utf8') > 4096) fail('control_receipt_bound')
    const result = db
      .prepare(
        'UPDATE controls SET receipt=? WHERE control_id=? AND kind=? AND request_sha256=? AND receipt IS NULL'
      )
      .run(receipt, key.id, key.kind, key.requestSha256)
    if (result.changes !== 1) fail('control_capture_conflict')
  })
