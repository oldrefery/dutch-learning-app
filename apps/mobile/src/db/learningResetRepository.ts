import { getDatabase } from './initDB'

export interface PendingLearningReset {
  sequence: number
  operation_id: string
  word_id: string
  reset_at: string
  review_date: string
}

export const learningResetRepository = {
  async getNext(userId: string): Promise<PendingLearningReset | null> {
    const db = await getDatabase()
    return db.getFirstAsync<PendingLearningReset>(
      `SELECT sequence, operation_id, word_id, reset_at, review_date
       FROM learning_commands WHERE user_id = ? AND kind = 'reset'
       ORDER BY sequence LIMIT 1`,
      [userId]
    )
  },
  async acknowledge(userId: string, operationId: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `DELETE FROM learning_commands
       WHERE user_id = ? AND operation_id = ? AND kind = 'reset'`,
      userId,
      operationId
    )
  },
}
