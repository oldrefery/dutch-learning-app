import type { DatabaseSync } from 'node:sqlite'
import { createTestDatabase } from './sqlite.fixture'
import { getLearningQueueHealth } from '../learningQueueHealth'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

describe('learning queue health aggregates', () => {
  let db: DatabaseSync
  const now = Date.parse('2026-09-06T12:00:00Z')
  beforeEach(() => {
    db = createTestDatabase()
    db.exec(`INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at)
      VALUES ('word', 'qa', 'private-word', '{}', '2026-09-06', '2026-09-05', '2026-09-05')`)
  })
  afterEach(() => db.close())
  const reset = (id: string, user: string, at: string) =>
    db
      .prepare(
        "INSERT INTO learning_commands(operation_id, kind, user_id, word_id, reset_at) VALUES (?, 'reset', ?, 'word', ?)"
      )
      .run(id, user, at)

  it('returns empty aggregate values without row details', async () => {
    expect(await getLearningQueueHealth('qa', now)).toEqual({
      count: 0,
      reviews: 0,
      resets: 0,
      oldestAgeSeconds: null,
    })
  })
  it('counts both command kinds, excludes other users and reads the oldest valid timestamp', async () => {
    reset('ours', 'qa', '2026-09-06T11:00:00Z')
    reset('theirs', 'other', '2000-01-01')
    db.exec(`INSERT INTO review_events(event_id, user_id, word_id, assessment, review_mode,
      previous_interval_days, next_interval_days, previous_easiness_factor, next_easiness_factor, reviewed_at)
      VALUES ('event', 'qa', 'word', 'good', 'recognition', 1, 6, 2.5, 2.5, '2026-09-05T14:00:00+02:00')`)
    expect(await getLearningQueueHealth('qa', now)).toEqual({
      count: 2,
      reviews: 1,
      resets: 1,
      oldestAgeSeconds: 86400,
    })
    expect(
      db.prepare('SELECT count(*) AS count FROM learning_commands').get()?.count
    ).toBe(3)
  })
  it.each([
    ['invalid', null],
    ['2030-01-01', 0],
  ] as const)(
    'handles invalid/future time %s without inventing queue age',
    async (at, age) => {
      reset('ours', 'qa', at)
      expect(await getLearningQueueHealth('qa', now)).toEqual({
        count: 1,
        reviews: 0,
        resets: 1,
        oldestAgeSeconds: age,
      })
    }
  )
})
