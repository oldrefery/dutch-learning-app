import { randomUUID } from 'node:crypto'
import { closeSync, lstatSync, mkdirSync, openSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { DiagnosticBundle } from './diagnostic-bundle.ts'
import type { Captured } from './diagnostic-types.ts'

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
  PRIMARY KEY(item_id, attempt)
);
CREATE TABLE IF NOT EXISTS captures (
  item_id TEXT NOT NULL, attempt INTEGER NOT NULL, body TEXT NOT NULL,
  response_id TEXT UNIQUE, model_version TEXT,
  PRIMARY KEY(item_id, attempt),
  FOREIGN KEY(item_id, attempt) REFERENCES attempts(item_id, attempt)
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
export const openRun = (
  runDir: string,
  bundle: DiagnosticBundle,
  now: Date
): SqliteDatabase => {
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
  const db = new SqliteDatabaseSync(path, { timeout: 0 })
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;'
  )
  db.exec(SCHEMA)
  transaction(db, () => {
    const rows = db.prepare('SELECT key,value FROM meta').all() as {
      key: string
      value: string
    }[]
    const meta = new Map(rows.map(row => [row.key, row.value]))
    const day = now.toISOString().slice(0, 10)
    if (meta.size === 0) {
      const insert = db.prepare('INSERT INTO meta(key,value) VALUES (?,?)')
      for (const [key, value] of Object.entries({
        binding_sha256: bundle.bindingSha256,
        utc_day: day,
        run_id: randomUUID(),
        transport_kind: 'fake',
        active_owner: '',
        active_until: '0',
      }))
        insert.run(key, value)
    } else if (
      meta.get('binding_sha256') !== bundle.bindingSha256 ||
      meta.get('utc_day') !== day ||
      meta.get('transport_kind') !== 'fake'
    ) {
      return fail('resume_binding_or_day')
    }
  })
  return db
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
  owner: string
): number | null =>
  transaction(db, () => {
    assertLease(db, owner)
    const prior = countAttempts(db, id)
    if (prior >= bundle.maxAttempts) return null
    const latest = lastCapture(db, id)
    if (latest && latest.outcome !== 'retry') return null
    const totals = db
      .prepare(
        'SELECT COUNT(*) AS requests, COALESCE(SUM(reserved_microusd),0) AS cost FROM attempts'
      )
      .get() as { requests: number; cost: number }
    if (
      totals.requests >= bundle.maxRequests ||
      totals.cost + bundle.costPerAttempt > bundle.ceiling
    )
      return null
    const attempt = prior + 1
    db.prepare(
      'INSERT INTO attempts(item_id,attempt,reserved_microusd,reserved_tokens) VALUES (?,?,?,?)'
    ).run(id, attempt, bundle.costPerAttempt, bundle.tokensPerAttempt)
    return attempt
  })
export const capture = (
  db: SqliteDatabase,
  id: string,
  attempt: number,
  result: Captured,
  owner: string
): void => {
  transaction(db, () => {
    assertLease(db, owner)
    const prior = db
      .prepare(
        'SELECT DISTINCT model_version FROM captures WHERE model_version IS NOT NULL'
      )
      .all() as { model_version: string }[]
    if (
      result.model_version &&
      prior.some(row => row.model_version !== result.model_version)
    )
      return fail('mixed_resolved_model_versions')
    db.prepare(
      'INSERT INTO captures(item_id,attempt,body,response_id,model_version) VALUES (?,?,?,?,?)'
    ).run(
      id,
      attempt,
      JSON.stringify(result),
      result.response_id,
      result.model_version
    )
  })
}
