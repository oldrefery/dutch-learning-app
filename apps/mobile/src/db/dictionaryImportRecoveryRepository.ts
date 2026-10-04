import {
  parseDictionaryImportRecovery,
  type DictionaryImportRecovery,
  type DictionaryImportCancellation,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'
import {
  changed,
  loadDelivery,
  loadOutbox,
  parseRecoveryRow,
  persistOutbox,
  requireBinding,
  requireQueued,
  type RecoveryRow,
} from './dictionaryImportRecoveryStorage'

export const dictionaryImportRecoveryRepository = {
  async getPending(userId: string) {
    const db = await getDatabase()
    const rows = await db.getAllAsync<RecoveryRow>(
      `SELECT outbox.* FROM dictionary_import_recovery_outbox outbox
       JOIN words ON words.word_id = outbox.word_id AND words.user_id = outbox.user_id
       WHERE outbox.user_id = ? AND (outbox.kind = 'cancel' OR words.deleted_at IS NULL)
       ORDER BY sequence`,
      [userId]
    )
    return rows.map(row => ({ ...row, request: parseRecoveryRow(row) }))
  },

  async prepare(
    userId: string,
    value: DictionaryImportRecovery,
    previousOperationId: string | null,
    assertOwner: () => void,
    expectedLocalRevision?: number
  ): Promise<void> {
    const request = parseDictionaryImportRecovery(value)
    const wordId = request.original_intent.word_id
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const delivery = await loadDelivery(transaction, userId, wordId)
      requireBinding(delivery, request)
      if (delivery.cancelled) changed()
      if (
        expectedLocalRevision !== undefined &&
        delivery.local_placement_revision !== expectedLocalRevision
      )
        changed()
      const previous = await loadOutbox(transaction, userId, wordId)
      if (
        (previous?.operation_id ?? null) !== previousOperationId ||
        previous?.kind === 'cancel'
      )
        changed()
      const word = await transaction.getFirstAsync<{ word_id: string }>(
        `SELECT word_id FROM words WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL`,
        [userId, wordId]
      )
      const target = await transaction.getFirstAsync<{ collection_id: string }>(
        `SELECT collection_id FROM collections WHERE user_id = ? AND collection_id = ?
         AND COALESCE(sync_status,'synced') <> 'deleted'`,
        [userId, request.target_collection_id]
      )
      if (!word || !target) changed()
      const revision = delivery.local_placement_revision + 1
      const now = new Date().toISOString()
      await transaction.runAsync(
        `UPDATE dictionary_import_delivery SET local_placement_revision = ?
         WHERE user_id = ? AND word_id = ?`,
        revision,
        userId,
        wordId
      )
      await persistOutbox(transaction, userId, request, revision, now)
      await transaction.runAsync(
        `UPDATE words SET collection_id = ?,updated_at = ?,sync_status = 'pending'
         WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL`,
        request.target_collection_id,
        now,
        userId,
        wordId
      )
      assertOwner()
    })
  },

  async markError(
    userId: string,
    request: DictionaryImportRecovery | DictionaryImportCancellation,
    message: string,
    assertOwner: () => void
  ): Promise<void> {
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      await requireQueued(
        transaction,
        userId,
        request,
        'target_collection_id' in request ? 'recovery' : 'cancel'
      )
      await transaction.runAsync(
        `UPDATE dictionary_import_recovery_outbox SET status = 'error',last_error = ?
         WHERE user_id = ? AND operation_id = ?`,
        message,
        userId,
        request.operation_id
      )
      assertOwner()
    })
  },
}
