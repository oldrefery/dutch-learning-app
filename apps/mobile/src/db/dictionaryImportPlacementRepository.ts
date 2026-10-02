import type { SQLiteDatabase } from 'expo-sqlite'
import { parseDictionaryImportRecovery } from '@woordenaar/domain'
import {
  persistOutbox,
  requireOrigin,
  type ImportDelivery,
} from './dictionaryImportRecoveryStorage'

export async function recordExplicitImportMove(
  transaction: SQLiteDatabase,
  userId: string,
  wordId: string,
  expectedCollectionId: string | null,
  targetCollectionId: string,
  operationId: string
): Promise<void> {
  const delivery = await transaction.getFirstAsync<ImportDelivery>(
    'SELECT * FROM dictionary_import_delivery WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  if (!delivery) return
  const pending = await transaction.getFirstAsync<{ word_id: string }>(
    `SELECT word_id FROM dictionary_import_intents WHERE user_id = ? AND word_id = ?
     UNION ALL SELECT word_id FROM dictionary_import_recovery_outbox WHERE user_id = ? AND word_id = ?`,
    [userId, wordId, userId, wordId]
  )
  if (
    pending ||
    delivery.cancelled ||
    delivery.original_intent_json === null ||
    delivery.recovery_version === null ||
    delivery.acknowledged_placement_revision !==
      delivery.local_placement_revision
  )
    throw new Error(
      'Open Saved imports to recover placement. Your card and learning history remain saved.'
    )
  const request = parseDictionaryImportRecovery({
    protocol_version: 1,
    operation_id: operationId,
    original_intent: requireOrigin(delivery),
    expected_recovery_version: delivery.recovery_version,
    expected_collection_id: expectedCollectionId,
    target_collection_id: targetCollectionId,
  })
  const revision = delivery.local_placement_revision + 1
  await transaction.runAsync(
    `UPDATE dictionary_import_delivery SET local_placement_revision = local_placement_revision + 1
    WHERE user_id = ? AND word_id = ? AND cancelled = 0`,
    userId,
    wordId
  )
  await persistOutbox(
    transaction,
    userId,
    request,
    revision,
    new Date().toISOString()
  )
}
