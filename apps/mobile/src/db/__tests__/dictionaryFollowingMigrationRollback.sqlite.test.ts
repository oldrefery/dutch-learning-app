import { execFileSync, fork, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { calculateSRSProgress } from '@woordenaar/domain'
import {
  SQLITE_REHEARSAL_SCHEMA,
  applySqliteMigration,
  rollbackSqliteMigration,
  sqliteMigrationFingerprint,
} from '../../../../../scripts/shared-dictionary/following-rollback.sqlite'
import { createTestDatabase } from './sqlite.fixture'
import { getDatabase } from '../initDB'
import { dictionaryFollowingRepository as following } from '../dictionaryFollowingRepository'
import { reviewEventRepository } from '../reviewEventRepository'
import { reviewCorrectionRepository } from '../reviewCorrectionRepository'
import { wordRepository } from '../wordRepository'
import type { ReviewEventDraft } from '@/types/ReviewTypes'
import {
  AT,
  OWNER_A,
  OWNER_B,
  WORD_A,
  followingBatch,
  followingContent,
} from './dictionaryFollowing.fixture'

jest.mock('../initDB')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryFollowingEnabled: () => true,
  isDictionaryContentEnabled: () => true,
}))
jest.setTimeout(20000)
const ROOT = resolve(__dirname, '../../../../..')
const BUNDLE = mkdtempSync(join(tmpdir(), 'following-rollback-engine-'))
const ENGINE = join(
  BUNDLE,
  'scripts/shared-dictionary/following-rollback.sqlite.js'
)
const WORKER = join(
  ROOT,
  'scripts/shared-dictionary/following-rollback-worker.fixture.mjs'
)
const CACHE_QUERY =
  'SELECT * FROM dictionary_effective_card_cache ORDER BY word_id'
const APPLY_QUERY = 'SELECT * FROM following_migration_apply ORDER BY word_id'
const UNDO_QUERY = 'SELECT * FROM following_migration_rollback ORDER BY word_id'
const WORD_QUERY = 'SELECT * FROM words WHERE word_id=?'
const LOCKED = /locked/
const FAILURE = 'synthetic interruption'
const DELETE_WORDS = 'DELETE FROM words'
const guard = () => {}

