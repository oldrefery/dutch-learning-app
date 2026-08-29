import { getDatabase } from '../initDB'
import { ReviewEventRepository } from '../reviewEventRepository'
import type { ReviewEventDraft } from '@/types/ReviewTypes'

jest.mock('../initDB', () => ({
  getDatabase: jest.fn(),
}))

describe('ReviewEventRepository', () => {
  const event: ReviewEventDraft = {
    event_id: 'event-1',
    user_id: 'user-1',
    word_id: 'word-1',
    assessment: 'good',
    review_mode: 'recognition',
    answered_correctly: true,
    response_time_ms: 1250,
    previous_interval_days: 1,
    next_interval_days: 3,
    previous_easiness_factor: 2.5,
    next_easiness_factor: 2.6,
    reviewed_at: '2026-08-29T10:00:00.000Z',
  }
  const progress = {
    interval_days: 3,
    repetition_count: 1,
    easiness_factor: 2.6,
    next_review_date: '2026-09-01',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('writes SRS and its event inside one exclusive transaction', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValueOnce({ changes: 1 })
      .mockResolvedValueOnce({ changes: 1 })
    const withExclusiveTransactionAsync = jest.fn(
      async (operation: (transaction: { runAsync: jest.Mock }) => unknown) =>
        operation({ runAsync })
    )
    ;(getDatabase as jest.Mock).mockResolvedValue({
      withExclusiveTransactionAsync,
    })

    await new ReviewEventRepository().recordAssessment({ event, progress })

    expect(withExclusiveTransactionAsync).toHaveBeenCalledTimes(1)
    expect(runAsync).toHaveBeenCalledTimes(2)
    expect(runAsync.mock.calls[0][0]).toContain('UPDATE words SET')
    expect(runAsync.mock.calls[1][0]).toContain('INSERT INTO review_events')
  })

  it('rolls the word change back when the event insert fails', async () => {
    let committedInterval = 1
    const withExclusiveTransactionAsync = jest.fn(
      async (operation: (transaction: { runAsync: jest.Mock }) => unknown) => {
        let transactionalInterval = committedInterval
        const runAsync = jest.fn(async (sql: string) => {
          if (sql.includes('UPDATE words SET')) {
            transactionalInterval = progress.interval_days
            return { changes: 1 }
          }
          throw new Error('event insert failed')
        })

        await operation({ runAsync })
        committedInterval = transactionalInterval
      }
    )
    ;(getDatabase as jest.Mock).mockResolvedValue({
      withExclusiveTransactionAsync,
    })

    await expect(
      new ReviewEventRepository().recordAssessment({ event, progress })
    ).rejects.toThrow('event insert failed')
    expect(committedInterval).toBe(1)
  })

  it('rejects an assessment for a missing or tombstoned word', async () => {
    const withExclusiveTransactionAsync = jest.fn(
      async (operation: (transaction: { runAsync: jest.Mock }) => unknown) =>
        operation({
          runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
        })
    )
    ;(getDatabase as jest.Mock).mockResolvedValue({
      withExclusiveTransactionAsync,
    })

    await expect(
      new ReviewEventRepository().recordAssessment({ event, progress })
    ).rejects.toThrow('Review word was not found')
  })

  it('uses an idempotent conflict path when applying remote events', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 })
    const withExclusiveTransactionAsync = jest.fn(
      async (operation: (transaction: { runAsync: jest.Mock }) => unknown) =>
        operation({ runAsync })
    )
    ;(getDatabase as jest.Mock).mockResolvedValue({
      withExclusiveTransactionAsync,
    })

    await new ReviewEventRepository().saveRemoteEvents([
      { ...event, created_at: '2026-08-29T10:00:01.000Z' },
    ])

    expect(runAsync.mock.calls[0][0]).toContain('ON CONFLICT(event_id)')
    expect(runAsync.mock.calls[0][0]).toContain("sync_status = 'synced'")
    expect(runAsync.mock.calls[1][0]).toContain(
      'SELECT word_id FROM words WHERE deleted_at IS NOT NULL'
    )
  })

  it('bounds recent history queries to one hundred events', async () => {
    const getAllAsync = jest.fn().mockResolvedValue([])
    ;(getDatabase as jest.Mock).mockResolvedValue({ getAllAsync })

    await new ReviewEventRepository().getRecentByUser('user-1', 10_000)

    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY reviewed_at DESC, event_id DESC'),
      'user-1',
      100
    )
  })
})
