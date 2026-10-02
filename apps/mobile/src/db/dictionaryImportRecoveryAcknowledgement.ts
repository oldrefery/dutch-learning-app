import {
  parseDictionaryImportRecoveryResult,
  type DictionaryImportRecovery,
  type DictionaryImportRecoveryResult,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'
import {
  changed,
  requireQueued,
  retireOutboxes,
} from './dictionaryImportRecoveryStorage'

export async function acceptDictionaryImportRecovery(
  userId: string,
  request: DictionaryImportRecovery,
  value: DictionaryImportRecoveryResult,
  assertOwner: () => void
): Promise<void> {
  const result = parseDictionaryImportRecoveryResult(value, request)
  const db = await getDatabase()
  await db.withExclusiveTransactionAsync(async transaction => {
    assertOwner()
    const { row, delivery } = await requireQueued(
      transaction,
      userId,
      request,
      'recovery'
    )
    const word = await transaction.getFirstAsync<{ collection_id: string }>(
      'SELECT collection_id FROM words WHERE user_id = ? AND word_id = ? AND deleted_at IS NULL',
      [userId, request.original_intent.word_id]
    )
    if (
      delivery.cancelled ||
      !word ||
      word.collection_id !== request.target_collection_id ||
      delivery.local_placement_revision !== row.placement_revision
    )
      changed()
    const serverVersion =
      'recovery_version' in result
        ? result.recovery_version
        : result.state.recovery_version
    await transaction.runAsync(
      `UPDATE dictionary_import_delivery SET recovery_version = MAX(COALESCE(recovery_version,0),?)
       WHERE user_id = ? AND word_id = ?`,
      serverVersion,
      userId,
      request.original_intent.word_id
    )
    if (result.outcome === 'applied') {
      await transaction.runAsync(
        `UPDATE dictionary_import_delivery SET acknowledged_placement_revision = ?
         WHERE user_id = ? AND word_id = ?`,
        row.placement_revision,
        userId,
        request.original_intent.word_id
      )
      await retireOutboxes(transaction, userId, request)
    } else {
      await transaction.runAsync(
        `UPDATE dictionary_import_recovery_outbox SET status = ?,server_state_json = ?
         WHERE user_id = ? AND operation_id = ?`,
        result.outcome,
        'state' in result ? JSON.stringify(result.state) : null,
        userId,
        request.operation_id
      )
    }
    assertOwner()
  })
}