describe('receipt-owned following compensation on file-backed native SQLite', () => {
  let db: DatabaseSync, directory: string, path: string, run: string
  beforeAll(() => {
    execFileSync(
      process.execPath,
      [
        join(
          ROOT,
          'scripts/shared-dictionary/following-rollback-bundle.fixture.mjs'
        ),
        BUNDLE,
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 15000 }
    )
    expect(existsSync(ENGINE)).toBe(true)
  })
  afterAll(() => {
    rmSync(BUNDLE, { recursive: true, force: true })
  })
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'following-migration-rollback-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=100;')
    db.exec(SQLITE_REHEARSAL_SCHEMA)
    run = randomUUID()
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const reopen = () => {
    db.close()
    db = createTestDatabase(path, false)
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=100;')
  }
  const rows = (sql: string) => db.prepare(sql).all()
  const invariantTables = () => {
    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'following_migration_%' AND name!='dictionary_effective_card_cache' ORDER BY name"
      )
      .all()
    return Object.fromEntries(
      names.map(row => [
        String(row.name),
        rows(`SELECT * FROM "${String(row.name).replaceAll('"', '""')}"`),
      ])
    )
  }
  const prepare = async (ids = [WORD_A]) => {
    for (const id of ids)
      db.prepare(
        `INSERT INTO words(word_id,user_id,dutch_lemma,translations,image_url,
      next_review_date,created_at,updated_at,interval_days,repetition_count,easiness_factor)
      VALUES(?,?,?,'{"en":["private house"]}','https://example.invalid/private','2026-10-12',?,?,7,8,2.35)`
      ).run(id, OWNER_A, id, AT, AT)
    const request = await following.prepareHydration(OWNER_A, ids)
    await following.commitHydration(
      request,
      [
        {
          protocol_version: 2,
          watermark: '0',
          cards: ids.map(word_id => ({
            word_id,
            mode: 'legacy',
            content_version: '0',
            reference: null,
            adopted_revision_id: null,
            head_sequence: null,
            legacy_content: {
              ...followingContent,
              image_url: 'https://example.invalid/private',
              translations: { en: ['private house'], ru: [] },
            },
            removed_fields: [],
            cefr: { level: null, status: 'unknown', confidence: null },
          })),
          revisions: [],
        },
      ],
      guard
    )
  }
  const apply = async (ids = [WORD_A], version = '9007199254740992') => {
    const expected = new Map<string, string>()
    for (const id of ids)
      expected.set(
        id,
        await sqliteMigrationFingerprint(await getDatabase(), OWNER_A, id)
      )
    const batch = followingBatch('9007199254740993', undefined, ids)
    batch.cards.forEach(card => {
      card.content_version = version
    })
    const batchId = randomUUID()
    await applySqliteMigration(
      await getDatabase(),
      run,
      batchId,
      OWNER_A,
      expected,
      batch
    )
    return { batchId, expected, batch }
  }
  const undo = async (batchId = randomUUID(), limit = 50, owner = OWNER_A) =>
    rollbackSqliteMigration(await getDatabase(), run, batchId, owner, limit)
  const assess = async (eventId = randomUUID()) => {
    const word = db.prepare(WORD_QUERY).get(WORD_A)!
    const progress = calculateSRSProgress(
      {
        intervalDays: Number(word.interval_days),
        repetitionCount: Number(word.repetition_count),
        easinessFactor: Number(word.easiness_factor),
      },
      'good'
    )
    const event: ReviewEventDraft = {
      event_id: eventId,
      user_id: OWNER_A,
      word_id: WORD_A,
      assessment: 'good',
      review_mode: 'meaning-recall',
      answered_correctly: true,
      response_time_ms: 750,
      previous_interval_days: Number(word.interval_days),
      next_interval_days: progress.intervalDays,
      previous_easiness_factor: Number(word.easiness_factor),
      next_easiness_factor: progress.easinessFactor,
      reviewed_at: AT,
      review_date: '2026-10-10',
    }
    const input = {
      event,
      progress: {
        interval_days: progress.intervalDays,
        repetition_count: progress.repetitionCount,
        easiness_factor: progress.easinessFactor,
        next_review_date: '2026-11-10',
      },
      idempotent: true,
    }
    await reviewEventRepository.recordAssessment(input)
    return input
  }
  it('commits apply, new review/reset/correction and preserves every learning/queue/retry value through rollback and restart', async () => {
    await prepare()
    const original = (await following.getCachedCards(OWNER_A, [WORD_A])).get(
      WORD_A
    )!.card
    const request = await apply(),
      originals = rows(APPLY_QUERY)
    const first = await assess()
    await wordRepository.resetWordProgress(WORD_A, OWNER_A)
    const second = await assess()
    await reviewCorrectionRepository.enqueue({
      correction_id: randomUUID(),
      event_id: second.event.event_id,
      word_id: WORD_A,
      user_id: OWNER_A,
      expected_revision: 0,
      assessment: 'again',
    })
    const correction = await reviewCorrectionRepository.getNext(OWNER_A)
    await reviewCorrectionRepository.markConflict(
      OWNER_A,
      correction!.correction_id,
      'Synthetic retry metadata'
    )
    db.prepare(
      'UPDATE review_events SET last_sync_attempt_at=?,synced_at=NULL WHERE event_id=?'
    ).run(AT, first.event.event_id)
    const invariants = invariantTables()
    reopen()
    expect(await undo()).toEqual({ restored: 1, skipped: 0, remaining: 0 })
    expect(invariantTables()).toEqual(invariants)
    expect(rows(APPLY_QUERY)).toEqual(originals)
    expect(
      (await following.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)!.card
    ).toEqual({ ...original, content_version: '9007199254740993' })
    await reviewEventRepository.recordAssessment(first)
    expect(invariantTables()).toEqual(invariants)
    await applySqliteMigration(
      await getDatabase(),
      run,
      request.batchId,
      OWNER_A,
      request.expected,
      request.batch
    )
    expect(
      (await following.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)!.card.mode
    ).toBe('legacy')
    const receipt = rows(UNDO_QUERY)
    reopen()
    expect(rows(UNDO_QUERY)).toEqual(receipt)
    expect(invariantTables()).toEqual(invariants)
  })
  it.each([
    'raw-media',
    'placement',
    'private-state',
    'version',
    'reference',
    'head',
    'revision',
    'owner',
    'tombstone',
    'delete',
  ])(
    'holds later %s without overwriting or resurrecting any personal state',
    async kind => {
      await prepare()
      await apply()
      const originals = rows(APPLY_QUERY)
      const changes: Record<string, string> = {
        'raw-media':
          "UPDATE words SET image_url='https://example.invalid/later'",
        placement: "UPDATE words SET collection_id='later-collection'",
        'private-state': `INSERT INTO dictionary_card_content(word_id,user_id,content_version,fallback_content_json,overrides_json,updated_at)
          VALUES('${WORD_A}','${OWNER_A}',1,'${JSON.stringify(followingContent)}','{}','${AT}')`,
        version:
          "UPDATE dictionary_effective_card_cache SET content_version='9007199254740994'",
        reference:
          "UPDATE dictionary_effective_card_cache SET mode='legacy',head_sequence=NULL",
        head: "UPDATE dictionary_following_heads SET head_sequence='9007199254740994'",
        revision:
          "UPDATE dictionary_revision_cache SET content_json=json_set(content_json,'$.image_url','https://example.invalid/new')",
        owner: `UPDATE words SET user_id='${OWNER_B}'`,
        tombstone: `UPDATE words SET deleted_at='${AT}'`,
        delete: DELETE_WORDS,
      }
      db.exec(changes[kind])
      const before = invariantTables(),
        cache = rows(CACHE_QUERY)
      reopen()
      expect(await undo()).toEqual({ restored: 0, skipped: 1, remaining: 0 })
      expect(invariantTables()).toEqual(before)
      expect(rows(CACHE_QUERY)).toEqual(cache)
      expect(rows(APPLY_QUERY)).toEqual(originals)
      expect((await undo()).skipped).toBe(0)
    }
  )
  it('preserves a new pending content intent and holds the row for reconciliation', async () => {
    await prepare()
    await apply()
    db.exec(`INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,expected_content_version,payload_json,queued_at,last_error)
      VALUES('pending-content','${OWNER_A}','${WORD_A}','edit-private',0,'{}','${AT}','Synthetic pending retry');`)
    const before = invariantTables()
    expect((await undo()).skipped).toBe(1)
    expect(invariantTables()).toEqual(before)
  })
  it('rejects stale or unreconciled apply without partial receipts or cache changes', async () => {
    await prepare()
    const before = rows(CACHE_QUERY)
    db.exec(`INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,expected_content_version,payload_json,queued_at)
      VALUES('pending-original','${OWNER_A}','${WORD_A}','edit-private',0,'{}','${AT}');`)
    await expect(apply()).rejects.toThrow('unreconciled')
    expect(rows(CACHE_QUERY)).toEqual(before)
    expect(rows(APPLY_QUERY)).toEqual([])
  })
  it.each([
    'following_migration_rollback',
    'following_migration_rollback_batches',
  ])(
    'receipt failure in %s rolls back all changes and identical intent resumes after restart',
    async table => {
      const ids = [WORD_A, randomUUID(), randomUUID()]
      await prepare(ids)
      await apply(ids)
      const before = invariantTables(),
        cache = rows(CACHE_QUERY),
        batch = randomUUID()
      db.exec(
        `CREATE TRIGGER fault BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'${FAILURE}'); END;`
      )
      await expect(undo(batch)).rejects.toThrow(FAILURE)
      expect(rows(CACHE_QUERY)).toEqual(cache)
      expect(rows(UNDO_QUERY)).toEqual([])
      db.exec('DROP TRIGGER fault')
      reopen()
      expect((await undo(batch)).restored).toBe(3)
      expect(invariantTables()).toEqual(before)
    }
  )
  const startWorker = () => {
    const batch = randomUUID(),
      child = fork(WORKER, [ENGINE, path, run, batch, OWNER_A], {
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      })
    let stderr = ''
    child.stderr?.on('data', chunk => {
      stderr += String(chunk)
    })
    const exited = new Promise<{
      code: number | null
      signal: NodeJS.Signals | null
    }>(resolveExit =>
      child.once('exit', (code, signal) => resolveExit({ code, signal }))
    )
    const barrier = new Promise<void>((resolveBarrier, reject) => {
      child.on('message', message => {
        if (
          typeof message === 'object' &&
          message !== null &&
          'provisionalReceipts' in message
        )
          resolveBarrier()
      })
      child.once('error', reject)
      child.once('exit', code => {
        if (code !== null) reject(new Error(stderr))
      })
    })
    return { batch, child, barrier, exited }
  }
  const stopWorker = async (child: ChildProcess, exited: Promise<unknown>) => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL')
    await exited
  }
  it('kills only its owned process after two provisional restorations; file restart retains apply and later learning then identical batch resumes', async () => {
    const ids = [WORD_A, randomUUID(), randomUUID()]
    await prepare(ids)
    await apply(ids)
    await assess()
    const cache = rows(CACHE_QUERY),
      before = invariantTables(),
      originals = rows(APPLY_QUERY),
      worker = startWorker()
    try {
      await worker.barrier
      expect(rows(UNDO_QUERY)).toEqual([])
      expect(rows(CACHE_QUERY)).toEqual(cache)
      await expect(undo()).rejects.toThrow(LOCKED)
      worker.child.kill('SIGKILL')
      expect((await worker.exited).signal).toBe('SIGKILL')
      reopen()
      expect(rows(CACHE_QUERY)).toEqual(cache)
      expect(rows(UNDO_QUERY)).toEqual([])
      expect((await undo(worker.batch, 2)).restored).toBe(2)
      expect((await undo()).restored).toBe(1)
      expect(invariantTables()).toEqual(before)
      expect(rows(APPLY_QUERY)).toEqual(originals)
    } finally {
      await stopWorker(worker.child, worker.exited)
    }
  })
  it('competing SQLite workers serialize writes and retry the same committed batch without another version change', async () => {
    const ids = [WORD_A, randomUUID(), randomUUID()]
    await prepare(ids)
    await apply(ids)
    const worker = startWorker()
    try {
      await worker.barrier
      await expect(undo()).rejects.toThrow(LOCKED)
      worker.child.send('commit')
      expect((await worker.exited).code).toBe(0)
      const cache = rows(CACHE_QUERY)
      expect(await undo(worker.batch, 2)).toEqual({
        restored: 2,
        skipped: 0,
        remaining: 1,
      })
      expect(rows(CACHE_QUERY)).toEqual(cache)
      expect((await undo()).restored).toBe(1)
      expect(rows(UNDO_QUERY)).toHaveLength(3)
    } finally {
      await stopWorker(worker.child, worker.exited)
    }
  })
  it.each(['tombstone', 'delete'])(
    'another connection commits %s after a busy rollback; retry skips deletion and retains protected receipts',
    async kind => {
      await prepare()
      await apply()
      const originals = rows(APPLY_QUERY),
        other = new DatabaseSync(path)
      try {
        other.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;')
        other.exec(
          kind === 'delete'
            ? DELETE_WORDS
            : `UPDATE words SET deleted_at='${AT}'`
        )
        await expect(undo()).rejects.toThrow(LOCKED)
        expect(rows(UNDO_QUERY)).toEqual([])
        other.exec('COMMIT')
        const before = invariantTables()
        reopen()
        expect((await undo()).skipped).toBe(1)
        expect(invariantTables()).toEqual(before)
        expect(rows(APPLY_QUERY)).toEqual(originals)
      } finally {
        other.close()
      }
    }
  )
  it('bounds compensation50/100, rejects invalid owners/intents and preserves immutable receipts after deletion', async () => {
    const ids = Array.from({ length: 110 }, () => randomUUID())
    await prepare(ids)
    await apply(ids.slice(0, 100))
    await apply(ids.slice(100))
    const batch = randomUUID()
    expect(await undo(batch)).toEqual({
      restored: 50,
      skipped: 0,
      remaining: 60,
    })
    expect(await undo(randomUUID(), 100)).toEqual({
      restored: 60,
      skipped: 0,
      remaining: 0,
    })
    await expect(undo(batch, 49)).rejects.toThrow('intent conflict')
    await expect(undo(randomUUID(), 50, OWNER_B)).rejects.toThrow('unavailable')
    for (const limit of [0, 101, 1.5])
      await expect(undo(randomUUID(), limit)).rejects.toThrow('Invalid')
    for (const table of [
      'following_migration_apply',
      'following_migration_apply_batches',
      'following_migration_rollback',
      'following_migration_rollback_batches',
    ]) {
      expect(() =>
        db.exec(
          `UPDATE ${table} SET ${table.endsWith('batches') ? 'batch_id=batch_id' : 'word_id=word_id'}`
        )
      ).toThrow('Immutable')
      expect(() => db.exec(`DELETE FROM ${table}`)).toThrow('Immutable')
    }
    const receipt = rows(UNDO_QUERY)
    db.exec(DELETE_WORDS)
    reopen()
    expect(await undo(batch)).toEqual({
      restored: 50,
      skipped: 0,
      remaining: 60,
    })
    expect(rows(UNDO_QUERY)).toEqual(receipt)
    expect(rows('SELECT * FROM words')).toEqual([])
  })
  it('holds maximum BIGINT without overwriting or wrapping the exact decimal cache version', async () => {
    await prepare()
    await apply([WORD_A], '9223372036854775807')
    const cache = rows(CACHE_QUERY)
    expect((await undo()).skipped).toBe(1)
    expect(rows(UNDO_QUERY)[0].outcome).toBe('content-version-exhausted')
    expect(rows(CACHE_QUERY)).toEqual(cache)
  })
})
