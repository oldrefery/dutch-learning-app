import { getDatabase } from './initDB'

const READY_WORD = `words.sync_status = 'synced'
  AND NOT EXISTS (SELECT 1 FROM dictionary_content_commands c WHERE c.word_id = words.word_id)
  AND NOT EXISTS (SELECT 1 FROM dictionary_import_intents i WHERE i.word_id = words.word_id AND words.deleted_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM learning_commands l WHERE l.word_id = words.word_id)
  AND NOT EXISTS (SELECT 1 FROM review_correction_recovery r WHERE r.word_id = words.word_id)`

export const dictionaryPersonalRefreshRepository = {
  async getWordIds(userId: string, readyOnly = false): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT queue.word_id FROM dictionary_personal_refresh_queue queue
       JOIN words ON words.word_id = queue.word_id AND words.user_id = queue.user_id
       WHERE queue.user_id = ? AND words.deleted_at IS NULL ${readyOnly ? `AND ${READY_WORD}` : ''}
       ORDER BY queue.word_id`,
      [userId]
    )
    return rows.map(row => row.word_id)
  },

  async acknowledge(userId: string, wordIds: readonly string[]): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const wordId of wordIds) {
        await transaction.runAsync(
          `DELETE FROM dictionary_personal_refresh_queue WHERE user_id = ? AND word_id = ?
           AND EXISTS (SELECT 1 FROM words WHERE words.word_id = dictionary_personal_refresh_queue.word_id
             AND words.user_id = dictionary_personal_refresh_queue.user_id AND ${READY_WORD})`,
          userId,
          wordId
        )
      }
    })
  },
}
