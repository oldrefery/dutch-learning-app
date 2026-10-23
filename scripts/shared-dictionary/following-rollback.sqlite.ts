// Disposable D13A.6 operator rehearsal. Never imported by application startup.
import type { SQLiteDatabase } from 'expo-sqlite'
import { parseDictionaryEffectiveBatchV2 } from '@woordenaar/domain'
import {
  canonicalDictionaryJson as canonical,
  parseFollowingHydration,
  requireFollowingValue,
} from '../../apps/mobile/src/db/dictionaryFollowingHydration'

type Row = Record<string, unknown>
interface Snapshot {
  word: Row
  privateState: Row | null
  cache: Row
  head: Row | null
  revision: Row | null
}
interface Receipt {
  word_id: string
  original_json: string
  applied_json: string
}
interface Result {
  restored: number
  skipped: number
  remaining: number
}
const UNAVAILABLE = 'SQLite migration source unavailable'
const INTENT_CONFLICT = 'SQLite migration intent conflict'
const WORD_QUERY =
  'SELECT * FROM words WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL'
const PRIVATE_QUERY =
  'SELECT * FROM dictionary_card_content WHERE word_id = ? AND user_id = ?'
const CACHE_QUERY =
  'SELECT * FROM dictionary_effective_card_cache WHERE word_id = ? AND user_id = ?'
const HEAD_QUERY =
  'SELECT entry_id, revision_id, head_sequence FROM dictionary_following_heads WHERE entry_id = ? AND user_id = ?'
const PENDING_QUERY =
  'SELECT operation_id FROM dictionary_content_commands WHERE word_id = ? AND user_id = ? LIMIT 1'
const JOURNAL = 'following_migration_apply'
const UNDO = 'following_migration_rollback'

export const SQLITE_REHEARSAL_SCHEMA = `
  CREATE TABLE following_migration_apply_batches(batch_id TEXT PRIMARY KEY, request_json TEXT NOT NULL);
  CREATE TABLE ${JOURNAL}(run_id TEXT NOT NULL, word_id TEXT NOT NULL, user_id TEXT NOT NULL,
    original_json TEXT NOT NULL, applied_json TEXT NOT NULL, PRIMARY KEY(run_id,word_id));
  CREATE TABLE following_migration_rollback_batches(batch_id TEXT PRIMARY KEY, request_json TEXT NOT NULL, result_json TEXT NOT NULL);
  CREATE TABLE ${UNDO}(run_id TEXT NOT NULL, word_id TEXT NOT NULL, outcome TEXT NOT NULL,
    applied_json TEXT NOT NULL, result_json TEXT, PRIMARY KEY(run_id,word_id));
  ${[
    JOURNAL,
    UNDO,
    'following_migration_apply_batches',
    'following_migration_rollback_batches',
  ]
    .map(
      table => `
    CREATE TRIGGER ${table}_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable migration receipt'); END;
    CREATE TRIGGER ${table}_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable migration receipt'); END;
  `
    )
    .join('')}
`

const snapshot = async (
  db: SQLiteDatabase,
  userId: string,
  wordId: string
): Promise<Snapshot | null> => {
  const row = await db.getFirstAsync<Row>(WORD_QUERY, [wordId, userId])
  const cache = await db.getFirstAsync<Row>(CACHE_QUERY, [wordId, userId])
  if (!row || !cache) return null
  const word = { ...row }
  // Exclude only learning and sync metadata, never raw content/owner/placement.
  for (const field of [
    'interval_days',
    'repetition_count',
    'easiness_factor',
    'next_review_date',
    'last_reviewed_at',
    'updated_at',
    'sync_status',
    'last_sync_attempt_at',
    'synced_at',
  ])
    delete word[field]
  const card = { ...cache }
  delete card.cached_at
  delete card.watermark
  return {
    word,
    privateState: await db.getFirstAsync<Row>(PRIVATE_QUERY, [wordId, userId]),
    cache: card,
    head:
      typeof card.entry_id === 'string'
        ? await db.getFirstAsync<Row>(HEAD_QUERY, [card.entry_id, userId])
        : null,
    revision:
      typeof card.revision_id === 'string'
        ? await db.getFirstAsync<Row>(
            'SELECT revision_id,entry_id,revision_no,schema_version,content_json,content_sha256,cefr_input_sha256,review_status FROM dictionary_revision_cache WHERE revision_id = ?',
            [card.revision_id]
          )
        : null,
  }
}
export const sqliteMigrationFingerprint = async (
  db: SQLiteDatabase,
  userId: string,
  wordId: string
): Promise<string> => {
  const value = await snapshot(db, userId, wordId)
  if (!value) throw new Error(UNAVAILABLE)
  return canonical(value)
}

