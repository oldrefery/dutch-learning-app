import type { SRSResult } from '@/types/database'
import type { ReviewEvent, ReviewEventDraft } from '@/types/ReviewTypes'
import { getDatabase } from './initDB'
import type { SyncStatus } from './schema'

export interface LocalReviewEvent extends Omit<ReviewEvent, 'created_at'> {
  created_at: string | null
  sync_status: SyncStatus
  last_sync_attempt_at: string | null
  synced_at: string | null
}

export interface ReviewEventSyncAcknowledgement {
  event_id: string
  created_at: string
}

interface RecordReviewAssessmentInput {
  event: ReviewEventDraft
  progress: SRSResult
}

const DEFAULT_QUERY_LIMIT = 50
const MAX_QUERY_LIMIT = 100

const INSERT_LOCAL_EVENT_SQL = `
  INSERT INTO review_events (
    event_id, user_id, word_id, assessment, review_mode,
    answered_correctly, response_time_ms, previous_interval_days,
    next_interval_days, previous_easiness_factor, next_easiness_factor,
    reviewed_at, created_at, sync_status, last_sync_attempt_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL)
`

const SAVE_REMOTE_EVENT_SQL = `
  INSERT INTO review_events (
    event_id, user_id, word_id, assessment, review_mode,
    answered_correctly, response_time_ms, previous_interval_days,
    next_interval_days, previous_easiness_factor, next_easiness_factor,
    reviewed_at, created_at, sync_status, last_sync_attempt_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, ?)
  ON CONFLICT(event_id) DO UPDATE SET
    created_at = excluded.created_at,
    sync_status = 'synced',
    last_sync_attempt_at = review_events.last_sync_attempt_at,
    synced_at = excluded.synced_at
  WHERE review_events.user_id = excluded.user_id
`

const normalizeLimit = (limit: number): number => {
  if (!Number.isFinite(limit)) return DEFAULT_QUERY_LIMIT
  return Math.min(MAX_QUERY_LIMIT, Math.max(1, Math.trunc(limit)))
}

export class ReviewEventRepository {
  async recordAssessment({
    event,
    progress,
  }: RecordReviewAssessmentInput): Promise<void> {
    const db = await getDatabase()

    await db.withExclusiveTransactionAsync(async transaction => {
      const updateResult = await transaction.runAsync(
        `UPDATE words SET
          interval_days = ?,
          repetition_count = ?,
          easiness_factor = ?,
          next_review_date = ?,
          last_reviewed_at = ?,
          updated_at = ?,
          sync_status = 'pending',
          last_sync_attempt_at = NULL,
          synced_at = NULL
        WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`,
        progress.interval_days,
        progress.repetition_count,
        progress.easiness_factor,
        progress.next_review_date,
        event.reviewed_at,
        event.reviewed_at,
        event.word_id,
        event.user_id
      )

      if (updateResult.changes !== 1) {
        throw new Error('Review word was not found in the local database')
      }

      await transaction.runAsync(
        INSERT_LOCAL_EVENT_SQL,
        ...this.toEventBindValues(event)
      )
    })
  }

  async saveRemoteEvents(events: ReviewEvent[]): Promise<void> {
    if (events.length === 0) return

    const db = await getDatabase()
    const syncedAt = new Date().toISOString()

    await db.withExclusiveTransactionAsync(async transaction => {
      for (const event of events) {
        await transaction.runAsync(
          SAVE_REMOTE_EVENT_SQL,
          ...this.toEventBindValues(event),
          event.created_at,
          syncedAt
        )
      }

      await transaction.runAsync(
        `DELETE FROM review_events
         WHERE word_id IN (
           SELECT word_id FROM words WHERE deleted_at IS NOT NULL
         )`
      )
    })
  }

  async getPendingSyncEvents(
    userId: string,
    limit = 500
  ): Promise<LocalReviewEvent[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM review_events
       WHERE user_id = ? AND sync_status = 'pending'
       ORDER BY reviewed_at ASC, event_id ASC
       LIMIT ?`,
      userId,
      Math.max(1, Math.trunc(limit))
    )

    return rows.map(row => this.parseEventRow(row))
  }

  async reconcilePushedEvents(
    userId: string,
    acknowledgements: ReviewEventSyncAcknowledgement[]
  ): Promise<void> {
    if (acknowledgements.length === 0) return

    const db = await getDatabase()
    const syncedAt = new Date().toISOString()

    await db.withExclusiveTransactionAsync(async transaction => {
      for (const acknowledgement of acknowledgements) {
        await transaction.runAsync(
          `UPDATE review_events SET
            created_at = ?,
            sync_status = 'synced',
            last_sync_attempt_at = ?,
            synced_at = ?
          WHERE event_id = ? AND user_id = ?`,
          acknowledgement.created_at,
          syncedAt,
          syncedAt,
          acknowledgement.event_id,
          userId
        )
      }
    })
  }

  async getRecentByUser(
    userId: string,
    limit = DEFAULT_QUERY_LIMIT
  ): Promise<LocalReviewEvent[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM review_events
       WHERE user_id = ?
       ORDER BY reviewed_at DESC, event_id DESC
       LIMIT ?`,
      userId,
      normalizeLimit(limit)
    )

    return rows.map(row => this.parseEventRow(row))
  }

  async getRecentByWord(
    userId: string,
    wordId: string,
    limit = DEFAULT_QUERY_LIMIT
  ): Promise<LocalReviewEvent[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM review_events
       WHERE user_id = ? AND word_id = ?
       ORDER BY reviewed_at DESC, event_id DESC
       LIMIT ?`,
      userId,
      wordId,
      normalizeLimit(limit)
    )

    return rows.map(row => this.parseEventRow(row))
  }

  private toEventBindValues(event: ReviewEventDraft | ReviewEvent) {
    return [
      event.event_id,
      event.user_id,
      event.word_id,
      event.assessment,
      event.review_mode,
      event.answered_correctly === null
        ? null
        : event.answered_correctly
          ? 1
          : 0,
      event.response_time_ms,
      event.previous_interval_days,
      event.next_interval_days,
      event.previous_easiness_factor,
      event.next_easiness_factor,
      event.reviewed_at,
    ] as const
  }

  private parseEventRow(row: Record<string, unknown>): LocalReviewEvent {
    return {
      event_id: String(row.event_id),
      user_id: String(row.user_id),
      word_id: String(row.word_id),
      assessment: row.assessment as ReviewEvent['assessment'],
      review_mode: row.review_mode as ReviewEvent['review_mode'],
      answered_correctly:
        row.answered_correctly === null
          ? null
          : Number(row.answered_correctly) === 1,
      response_time_ms:
        row.response_time_ms === null ? null : Number(row.response_time_ms),
      previous_interval_days: Number(row.previous_interval_days),
      next_interval_days: Number(row.next_interval_days),
      previous_easiness_factor: Number(row.previous_easiness_factor),
      next_easiness_factor: Number(row.next_easiness_factor),
      reviewed_at: String(row.reviewed_at),
      created_at: row.created_at === null ? null : String(row.created_at),
      sync_status: row.sync_status as SyncStatus,
      last_sync_attempt_at:
        row.last_sync_attempt_at === null
          ? null
          : String(row.last_sync_attempt_at),
      synced_at: row.synced_at === null ? null : String(row.synced_at),
    }
  }
}

export const reviewEventRepository = new ReviewEventRepository()
