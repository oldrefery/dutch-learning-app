import { getDatabase } from './initDB'
import { sameReviewCorrectionCommand } from './reviewCorrectionRepository'
import type {
  LocalReviewCorrection,
  ReviewCorrectionCommand,
  ReviewCorrectionProgress,
} from '@/types/ReviewCorrection'
import type { SRSAssessment } from '@/types/database'

export const reviewCorrectionRecoveryRepository = {
  async assertReady(userId: string): Promise<void> {
    const db = await getDatabase()
    const pending = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM review_correction_recovery WHERE user_id = ?',
      [userId]
    )
    if (pending?.count)
      throw new Error(
        'Finish synchronizing the pending review correction before continuing'
      )
  },
  async pending(userId: string): Promise<LocalReviewCorrection[]> {
    const db = await getDatabase()
    return db.getAllAsync<LocalReviewCorrection>(
      `SELECT r.* FROM review_corrections r JOIN review_correction_recovery b
       ON b.correction_id = r.correction_id AND b.user_id = r.user_id
       WHERE r.user_id = ? ORDER BY r.queued_at, r.correction_id`,
      userId
    )
  },
  async effective(command: ReviewCorrectionCommand) {
    const db = await getDatabase()
    return db.getFirstAsync<{
      eventId: string
      wordId: string
      assessment: SRSAssessment
      revision: number
    }>(
      `SELECT e.event_id AS eventId, e.word_id AS wordId, e.assessment, e.revision
       FROM effective_review_events e JOIN words w ON w.word_id = e.word_id AND w.user_id = e.user_id
       WHERE e.user_id = ? AND e.event_id = ? AND e.word_id = ? AND w.deleted_at IS NULL`,
      [command.user_id, command.event_id, command.word_id]
    )
  },
  /** Caller owns the learning FIFO and has validated fresh server progress. */
  async finish(
    command: ReviewCorrectionCommand,
    progress: ReviewCorrectionProgress | null
  ): Promise<void> {
    if (
      progress &&
      (progress.user_id !== command.user_id ||
        progress.word_id !== command.word_id)
    )
      throw new Error('Foreign correction progress')
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async tx => {
      const local = await tx.getFirstAsync<LocalReviewCorrection>(
        'SELECT * FROM review_corrections WHERE user_id = ? AND correction_id = ?',
        [command.user_id, command.correction_id]
      )
      if (
        !local ||
        !sameReviewCorrectionCommand(local, command) ||
        (local.status !== 'synced' && !local.resolved_at)
      )
        throw new Error('Correction is not confirmed or resolved')
      const pending = await tx.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM learning_commands WHERE user_id = ? AND word_id = ?',
        [command.user_id, command.word_id]
      )
      if (pending?.count)
        throw new Error(
          'Sync earlier learning commands before refreshing progress'
        )
      if (progress) {
        await tx.runAsync(
          `UPDATE words SET interval_days = ?, repetition_count = ?, easiness_factor = ?,
           next_review_date = ?, last_reviewed_at = ? WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL`,
          progress.interval_days,
          progress.repetition_count,
          progress.easiness_factor,
          progress.next_review_date,
          progress.last_reviewed_at,
          command.user_id,
          command.word_id
        )
      } else {
        // Retain the row as a tombstone; do not allow reviews of a server-deleted word.
        await tx.runAsync(
          'UPDATE words SET deleted_at = COALESCE(deleted_at, ?) WHERE user_id = ? AND word_id = ?',
          new Date().toISOString(),
          command.user_id,
          command.word_id
        )
      }
      await tx.runAsync(
        'DELETE FROM review_correction_recovery WHERE user_id = ? AND correction_id = ?',
        command.user_id,
        command.correction_id
      )
    })
  },
}