/** Inputs are synthetic validated server results, never linguistic approval.
 * Prepared legacy cache required; queues must be reconciled before transition. */
export async function applySqliteMigration(
  db: SQLiteDatabase,
  runId: string,
  batchId: string,
  userId: string,
  expected: ReadonlyMap<string, string>,
  value: unknown
): Promise<void> {
  const batch = requireFollowingValue(parseDictionaryEffectiveBatchV2(value))
  parseFollowingHydration([...expected.keys()], [batch])
  if (
    !runId ||
    !batchId ||
    !userId ||
    batch.cards.length < 1 ||
    batch.cards.length > 100 ||
    expected.size !== batch.cards.length
  )
    throw new Error('Invalid SQLite migration batch')
  const intent = canonical({
    runId,
    userId,
    expected: [...expected].sort(([a], [b]) => a.localeCompare(b)),
    batch,
  })
  await db.withExclusiveTransactionAsync(async tx => {
    const prior = await tx.getFirstAsync<{ request_json: string }>(
      'SELECT request_json FROM following_migration_apply_batches WHERE batch_id = ?',
      [batchId]
    )
    if (prior) {
      if (prior.request_json !== intent) throw new Error(INTENT_CONFLICT)
      return
    }
    for (const card of batch.cards) {
      const original = await snapshot(tx, userId, card.word_id)
      if (
        !original ||
        original.cache.mode !== 'legacy' ||
        card.mode !== 'follow' ||
        canonical(original) !== expected.get(card.word_id) ||
        BigInt(card.content_version) <=
          BigInt(String(original.cache.content_version)) ||
        (await tx.getFirstAsync(PENDING_QUERY, [card.word_id, userId])) ||
        (await tx.getFirstAsync(
          `SELECT 1 FROM ${JOURNAL} WHERE run_id = ? AND word_id = ?`,
          [runId, card.word_id]
        ))
      )
        throw new Error('SQLite migration source changed or unreconciled')
      const revision = batch.revisions.find(
        row => row.revision_id === card.reference?.revision_id
      )
      if (!revision || !card.reference)
        throw new Error('SQLite migration revision missing')
      const content = canonical(revision.content)
      await tx.runAsync(
        `INSERT OR IGNORE INTO dictionary_revision_cache(revision_id,entry_id,revision_no,schema_version,
        content_json,content_sha256,cefr_input_sha256,review_status,cached_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        revision.revision_id,
        revision.entry_id,
        revision.revision_no,
        revision.schema_version,
        content,
        revision.content_sha256,
        revision.cefr_input_sha256,
        revision.review_status,
        '2026-10-11T12:00:00Z'
      )
      const saved = await tx.getFirstAsync<Row>(
        'SELECT * FROM dictionary_revision_cache WHERE revision_id = ?',
        [revision.revision_id]
      )
      if (
        !saved ||
        saved.entry_id !== revision.entry_id ||
        saved.content_json !== content ||
        saved.content_sha256 !== revision.content_sha256 ||
        saved.cefr_input_sha256 !== revision.cefr_input_sha256 ||
        saved.revision_no !== revision.revision_no ||
        saved.schema_version !== revision.schema_version ||
        saved.review_status !== revision.review_status
      )
        throw new Error('SQLite migration revision conflict')
      const head = await tx.getFirstAsync<Row>(HEAD_QUERY, [
        card.reference.entry_id,
        userId,
      ])
      if (
        head &&
        (head.head_sequence !== card.head_sequence ||
          head.revision_id !== card.reference.revision_id)
      )
        throw new Error('SQLite migration head changed')
      await tx.runAsync(
        `INSERT INTO dictionary_following_heads(user_id,entry_id,revision_id,head_sequence,watermark,cached_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,entry_id) DO UPDATE SET revision_id=excluded.revision_id,
        head_sequence=excluded.head_sequence,watermark=excluded.watermark,cached_at=excluded.cached_at`,
        userId,
        card.reference.entry_id,
        card.reference.revision_id,
        card.head_sequence,
        batch.watermark,
        '2026-10-11T12:00:00Z'
      )
      await tx.runAsync(
        `UPDATE dictionary_effective_card_cache SET mode='follow',entry_id=?,revision_id=?,
        content_version=?,head_sequence=?,watermark=?,card_json=? WHERE word_id=? AND user_id=?`,
        card.reference.entry_id,
        card.reference.revision_id,
        card.content_version,
        card.head_sequence,
        batch.watermark,
        canonical(card),
        card.word_id,
        userId
      )
      await tx.runAsync(
        `INSERT INTO ${JOURNAL}(run_id,word_id,user_id,original_json,applied_json) VALUES(?,?,?,?,?)`,
        runId,
        card.word_id,
        userId,
        canonical(original),
        await sqliteMigrationFingerprint(tx, userId, card.word_id)
      )
    }
    await tx.runAsync(
      'INSERT INTO following_migration_apply_batches(batch_id,request_json) VALUES(?,?)',
      batchId,
      intent
    )
  })
}

async function compensateRow(
  tx: SQLiteDatabase,
  userId: string,
  receipt: Receipt
): Promise<{ outcome: string; final: string | null }> {
  const current = await snapshot(tx, userId, receipt.word_id)
  let outcome = current ? 'stale-result' : 'source-unavailable'
  let final: string | null = null
  if (
    current &&
    canonical(current) === receipt.applied_json &&
    !(await tx.getFirstAsync(PENDING_QUERY, [receipt.word_id, userId]))
  ) {
    const version = BigInt(String(current.cache.content_version))
    if (version === BigInt('9223372036854775807'))
      outcome = 'content-version-exhausted'
    else {
      const original = JSON.parse(receipt.original_json) as Snapshot
      const card = JSON.parse(String(original.cache.card_json)) as Row
      card.content_version = String(version + BigInt(1))
      await tx.runAsync(
        `UPDATE dictionary_effective_card_cache SET mode=?,entry_id=?,revision_id=?,content_version=?,
      head_sequence=?,card_json=? WHERE word_id=? AND user_id=?`,
        String(card.mode),
        original.cache.entry_id as string | null,
        original.cache.revision_id as string | null,
        String(card.content_version),
        original.cache.head_sequence as string | null,
        canonical(card),
        receipt.word_id,
        userId
      )
      final = await sqliteMigrationFingerprint(tx, userId, receipt.word_id)
      outcome = 'restored'
    }
  }
  return { outcome, final }
}

/** Compensate only this run's matching owned cache. Never restore words or queues. */
export async function rollbackSqliteMigration(
  db: SQLiteDatabase,
  runId: string,
  batchId: string,
  userId: string,
  limit = 50
): Promise<Result> {
  if (
    !runId ||
    !batchId ||
    !userId ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new Error('Invalid SQLite rollback batch')
  const intent = canonical({ runId, userId, limit })
  let result: Result = { restored: 0, skipped: 0, remaining: 0 }
  await db.withExclusiveTransactionAsync(async tx => {
    const prior = await tx.getFirstAsync<{
      request_json: string
      result_json: string
    }>('SELECT * FROM following_migration_rollback_batches WHERE batch_id=?', [
      batchId,
    ])
    if (prior) {
      if (prior.request_json !== intent) throw new Error(INTENT_CONFLICT)
      result = JSON.parse(prior.result_json) as Result
      return
    }
    if (
      !(await tx.getFirstAsync(
        `SELECT 1 FROM ${JOURNAL} WHERE run_id=? AND user_id=? LIMIT 1`,
        [runId, userId]
      ))
    )
      throw new Error('SQLite migration run unavailable')
    const rows = await tx.getAllAsync<Receipt>(
      `SELECT a.* FROM ${JOURNAL} a WHERE run_id=? AND user_id=?
      AND NOT EXISTS(SELECT 1 FROM ${UNDO} u WHERE u.run_id=a.run_id AND u.word_id=a.word_id) ORDER BY word_id LIMIT ?`,
      [runId, userId, limit]
    )
    for (const receipt of rows) {
      const { outcome, final } = await compensateRow(tx, userId, receipt)
      await tx.runAsync(
        `INSERT INTO ${UNDO}(run_id,word_id,outcome,applied_json,result_json) VALUES(?,?,?,?,?)`,
        runId,
        receipt.word_id,
        outcome,
        receipt.applied_json,
        final
      )
      if (outcome === 'restored') result.restored++
      else result.skipped++
    }
    result.remaining =
      (
        await tx.getFirstAsync<{ n: number }>(
          `SELECT count(*) n FROM ${JOURNAL} a WHERE run_id=? AND user_id=?
      AND NOT EXISTS(SELECT 1 FROM ${UNDO} u WHERE u.run_id=a.run_id AND u.word_id=a.word_id)`,
          [runId, userId]
        )
      )?.n ?? 0
    await tx.runAsync(
      'INSERT INTO following_migration_rollback_batches(batch_id,request_json,result_json) VALUES(?,?,?)',
      batchId,
      intent,
      canonical(result)
    )
  })
  return result
}
