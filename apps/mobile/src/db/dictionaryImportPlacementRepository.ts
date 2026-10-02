import type { SQLiteDatabase } from 'expo-sqlite'

export async function recordExplicitImportMove(
  transaction: SQLiteDatabase,
  userId: string,
  wordId: string
): Promise<void> {
  const delivery = await transaction.getFirstAsync<{
    original_intent_json: string | null
    acknowledged_placement_revision: number | null
  }>(
    'SELECT original_intent_json,acknowledged_placement_revision FROM dictionary_import_delivery WHERE user_id = ? AND word_id = ?',
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
    delivery.original_intent_json === null ||
    delivery.acknowledged_placement_revision === null
  )
    throw new Error(
      'Import placement needs recovery. Your card and learning history remain saved.'
    )
  await transaction.runAsync(
    `UPDATE dictionary_import_delivery SET local_placement_revision = local_placement_revision + 1
    WHERE user_id = ? AND word_id = ? AND cancelled = 0`,
    userId,
    wordId
  )
}
