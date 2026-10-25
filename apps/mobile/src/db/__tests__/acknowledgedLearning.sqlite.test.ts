import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDatabase } from './sqlite.fixture'
import { wordRepository } from '../wordRepository'
import { reviewEventRepository } from '../reviewEventRepository'
import { syncStatusService } from '@/services/syncStatusService'

jest.mock('../initDB')
jest.mock('@/lib/sentry')
jest.mock('@/utils/network', () => ({
  getLastSyncTimestamp: jest.fn().mockResolvedValue(null),
  isNetworkAvailable: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
  isDictionaryFollowingEnabled: () => false,
}))

const reviewedAt = '2026-10-25T19:25:55.462Z'
const receivedAt = '2026-10-25T19:26:30.627972+00:00'
const allWordsSql = 'SELECT * FROM words'
const otherOwner = 'another-owner'

describe('acknowledged offline learning against real SQLite', () => {
  let database: DatabaseSync
  let directory: string
  let path: string

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'learning-ack-'))
    path = join(directory, 'learning.db')
    database = createTestDatabase(path)
    database.exec(`INSERT INTO words
      (word_id, user_id, dutch_lemma, translations, next_review_date,
       created_at, updated_at, sync_status)
      VALUES ('word', 'owner', 'huis', '{"en":["house"],"ru":["дом"]}',
        '2026-10-25', '2026-10-01', '2026-10-01', 'synced')`)
    await reviewEventRepository.recordAssessment({
      progress: {
        interval_days: 1,
        repetition_count: 1,
        easiness_factor: 2.5,
        next_review_date: '2026-10-26',
      },
      event: {
        event_id: 'event',
        word_id: 'word',
        user_id: 'owner',
        assessment: 'good',
        review_mode: 'meaning-recall',
        answered_correctly: null,
        response_time_ms: 500,
        previous_interval_days: 1,
        next_interval_days: 1,
        previous_easiness_factor: 2.5,
        next_easiness_factor: 2.5,
        reviewed_at: reviewedAt,
      },
    })
  })

  afterEach(() => {
    database.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const acknowledge = () =>
    reviewEventRepository.reconcilePushedEvents('owner', [
      { event_id: 'event', created_at: receivedAt },
    ])
  const canonical = async () => {
    const word = await wordRepository.getWordByIdAndUserId('word', 'owner')
    if (!word) throw new Error('Missing test word')
    return {
      ...word,
      updated_at: receivedAt,
      last_reviewed_at: '2026-10-25T19:25:55.462+00:00',
      tts_url: '',
      translations: { ru: ['дом'], en: ['house'] },
    }
  }

  it('repairs an acknowledged row after restart, preserving download debt and event identity', async () => {
    await acknowledge()
    const incoming = await canonical()
    database.close()
    database = createTestDatabase(path, false)
    expect(await syncStatusService.getSnapshot('owner')).toMatchObject({
      pendingUploads: 1,
      pendingDownloads: 1,
      lastSyncAt: null,
    })
    expect(
      await wordRepository.getAcknowledgedLearningWordIds('owner')
    ).toEqual(['word'])
    const events = database.prepare('SELECT * FROM review_events').all()
    await wordRepository.reconcileAcknowledgedLearning('owner', [incoming])
    await wordRepository.saveWords([incoming], { preserveUnsynced: true })
    await wordRepository.reconcileAcknowledgedLearning('owner', [incoming])
    expect(await syncStatusService.getSnapshot('owner')).toMatchObject({
      pendingUploads: 0,
      pendingDownloads: 1,
      lastSyncAt: null,
    })
    expect(database.prepare('SELECT * FROM review_events').all()).toEqual(
      events
    )
    expect(database.prepare('SELECT * FROM learning_commands').all()).toEqual(
      []
    )
    expect(
      await wordRepository.getAcknowledgedLearningWordIds('owner')
    ).toEqual([])
    expect(
      await wordRepository.getWordByIdAndUserId('word', 'owner')
    ).toMatchObject({
      sync_status: 'synced',
      repetition_count: 1,
      next_review_date: '2026-10-26',
    })
  })

  it.each([
    ['content', "UPDATE words SET dutch_lemma = 'edited locally'"],
    ['translation', `UPDATE words SET translations = '{"en":["local edit"]}'`],
    ['usage notes', `UPDATE words SET usage_notes = '["local note"]'`],
    ['media', "UPDATE words SET image_url = 'local-image'"],
    ['schedule', "UPDATE words SET next_review_date = '2026-10-30'"],
    ['newer edit timestamp', "UPDATE words SET updated_at = '2026-10-26'"],
    ['error', "UPDATE words SET sync_status = 'error'"],
    ['conflict', "UPDATE words SET sync_status = 'conflict'"],
    [
      'deletion',
      "UPDATE words SET deleted_at = '2026-10-26', sync_status = 'deleted'",
    ],
    [
      'reset',
      `INSERT INTO learning_commands(operation_id, kind, user_id, word_id, reset_at)
      VALUES ('reset', 'reset', 'owner', 'word', '2026-10-26')`,
    ],
    [
      'content command',
      `INSERT INTO dictionary_content_commands
      (operation_id, user_id, word_id, kind, expected_content_version, payload_json, queued_at)
      VALUES ('edit', 'owner', 'word', 'edit-private', 0, '{}', '2026-10-26')`,
    ],
    [
      'import',
      `INSERT INTO dictionary_import_intents
      (operation_id, user_id, word_id, payload_json, queued_at)
      VALUES ('import', 'owner', 'word', '{}', '2026-10-26')`,
    ],
    [
      'import recovery',
      `INSERT INTO dictionary_import_recovery_outbox
      (operation_id, user_id, word_id, kind, payload_json, placement_revision, queued_at)
      VALUES ('recover', 'owner', 'word', 'recovery', '{}', 1, '2026-10-26')`,
    ],
    [
      'placement debt',
      `INSERT INTO dictionary_import_delivery
      (word_id, user_id, local_placement_revision, acknowledged_placement_revision)
      VALUES ('word', 'owner', 2, 1)`,
    ],
    [
      'unknown placement receipt',
      `INSERT INTO dictionary_import_delivery
      (word_id, user_id) VALUES ('word', 'owner')`,
    ],
    [
      'correction',
      `INSERT INTO review_corrections
      (correction_id, event_id, word_id, user_id, expected_revision, assessment, queued_at, status)
      VALUES ('correction', 'event', 'word', 'owner', 0, 'again', '2026-10-26', 'pending')`,
    ],
    [
      'correction recovery',
      `INSERT INTO review_corrections
      (correction_id, event_id, word_id, user_id, expected_revision, assessment, queued_at, status)
      VALUES ('correction', 'event', 'word', 'owner', 0, 'again', '2026-10-26', 'conflict');
      INSERT INTO review_correction_recovery VALUES ('correction', 'owner', 'word')`,
    ],
  ])(
    'preserves %s when reconciling an acknowledged review',
    async (_label, sql) => {
      await acknowledge()
      const incoming = await canonical()
      // Content can differ even while updated_at still equals the review time.
      database.exec(sql)
      const before = database.prepare(allWordsSql).all()
      await wordRepository.reconcileAcknowledgedLearning('owner', [incoming])
      await wordRepository.saveWords([incoming], { preserveUnsynced: true })
      expect(database.prepare(allWordsSql).all()).toEqual(before)
    }
  )

  it('does not acknowledge an event that has not reached the server', async () => {
    const incoming = await canonical()
    expect(
      await wordRepository.getAcknowledgedLearningWordIds('owner')
    ).toEqual([])
    await wordRepository.reconcileAcknowledgedLearning('owner', [incoming])
    expect(await syncStatusService.getSnapshot('owner')).toMatchObject({
      pendingUploads: 1,
    })
    expect(
      database.prepare('SELECT * FROM learning_commands').all()
    ).toHaveLength(1)
  })

  it('does not cross owners or accept different placement/progress from a stale snapshot', async () => {
    await acknowledge()
    const incoming = await canonical()
    const before = database.prepare(allWordsSql).all()
    expect(
      await wordRepository.getAcknowledgedLearningWordIds(otherOwner)
    ).toEqual([])
    await wordRepository.reconcileAcknowledgedLearning(otherOwner, [incoming])
    await wordRepository.reconcileAcknowledgedLearning('owner', [
      { ...incoming, user_id: otherOwner },
    ])
    await wordRepository.reconcileAcknowledgedLearning('owner', [
      { ...incoming, collection_id: 'other-collection' },
    ])
    await wordRepository.reconcileAcknowledgedLearning('owner', [
      { ...incoming, repetition_count: 0 },
    ])
    expect(database.prepare(allWordsSql).all()).toEqual(before)
  })

  it('preserves a later unacknowledged event even if its command is missing', async () => {
    await acknowledge()
    const incoming = await canonical()
    database.exec(`INSERT INTO review_events
      (event_id, word_id, user_id, assessment, review_mode, answered_correctly,
       response_time_ms, previous_interval_days, next_interval_days,
       previous_easiness_factor, next_easiness_factor, reviewed_at)
      SELECT 'later-event', word_id, user_id, assessment, review_mode, answered_correctly,
       response_time_ms, previous_interval_days, next_interval_days,
       previous_easiness_factor, next_easiness_factor, reviewed_at FROM review_events;
      DELETE FROM learning_commands`)
    expect(
      await wordRepository.getAcknowledgedLearningWordIds('owner')
    ).toEqual([])
    await wordRepository.reconcileAcknowledgedLearning('owner', [incoming])
    expect(await syncStatusService.getSnapshot('owner')).toMatchObject({
      pendingUploads: 1,
    })
  })

  it('rolls back acknowledgement if SQLite cannot persist it', async () => {
    await acknowledge()
    const incoming = await canonical()
    const before = database.prepare(allWordsSql).all()
    database.exec(`CREATE TRIGGER fail_ack BEFORE UPDATE OF sync_status ON words
      WHEN NEW.sync_status = 'synced' BEGIN SELECT RAISE(ABORT, 'injected failure'); END`)
    await expect(
      wordRepository.reconcileAcknowledgedLearning('owner', [incoming])
    ).rejects.toThrow('injected failure')
    expect(database.prepare(allWordsSql).all()).toEqual(before)
  })
})
