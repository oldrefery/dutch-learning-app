import { getDatabase } from './initDB'
import type {
  PendingReviewCorrection,
  ReviewCorrectionCommand,
  ReviewCorrectionReceipt,
  LocalReviewCorrection,
} from '@/types/ReviewCorrection'

const COMMAND_FIELDS = [
  'correction_id',
  'event_id',
  'word_id',
  'user_id',
  'expected_revision',
  'assessment',
] as const
export const sameReviewCorrectionCommand = (
  left: ReviewCorrectionCommand,
  right: ReviewCorrectionCommand
) => COMMAND_FIELDS.every(field => left[field] === right[field])
const RECEIPT_FIELDS = [
  'revision',
  'next_interval_days',
  'next_repetition_count',
  'next_easiness_factor',
  'created_at',
] as const

export const reviewCorrectionRepository = {
  async getById(
    userId: string,
    correctionId: string
  ): Promise<LocalReviewCorrection | null> {
    const db = await getDatabase()
    return db.getFirstAsync<LocalReviewCorrection>(
      'SELECT * FROM review_corrections WHERE user_id = ? AND correction_id = ?',
      [userId, correctionId]
    )
  },
  async getTombstonedWordIds(
    userId: string,
    wordIds: string[]
  ): Promise<string[]> {
    const ids = [...new Set(wordIds)]
    if (!ids.length) return []
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT word_id FROM words WHERE user_id = ? AND deleted_at IS NOT NULL
       AND word_id IN (${ids.map(() => '?').join(',')})`,
      userId,
      ...ids
    )
    return rows.map(row => row.word_id)
  },
  async getMissingEventIds(
    userId: string,
    eventIds: string[]
  ): Promise<string[]> {
    const ids = [...new Set(eventIds)]
    if (!ids.length) return []
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ event_id: string }>(
      `SELECT event_id FROM review_events WHERE user_id = ? AND event_id IN (${ids.map(() => '?').join(',')})`,
      userId,
      ...ids
    )
    const found = new Set(rows.map(row => row.event_id))
    return ids.filter(id => !found.has(id))
  },
  async enqueue(command: ReviewCorrectionCommand): Promise<void> {
    if (
      !Number.isSafeInteger(command.expected_revision) ||
      command.expected_revision < 0
    ) {
      throw new Error('Invalid correction revision')
    }
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      const existing = await transaction.getFirstAsync<ReviewCorrectionCommand>(
        'SELECT * FROM review_corrections WHERE correction_id = ?',
        [command.correction_id]
      )
      if (existing) {
        if (!sameReviewCorrectionCommand(existing, command))
          throw new Error('Correction ID already exists with different data')
        return
      }
      const event = await transaction.getFirstAsync<{ revision: number }>(
        `SELECT e.revision FROM effective_review_events e JOIN words w ON w.word_id = e.word_id
         WHERE e.event_id = ? AND e.word_id = ? AND e.user_id = ?
           AND w.user_id = e.user_id AND w.deleted_at IS NULL`,
        [command.event_id, command.word_id, command.user_id]
      )
      if (!event) throw new Error('Review word or event not found')
      const pending = await transaction.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM review_corrections
         WHERE user_id = ? AND event_id = ? AND status != 'synced' AND resolved_at IS NULL`,
        [command.user_id, command.event_id]
      )
      // Resolve an uncertain outcome before accepting another edit of that event.
      if (pending?.count)
        throw new Error('Resolve the pending correction before editing again')
      if (event.revision !== command.expected_revision)
        throw new Error('Stale correction revision')
      await transaction.runAsync(
        `INSERT INTO review_corrections(correction_id, event_id, word_id, user_id,
          expected_revision, assessment, queued_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        ...COMMAND_FIELDS.map(field => command[field]),
        new Date().toISOString()
      )
    })
  },

  async getNext(userId: string): Promise<PendingReviewCorrection | null> {
    const db = await getDatabase()
    return db.getFirstAsync<PendingReviewCorrection>(
      `SELECT r.*, c.sequence FROM review_corrections r JOIN learning_commands c
       ON c.operation_id = r.correction_id AND c.kind = 'correction'
         AND c.user_id = r.user_id AND c.word_id = r.word_id
       WHERE r.user_id = ? ORDER BY c.sequence LIMIT 1`,
      [userId]
    )
  },

  async markConflict(
    userId: string,
    correctionId: string,
    message: string
  ): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `UPDATE review_corrections SET status = 'conflict', error = ?
       WHERE user_id = ? AND correction_id = ? AND status = 'pending'`,
      message,
      userId,
      correctionId
    )
  },

  async saveRemote(
    userId: string,
    receipts: ReviewCorrectionReceipt[]
  ): Promise<void> {
    if (receipts.length === 0) return
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const receipt of receipts) {
        if (receipt.user_id !== userId)
          throw new Error('Foreign correction receipt')
        const existing = await transaction.getFirstAsync<
          ReviewCorrectionReceipt & { status: string }
        >('SELECT * FROM review_corrections WHERE correction_id = ?', [
          receipt.correction_id,
        ])
        if (existing && !sameReviewCorrectionCommand(existing, receipt))
          throw new Error('Correction receipt conflicts with local intent')
        if (
          existing?.status === 'synced' &&
          RECEIPT_FIELDS.some(field => existing[field] !== receipt[field])
        ) {
          throw new Error('Correction receipt changed after acknowledgement')
        }
        const tombstone = await transaction.getFirstAsync<{ word_id: string }>(
          'SELECT word_id FROM words WHERE word_id = ? AND user_id = ? AND deleted_at IS NOT NULL',
          [receipt.word_id, userId]
        )
        if (tombstone) continue
        const event = await transaction.getFirstAsync<{ event_id: string }>(
          `SELECT e.event_id FROM review_events e JOIN words w ON w.word_id = e.word_id
           WHERE e.event_id = ? AND e.word_id = ? AND e.user_id = ?
             AND w.user_id = e.user_id AND w.deleted_at IS NULL`,
          [receipt.event_id, receipt.word_id, userId]
        )
        if (!event)
          throw new Error('Correction receipt has no local review event')
        await transaction.runAsync(
          `INSERT INTO review_corrections(correction_id, event_id, word_id, user_id,
            expected_revision, assessment, revision, next_interval_days,
            next_repetition_count, next_easiness_factor, created_at, queued_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
           ON CONFLICT(correction_id) DO UPDATE SET revision = excluded.revision,
             next_interval_days = excluded.next_interval_days,
             next_repetition_count = excluded.next_repetition_count,
             next_easiness_factor = excluded.next_easiness_factor,
             created_at = excluded.created_at, status = 'synced', error = NULL`,
          ...COMMAND_FIELDS.map(field => receipt[field]),
          receipt.revision,
          receipt.next_interval_days,
          receipt.next_repetition_count,
          receipt.next_easiness_factor,
          receipt.created_at,
          receipt.created_at
        )
      }
    })
  },
}
