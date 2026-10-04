import { getDatabase } from './initDB'
import type { ImportRecoveryIssue } from '@/types/DictionaryImportRecovery'
import {
  changed,
  loadDelivery,
  loadOutbox,
  type ImportDelivery,
} from './dictionaryImportRecoveryStorage'

interface LocalRecoveryView {
  delivery: ImportDelivery
  previousOperationId: string | null
  collectionId: string | null
}

export const dictionaryImportRecoveryViewRepository = {
  async getIssues(userId: string) {
    const db = await getDatabase()
    return db.getAllAsync<{ word_id: string; issue: ImportRecoveryIssue }>(
      `SELECT d.word_id, CASE
         WHEN d.original_intent_json IS NULL THEN 'unverified'
         WHEN r.status IS NOT NULL THEN r.status
         WHEN i.status = 'conflict' THEN 'identity-conflict'
         WHEN i.status = 'error' THEN 'error'
         WHEN NOT EXISTS (SELECT 1 FROM collections c WHERE c.collection_id = w.collection_id
           AND c.user_id = w.user_id AND COALESCE(c.sync_status,'synced') <> 'deleted') THEN 'target-unavailable'
         ELSE 'pending' END AS issue
       FROM dictionary_import_delivery d
       JOIN words w ON w.word_id = d.word_id AND w.user_id = d.user_id
       LEFT JOIN dictionary_import_intents i ON i.word_id = d.word_id AND i.user_id = d.user_id
       LEFT JOIN dictionary_import_recovery_outbox r ON r.word_id = d.word_id AND r.user_id = d.user_id
       WHERE d.user_id = ? AND w.deleted_at IS NULL AND d.cancelled = 0
         AND (i.word_id IS NOT NULL OR r.word_id IS NOT NULL
           OR d.acknowledged_placement_revision IS NULL
           OR d.local_placement_revision > d.acknowledged_placement_revision
           OR NOT EXISTS (SELECT 1 FROM collections c WHERE c.collection_id = w.collection_id
             AND c.user_id = w.user_id AND COALESCE(c.sync_status,'synced') <> 'deleted'))`,
      [userId]
    )
  },

  async readLocal(userId: string, wordId: string, assertOwner: () => void) {
    const db = await getDatabase()
    let result: LocalRecoveryView | null = null
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const delivery = await loadDelivery(transaction, userId, wordId)
      const outbox = await loadOutbox(transaction, userId, wordId)
      const word = await transaction.getFirstAsync<{
        collection_id: string | null
      }>(
        'SELECT collection_id FROM words WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL',
        [userId, wordId]
      )
      if (!word || delivery.cancelled || outbox?.kind === 'cancel')
        return changed()
      assertOwner()
      result = {
        delivery,
        previousOperationId: outbox?.operation_id ?? null,
        collectionId: word.collection_id,
      }
    })
    if (!result) return changed()
    return result as LocalRecoveryView
  },
}
