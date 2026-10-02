import type { SQLiteDatabase } from 'expo-sqlite'
import {
  parseDictionaryImportCancellation,
  parseDictionaryImportCancellationReceipt,
  type DictionaryImportCancellation,
  type DictionaryImportCancellationReceipt,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'
import {
  changed,
  loadDelivery,
  loadOutbox,
  parseRecoveryRow,
  persistOutbox,
  requireOrigin,
  requireQueued,
  retireOutboxes,
} from './dictionaryImportRecoveryStorage'

export async function prepareDictionaryImportCancellation(
  transaction: SQLiteDatabase,
  userId: string,
  wordId: string,
  operationId: string
): Promise<DictionaryImportCancellation> {
  const delivery = await loadDelivery(transaction, userId, wordId)
  if (delivery.cancelled) changed()
  const existing = await loadOutbox(transaction, userId, wordId)
  if (existing?.kind === 'cancel') return parseRecoveryRow(existing)
  const request = parseDictionaryImportCancellation({
    protocol_version: 1,
    operation_id: operationId,
    original_intent: requireOrigin(delivery),
  })
  const word = await transaction.getFirstAsync<{ word_id: string }>(
    'SELECT word_id FROM words WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  if (!word) changed()
  const now = new Date().toISOString()
  await persistOutbox(transaction, userId, request, null, now)
  await transaction.runAsync(
    `UPDATE words SET deleted_at = COALESCE(deleted_at,?),updated_at = ?,sync_status = 'deleted'
     WHERE user_id = ? AND word_id = ?`,
    now,
    now,
    userId,
    wordId
  )
  return request
}

export const dictionaryImportCancellationRepository = {
  async prepare(
    userId: string,
    wordId: string,
    operationId: string,
    assertOwner: () => void
  ): Promise<DictionaryImportCancellation> {
    const [result] = await this.prepareMany(
      userId,
      [{ wordId, operationId }],
      assertOwner
    )
    return result
  },

  async prepareMany(
    userId: string,
    inputs: readonly { wordId: string; operationId: string }[],
    assertOwner: () => void
  ): Promise<DictionaryImportCancellation[]> {
    const db = await getDatabase()
    const requests: DictionaryImportCancellation[] = []
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      for (const input of inputs) {
        requests.push(
          await prepareDictionaryImportCancellation(
            transaction,
            userId,
            input.wordId,
            input.operationId
          )
        )
      }
      assertOwner()
    })
    return requests
  },

  async accept(
    userId: string,
    request: DictionaryImportCancellation,
    value: DictionaryImportCancellationReceipt,
    assertOwner: () => void
  ): Promise<void> {
    const receipt = parseDictionaryImportCancellationReceipt(value, request)
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      await requireQueued(transaction, userId, request, 'cancel')
      const word = await transaction.getFirstAsync<{ word_id: string }>(
        'SELECT word_id FROM words WHERE user_id = ? AND word_id = ? AND deleted_at IS NOT NULL',
        [userId, request.original_intent.word_id]
      )
      if (!word) changed()
      await transaction.runAsync(
        `UPDATE dictionary_import_delivery SET cancelled = 1,
         recovery_version = MAX(COALESCE(recovery_version,0),?) WHERE user_id = ? AND word_id = ?`,
        receipt.recovery_version,
        userId,
        request.original_intent.word_id
      )
      await retireOutboxes(transaction, userId, request)
      // Normal tombstone delivery and every learning/content queue remain pending.
      assertOwner()
    })
  },
}
