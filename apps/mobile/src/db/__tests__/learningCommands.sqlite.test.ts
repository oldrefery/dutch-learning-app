import type { DatabaseSync } from 'node:sqlite'
import { createTestDatabase } from './sqlite.fixture'
import { wordRepository } from '../wordRepository'
import { reviewEventRepository } from '../reviewEventRepository'
import { learningResetRepository } from '../learningResetRepository'
import { MIGRATION_V9_LEARNING_COMMANDS } from '../schema'
import type { ReviewEventDraft } from '@/types/ReviewTypes'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const at = '2026-09-05T12:00:00.000Z'
const reviewDate = '2026-09-05'
const draft = (id: string): ReviewEventDraft => ({
  event_id: id,
  user_id: 'qa-user',
  word_id: 'word-1',
  assessment: 'easy',
  review_mode: 'recognition',
  answered_correctly: null,
  response_time_ms: null,
  previous_interval_days: 1,
  next_interval_days: 4,
  previous_easiness_factor: 2.5,
  next_easiness_factor: 2.5,
  reviewed_at: at,
})
const assess = (id: string) =>
  reviewEventRepository.recordAssessment({
    event: draft(id),
    progress: {
      interval_days: 4,
      repetition_count: 1,
      easiness_factor: 2.5,
      next_review_date: '2026-09-09',
    },
  })

describe('durable review and reset command ordering in SQLite', () => {
  let db: DatabaseSync
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(at))
    db = createTestDatabase()
    db.prepare(
      `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, sync_status)
      VALUES ('word-1', 'qa-user', 'huis', '{}', '2026-09-06', ?, ?, 'synced')`
    ).run(at, at)
  })
  afterEach(() => {
    db.close()
    jest.useRealTimers()
  })
  const commands = () =>
    db.prepare('SELECT * FROM learning_commands ORDER BY sequence').all()
  const word = () =>
    db.prepare("SELECT * FROM words WHERE word_id = 'word-1'").get()!

  it('orders review → reset → review even with identical timestamps', async () => {
    await assess('before')
    await wordRepository.resetWordProgress('word-1', 'qa-user')
    await assess('after')
    expect(commands().map(row => row.kind)).toEqual([
      'review',
      'reset',
      'review',
    ])
    const reset = await learningResetRepository.getNext('qa-user')
    const reviews = await reviewEventRepository.getPendingSyncEvents('qa-user')
    expect(reviews.map(row => row.event_id)).toEqual(['before', 'after'])
    expect(reviews[0].local_sequence).toBeLessThan(reset!.sequence)
    expect(reviews[1].local_sequence).toBeGreaterThan(reset!.sequence)
    expect(reviews[0].review_date).toBe(reviewDate)
    expect(reset).toMatchObject({
      reset_at: at,
      review_date: reviewDate,
      word_id: 'word-1',
    })
    // Reconstructing the repository and rerunning the idempotent migration
    // preserves IDs/order; no in-memory queue is needed to retry after restart.
    const before = commands()
    db.exec(MIGRATION_V9_LEARNING_COMMANDS)
    expect(commands()).toEqual(before)
    expect(await learningResetRepository.getNext('qa-user')).toEqual(reset)
    await learningResetRepository.acknowledge('other-user', reset!.operation_id)
    expect(commands()).toHaveLength(3)
    await reviewEventRepository.reconcilePushedEvents('qa-user', [
      { event_id: 'before', created_at: at },
    ])
    await learningResetRepository.acknowledge('qa-user', reset!.operation_id)
    expect(commands().map(row => row.operation_id)).toEqual(['after'])
  })

  it('rolls back provisional progress when its reset command cannot be stored', async () => {
    await assess('existing')
    const before = word()
    db.exec(`CREATE TRIGGER fail_reset BEFORE INSERT ON learning_commands WHEN NEW.kind = 'reset'
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`)
    await expect(
      wordRepository.resetWordProgress('word-1', 'qa-user')
    ).rejects.toThrow('disk failure')
    expect(word()).toEqual(before)
    expect(commands()).toHaveLength(1)
  })

  it('backfills a legacy pending review queue without duplicating commands', async () => {
    await assess('legacy-b')
    await assess('legacy-a')
    db.exec('DELETE FROM learning_commands')
    db.exec(MIGRATION_V9_LEARNING_COMMANDS)
    const migrated = commands()
    expect(migrated.map(row => row.operation_id)).toEqual([
      'legacy-a',
      'legacy-b',
    ])
    db.exec(MIGRATION_V9_LEARNING_COMMANDS)
    expect(commands()).toEqual(migrated)
  })

  it('keeps a conflicting event queued instead of acknowledging another intent', async () => {
    await assess('event')
    const before = commands()
    await expect(
      reviewEventRepository.saveRemoteEvents([
        { ...draft('event'), assessment: 'hard', created_at: at },
      ])
    ).rejects.toThrow('conflicts with the local event identity')
    expect(commands()).toEqual(before)
    expect(
      (await reviewEventRepository.getPendingSyncEvents('qa-user'))[0]
        .assessment
    ).toBe('easy')
  })

  it('rejects foreign/missing resets and removes commands for a tombstoned word', async () => {
    await expect(
      wordRepository.resetWordProgress('word-1', 'other')
    ).rejects.toThrow('not found')
    await expect(
      wordRepository.resetWordProgress('missing', 'qa-user')
    ).rejects.toThrow('not found')
    expect(commands()).toEqual([])
    await assess('event')
    await wordRepository.resetWordProgress('word-1', 'qa-user')
    db.prepare('UPDATE words SET deleted_at = ?').run(at)
    expect(commands()).toEqual([])
    expect(await learningResetRepository.getNext('qa-user')).toBeNull()
    expect(await reviewEventRepository.getPendingSyncEvents('qa-user')).toEqual(
      []
    )
  })

  it('preserves provisional SRS until commands are acknowledged, then accepts canonical values', async () => {
    await assess('event')
    const remote = await wordRepository.getWordByIdAndUserId(
      'word-1',
      'qa-user'
    )
    if (!remote) throw new Error('Missing fixture')
    const canonical = { ...remote, interval_days: 10, repetition_count: 2 }
    db.exec("UPDATE words SET sync_status = 'synced'")
    await wordRepository.saveWords([canonical], { preserveUnsynced: true })
    expect(word().interval_days).toBe(4)
    await reviewEventRepository.saveRemoteEvents([
      {
        ...draft('event'),
        next_interval_days: 10,
        previous_interval_days: 1,
        created_at: at,
        review_date: reviewDate,
      },
    ])
    expect(commands()).toEqual([])
    expect(
      (await reviewEventRepository.getRecentByWord('qa-user', 'word-1'))[0]
        .next_interval_days
    ).toBe(10)
    await wordRepository.saveWords([canonical], { preserveUnsynced: true })
    expect(word().interval_days).toBe(10)
    expect(word().repetition_count).toBe(2)
  })
})
