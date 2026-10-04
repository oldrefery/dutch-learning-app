import type { SQLiteDatabase } from 'expo-sqlite'
import { randomUUID } from 'expo-crypto'
import { getDatabase } from './initDB'
import { prepareDictionaryImportCancellation } from './dictionaryImportCancellationRepository'

export async function queueImportDeletion(
  transaction: SQLiteDatabase,
  userId: string,
  wordId: string
): Promise<void> {
  const origin = await transaction.getFirstAsync<{ cancelled: number }>(
    `SELECT cancelled FROM dictionary_import_delivery WHERE user_id = ? AND word_id = ?
     AND original_intent_json IS NOT NULL`,
    [userId, wordId]
  )
  if (origin && !origin.cancelled)
    await prepareDictionaryImportCancellation(
      transaction,
      userId,
      wordId,
      randomUUID()
    )
}

export const dictionaryImportDeletionRepository = {
  async queueRetainedTombstones(
    userId: string,
    assertOwner: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const words = await transaction.getAllAsync<{ word_id: string }>(
        `SELECT w.word_id FROM words w JOIN dictionary_import_delivery d ON d.word_id = w.word_id
         AND d.user_id = w.user_id WHERE w.user_id = ? AND w.deleted_at IS NOT NULL AND w.sync_status = 'deleted'
         AND d.original_intent_json IS NOT NULL AND d.cancelled = 0`,
        [userId]
      )
      for (const word of words)
        await queueImportDeletion(transaction, userId, word.word_id)
      assertOwner()
    })
  },
  async assertSettled(userId: string): Promise<void> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<{ word_id: string }>(
      `SELECT w.word_id FROM words w JOIN dictionary_import_delivery d ON d.word_id = w.word_id
       AND d.user_id = w.user_id WHERE w.user_id = ? AND w.deleted_at IS NOT NULL AND w.sync_status = 'deleted'
       AND d.original_intent_json IS NOT NULL AND d.cancelled = 0 LIMIT 1`,
      [userId]
    )
    if (row)
      throw new Error(
        'Import cancellation is pending. Local cards and queues remain saved.'
      )
  },
  async deleteCollection(
    userId: string,
    collectionId: string,
    assertOwner: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const collection = await transaction.getFirstAsync<{
        collection_id: string
      }>(
        'SELECT collection_id FROM collections WHERE collection_id = ? AND user_id = ?',
        [collectionId, userId]
      )
      if (!collection) throw new Error('Owned collection is unavailable')
      const words = await transaction.getAllAsync<{ word_id: string }>(
        'SELECT word_id FROM words WHERE collection_id = ? AND user_id = ? AND deleted_at IS NULL',
        [collectionId, userId]
      )
      for (const word of words)
        await queueImportDeletion(transaction, userId, word.word_id)
      const now = new Date().toISOString()
      await transaction.runAsync(
        `UPDATE words SET deleted_at = ?,updated_at = ?,sync_status = 'deleted'
        WHERE collection_id = ? AND user_id = ? AND deleted_at IS NULL`,
        now,
        now,
        collectionId,
        userId
      )
      await transaction.runAsync(
        `UPDATE collections SET sync_status = 'deleted',updated_at = ?
        WHERE collection_id = ? AND user_id = ?`,
        now,
        collectionId,
        userId
      )
      assertOwner()
    })
  },
}
