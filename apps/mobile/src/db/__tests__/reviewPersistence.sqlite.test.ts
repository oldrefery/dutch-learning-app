import type { DatabaseSync } from 'node:sqlite'
import {
  calculateSRSProgress,
  getWordKnowledgeLevel,
  type SRSAssessmentType,
} from '@woordenaar/domain'
import type { ReviewEventDraft } from '@/types/ReviewTypes'
import { reviewEventRepository } from '../reviewEventRepository'
import { wordRepository } from '../wordRepository'
import { createTestDatabase } from './sqlite.fixture'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const timestamp = '2026-09-05T12:00:00.000Z'

describe('atomic review progress in real SQLite', () => {
  let database: DatabaseSync
  beforeEach(() => {
    database = createTestDatabase()
    database
      .prepare(
        `INSERT INTO words
      (word_id, user_id, dutch_lemma, translations, interval_days, next_review_date, created_at, updated_at)
      VALUES ('word-1', 'qa-user', 'huis', '{"en":["house"]}', 0, '2026-09-05', ?, ?)`
      )
      .run(timestamp, timestamp)
  })
  afterEach(() => database.close())

  const word = () =>
    database.prepare("SELECT * FROM words WHERE word_id = 'word-1'").get()!
  const events = () => database.prepare('SELECT * FROM review_events').all()
  const assess = (
    assessment: SRSAssessmentType,
    eventId: string,
    overrides: Partial<ReviewEventDraft> = {},
    idempotent = false
  ) => {
    const current = word()
    const progress = calculateSRSProgress(
      {
        easinessFactor: Number(current.easiness_factor),
        intervalDays: Number(current.interval_days),
        repetitionCount: Number(current.repetition_count),
      },
      assessment
    )
    return reviewEventRepository.recordAssessment({
      idempotent,
      progress: {
        easiness_factor: progress.easinessFactor,
        interval_days: progress.intervalDays,
        repetition_count: progress.repetitionCount,
        next_review_date: '2026-09-06',
      },
      event: {
        event_id: eventId,
        word_id: 'word-1',
        user_id: 'qa-user',
        assessment,
        review_mode: 'meaning-recall',
        answered_correctly: null,
        response_time_ms: 500,
        previous_interval_days: Number(current.interval_days),
        next_interval_days: progress.intervalDays,
        previous_easiness_factor: Number(current.easiness_factor),
        next_easiness_factor: progress.easinessFactor,
        reviewed_at: timestamp,
        ...overrides,
      },
    })
  }

  it('persists learning → established → forgotten with matching immutable review events', async () => {
    for (const [index, interval] of [1, 6, 15].entries()) {
      await assess('good', `event-${index}`)
      expect(word()).toMatchObject({
        repetition_count: index + 1,
        interval_days: interval,
        easiness_factor: 2.5,
        sync_status: 'pending',
      })
      expect(events()).toHaveLength(index + 1)
      expect(getWordKnowledgeLevel(Number(word().repetition_count))).toBe(
        index === 2 ? 'established' : 'learning'
      )
    }
    await assess('again', 'event-forgotten')
    expect(word()).toMatchObject({
      repetition_count: 0,
      interval_days: 0,
      easiness_factor: 2.3,
      synced_at: null,
      last_reviewed_at: timestamp,
    })
    expect(getWordKnowledgeLevel(Number(word().repetition_count))).toBe('new')
    expect(events()[3]).toMatchObject({
      previous_interval_days: 15,
      next_interval_days: 0,
      previous_easiness_factor: 2.5,
      next_easiness_factor: 2.3,
      sync_status: 'pending',
    })
  })

  it('rolls progress back when the event fails a database constraint', async () => {
    const before = word()
    await expect(
      assess('easy', 'invalid-event', { response_time_ms: -1 })
    ).rejects.toThrow()
    expect(word()).toEqual(before)
    expect(events()).toEqual([])
  })

  it('does not advance progress twice when a local event id is submitted twice', async () => {
    await assess('good', 'same-event')
    const acknowledged = word()
    await expect(assess('good', 'same-event')).rejects.toThrow()
    expect(word()).toEqual(acknowledged)
    expect(events()).toHaveLength(1)
  })

  it('acknowledges an exact retry without replaying SRS, even after a later review', async () => {
    await assess('good', 'once', {}, true)
    await assess('easy', 'later')
    const before = word()
    await assess('good', 'once', {}, true)
    expect(word()).toEqual(before)
    expect(events()).toHaveLength(2)
    await expect(assess('hard', 'once', {}, true)).rejects.toThrow('conflicts')
    await expect(
      assess('good', 'once', { user_id: 'other' }, true)
    ).rejects.toThrow('conflicts')
    expect(word()).toEqual(before)
  })

  it('never writes a review for another user', async () => {
    const before = word()
    await expect(
      assess('easy', 'wrong-owner', { user_id: 'different-user' })
    ).rejects.toThrow('Review word was not found')
    expect(word()).toEqual(before)
    expect(events()).toEqual([])
  })

  it('preserves local deletion and removes its review history through the actual trigger', async () => {
    await assess('good', 'event-before-delete')
    await wordRepository.deleteWord('word-1', 'qa-user')
    expect(events()).toEqual([])
    expect(word().deleted_at).not.toBeNull()
    await expect(assess('easy', 'event-after-delete')).rejects.toThrow(
      'Review word was not found'
    )
    expect(word().sync_status).toBe('deleted')
  })

  it('resets knowledge to new and queues the reset for synchronization', async () => {
    await assess('easy', 'event-1')
    await assess('easy', 'event-2')
    await assess('easy', 'event-3')
    expect(getWordKnowledgeLevel(Number(word().repetition_count))).toBe(
      'established'
    )
    await wordRepository.resetWordProgress('word-1', 'qa-user')
    expect(word()).toMatchObject({
      repetition_count: 0,
      easiness_factor: 2.5,
      interval_days: 1,
      last_reviewed_at: null,
      sync_status: 'pending',
    })
    expect(getWordKnowledgeLevel(Number(word().repetition_count))).toBe('new')
  })
})
