import { getDatabase } from './initDB'
import type { ImportDelivery } from './dictionaryImportRecoveryStorage'

export const dictionaryImportDeliveryRepository = {
  async getAll(userId: string): Promise<ImportDelivery[]> {
    const db = await getDatabase()
    return db.getAllAsync<ImportDelivery>(
      'SELECT * FROM dictionary_import_delivery WHERE user_id = ?',
      [userId]
    )
  },
  async getDebtWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT d.word_id FROM dictionary_import_delivery d JOIN words w ON w.word_id = d.word_id
       AND w.user_id = d.user_id WHERE d.user_id = ? AND (
         (w.deleted_at IS NULL AND (d.local_placement_revision > d.acknowledged_placement_revision
          OR (d.acknowledged_placement_revision IS NULL AND w.sync_status = 'pending')))
         OR (w.deleted_at IS NOT NULL AND w.sync_status = 'deleted' AND d.original_intent_json IS NOT NULL AND d.cancelled = 0))`,
      [userId]
    )
    return rows.map(row => row.word_id)
  },
  async acknowledgePlacement(
    userId: string,
    wordId: string,
    revision: number,
    target: string | null,
    assertOwner: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const result = await transaction.runAsync(
        `UPDATE dictionary_import_delivery SET acknowledged_placement_revision = ?
      WHERE user_id = ? AND word_id = ? AND local_placement_revision = ? AND cancelled = 0
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = dictionary_import_delivery.word_id)
      AND EXISTS (SELECT 1 FROM words w WHERE w.word_id = dictionary_import_delivery.word_id
        AND w.user_id = ? AND w.deleted_at IS NULL AND w.collection_id IS ?)`,
        revision,
        userId,
        wordId,
        revision,
        userId,
        target
      )
      if (result.changes !== 1)
        throw new Error('Import placement changed before acknowledgement')
      assertOwner()
    })
  },
  async hydrateDeliveredPlacement(
    userId: string,
    wordId: string,
    revision: number,
    target: string | null,
    assertOwner: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const result = await transaction.runAsync(
        `UPDATE words SET collection_id = ? WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM dictionary_import_delivery d WHERE d.word_id = words.word_id
        AND d.user_id = words.user_id AND d.cancelled = 0 AND d.local_placement_revision = ?
        AND d.acknowledged_placement_revision = ?)
      AND NOT EXISTS (SELECT 1 FROM dictionary_import_recovery_outbox r WHERE r.word_id = words.word_id)`,
        target,
        userId,
        wordId,
        revision,
        revision
      )
      if (result.changes !== 1)
        throw new Error('Import placement changed before acknowledgement')
      assertOwner()
    })
  },
}
