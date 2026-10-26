import { getDatabase } from './initDB'

/** Read durable learning work without acknowledging or repairing any queue. */
export async function getLearningSyncStatusWordIds(userId: string): Promise<{
  uploadWordIds: string[]
  downloadWordIds: string[]
}> {
  const db = await getDatabase()
  const [uploads, downloads] = await Promise.all([
    db.getAllAsync<{ word_id: string }>(
      `SELECT word_id FROM learning_commands WHERE user_id = ?
       UNION SELECT e.word_id FROM review_events e JOIN words w
         ON w.word_id = e.word_id AND w.user_id = e.user_id
         WHERE e.user_id = ? AND e.sync_status != 'synced' AND w.deleted_at IS NULL
       UNION SELECT r.word_id FROM review_corrections r JOIN words w
         ON w.word_id = r.word_id AND w.user_id = r.user_id
         WHERE r.user_id = ? AND r.status != 'synced'
           AND r.resolved_at IS NULL AND w.deleted_at IS NULL`,
      [userId, userId, userId]
    ),
    db.getAllAsync<{ word_id: string }>(
      `SELECT DISTINCT word_id FROM review_correction_recovery
       WHERE user_id = ?`,
      [userId]
    ),
  ])
  return {
    uploadWordIds: uploads.map(row => row.word_id),
    downloadWordIds: downloads.map(row => row.word_id),
  }
}
