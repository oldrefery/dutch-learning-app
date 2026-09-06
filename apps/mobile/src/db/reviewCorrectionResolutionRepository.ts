import { getDatabase } from './initDB'
import { sameReviewCorrectionCommand } from './reviewCorrectionRepository'
import type {
  LocalReviewCorrection,
  ReviewCorrectionCommand,
  ReviewCorrectionProgress,
} from '@/types/ReviewCorrection'

/** Called only after explicit user resolution and authenticated server refresh. */
export async function keepServerReviewCorrection(
  command: ReviewCorrectionCommand,
  progress: ReviewCorrectionProgress | null
): Promise<void> {
  if (
    progress &&
    (progress.user_id !== command.user_id ||
      progress.word_id !== command.word_id)
  ) {
    throw new Error('Foreign correction progress')
  }
  const db = await getDatabase()
  await db.withExclusiveTransactionAsync(async transaction => {
    const existing = await transaction.getFirstAsync<LocalReviewCorrection>(
      'SELECT * FROM review_corrections WHERE user_id = ? AND correction_id = ?',
      [command.user_id, command.correction_id]
    )
    if (!existing || !sameReviewCorrectionCommand(existing, command)) {
      throw new Error('Correction changed before resolution')
    }
    if (existing.resolved_at) return
    if (existing.status === 'pending') {
      throw new Error('Retry the pending correction before resolving it')
    }
    // Retain the exact intent and rejection; a resolution is not an acknowledgement.
    // A receipt found during refresh may already have changed status to synced.
    await transaction.runAsync(
      'UPDATE review_corrections SET resolved_at = ? WHERE user_id = ? AND correction_id = ?',
      new Date().toISOString(),
      command.user_id,
      command.correction_id
    )
    await transaction.runAsync(
      `DELETE FROM learning_commands WHERE operation_id = ? AND kind = 'correction'
       AND user_id = ? AND word_id = ?`,
      command.correction_id,
      command.user_id,
      command.word_id
    )
    if (!progress) return
    // Preserve subsequent offline answers/resets and local word metadata. Only
    // confirmed SRS is replaced, in the same transaction that releases the queue.
    await transaction.runAsync(
      `UPDATE words SET interval_days = ?, repetition_count = ?, easiness_factor = ?,
         next_review_date = ?, last_reviewed_at = ?
       WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM learning_commands
           WHERE word_id = ? AND user_id = ?)`,
      progress.interval_days,
      progress.repetition_count,
      progress.easiness_factor,
      progress.next_review_date,
      progress.last_reviewed_at,
      command.word_id,
      command.user_id,
      command.word_id,
      command.user_id
    )
  })
}
