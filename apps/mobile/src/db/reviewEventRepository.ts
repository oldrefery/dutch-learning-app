import type { SRSResult } from '@/types/database'
import type { ReviewEvent, ReviewEventDraft } from '@/types/ReviewTypes'
import { getDatabase } from './initDB'
import type { SyncStatus } from './schema'
import { toLocalDateKey } from '@woordenaar/domain'

export interface LocalReviewEvent extends Omit<ReviewEvent, 'created_at'> {
  local_sequence?: number
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
  idempotent?: boolean
}

const DEFAULT_QUERY_LIMIT = 50
const MAX_QUERY_LIMIT = 100
const WORD_QUERY_CHUNK_SIZE = 400

const INSERT_LOCAL_EVENT_SQL = `
  INSERT INTO review_events (
    event_id, user_id, word_id, assessment, review_mode,
    answered_correctly, response_time_ms, previous_interval_days,
    next_interval_days, previous_easiness_factor, next_easiness_factor,
    reviewed_at, review_date, created_at, sync_status, last_sync_attempt_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL)
`

const SAVE_REMOTE_EVENT_SQL = `
  INSERT INTO review_events (
    event_id, user_id, word_id, assessment, review_mode,
    answered_correctly, response_time_ms, previous_interval_days,
    next_interval_days, previous_easiness_factor, next_easiness_factor,
    reviewed_at, review_date, created_at, sync_status, last_sync_attempt_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL, ?)
  ON CONFLICT(event_id) DO UPDATE SET
    previous_interval_days = excluded.previous_interval_days,
    next_interval_days = excluded.next_interval_days,
    previous_easiness_factor = excluded.previous_easiness_factor,
    next_easiness_factor = excluded.next_easiness_factor,
    review_date = excluded.review_date,
    created_at = excluded.created_at,
    sync_status = 'synced',
    last_sync_attempt_at = review_events.last_sync_attempt_at,
    synced_at = excluded.synced_at
  WHERE review_events.user_id = excluded.user_id
    AND review_events.word_id = excluded.word_id
    AND review_events.assessment = excluded.assessment
    AND review_events.review_mode = excluded.review_mode
    AND review_events.answered_correctly IS excluded.answered_correctly
    AND review_events.response_time_ms IS excluded.response_time_ms
    AND julianday(review_events.reviewed_at) = julianday(excluded.reviewed_at)
`

const normalizeLimit = (limit: number): number => {
  if (!Number.isFinite(limit)) return DEFAULT_QUERY_LIMIT
  return Math.min(MAX_QUERY_LIMIT, Math.max(1, Math.trunc(limit)))
}

export class ReviewEventRepository {
  async recordAssessment({
    event,
    progress,
    idempotent = false,
  }: RecordReviewAssessmentInput): Promise<void> {
    const db = await getDatabase()

    await db.withExclusiveTransactionAsync(async transaction => {
      if (idempotent) {
        const existing = await transaction.getFirstAsync<{ matches: number }>(
          `SELECT (user_id = ? AND word_id = ? AND assessment = ? AND review_mode = ?
            AND answered_correctly IS ? AND response_time_ms IS ?
            AND julianday(reviewed_at) = julianday(?)) AS matches
           FROM review_events WHERE event_id = ?`,
          [
            event.user_id,
            event.word_id,
            event.assessment,
            event.review_mode,
            event.answered_correctly === null
              ? null
              : Number(event.answered_correctly),
            event.response_time_ms,
            event.reviewed_at,
            event.event_id,
          ]
        )
        if (existing) {
          if (existing.matches !== 1)
            throw new Error(
              'Review event ID conflicts with the original answer'
            )
          return
        }
      }
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
        ...this.toEventBindValues({
          ...event,
          review_date:
            event.review_date ?? toLocalDateKey(new Date(event.reviewed_at)),
        })
      )
    })
  }

  async saveRemoteEvents(events: ReviewEvent[]): Promise<void> {
    if (events.length === 0) return

    const db = await getDatabase()
    const syncedAt = new Date().toISOString()

    await db.withExclusiveTransactionAsync(async transaction => {
      for (const event of events) {
        const result = await transaction.runAsync(
          SAVE_REMOTE_EVENT_SQL,
          ...this.toEventBindValues(event),
          event.created_at,
          syncedAt
        )
        if (result.changes !== 1)
          throw new Error(
            'Remote review conflicts with the local event identity'
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
      `SELECT review_events.*, learning_commands.sequence AS local_sequence
       FROM review_events JOIN learning_commands ON operation_id = event_id AND kind = 'review'
       WHERE review_events.user_id = ? AND sync_status = 'pending'
       ORDER BY learning_commands.sequence
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
      `SELECT * FROM effective_review_events
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
      `SELECT * FROM effective_review_events
       WHERE user_id = ? AND word_id = ?
       ORDER BY reviewed_at DESC, event_id DESC
       LIMIT ?`,
      userId,
      wordId,
      normalizeLimit(limit)
    )

    return rows.map(row => this.parseEventRow(row))
  }

  async getRecentByWords(
    userId: string,
    wordIds: readonly string[],
    limitPerWord = DEFAULT_QUERY_LIMIT
  ): Promise<Record<string, LocalReviewEvent[]>> {
    const uniqueWordIds = [...new Set(wordIds)]
    const eventsByWordId = Object.fromEntries(
      uniqueWordIds.map(wordId => [wordId, [] as LocalReviewEvent[]])
    )
    if (uniqueWordIds.length === 0) return eventsByWordId

    const db = await getDatabase()
    const normalizedLimit = normalizeLimit(limitPerWord)

    for (
      let offset = 0;
      offset < uniqueWordIds.length;
      offset += WORD_QUERY_CHUNK_SIZE
    ) {
      const chunk = uniqueWordIds.slice(offset, offset + WORD_QUERY_CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(', ')
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM (
           SELECT effective_review_events.*,
             ROW_NUMBER() OVER (
               PARTITION BY word_id
               ORDER BY reviewed_at DESC, event_id DESC
             ) AS review_rank
           FROM effective_review_events
           WHERE user_id = ? AND word_id IN (${placeholders})
         )
         WHERE review_rank <= ?
         ORDER BY word_id ASC, reviewed_at DESC, event_id DESC`,
        userId,
        ...chunk,
        normalizedLimit
      )

      for (const row of rows) {
        const parsedEvent = this.parseEventRow(row)
        eventsByWordId[parsedEvent.word_id]?.push(parsedEvent)
      }
    }

    return eventsByWordId
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
      event.review_date ?? null,
    ] as const
  }

  private parseEventRow(row: Record<string, unknown>): LocalReviewEvent {
    return {
      ...(typeof row.local_sequence === 'number'
        ? { local_sequence: row.local_sequence }
        : {}),
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
      review_date: typeof row.review_date === 'string' ? row.review_date : null,
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
