import type { SQLiteDatabase } from 'expo-sqlite'
import {
  parseDictionaryImportIntent,
  parseDictionaryImportReceipt,
  type DictionaryImportIntent,
  type DictionaryImportReceipt,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'

export interface LocalDictionaryImport {
  userId: string
  intent: DictionaryImportIntent
  status: 'pending' | 'error' | 'conflict'
  existingWordId: string | null
  lastError: string | null
}

export const dictionaryImportRepository = {
  async enqueue(
    transaction: SQLiteDatabase,
    userId: string,
    value: DictionaryImportIntent,
    queuedAt: string
  ): Promise<void> {
    const intent = parseDictionaryImportIntent(value)
    await transaction.runAsync(
      `INSERT INTO dictionary_import_intents(operation_id, user_id, word_id,
        payload_json, queued_at) VALUES (?, ?, ?, ?, ?)`,
      intent.operation_id,
      userId,
      intent.word_id,
      JSON.stringify(intent),
      queuedAt
    )
  },

  async getPending(userId: string): Promise<LocalDictionaryImport[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{
      user_id: string
      payload_json: string
      status: LocalDictionaryImport['status']
      existing_word_id: string | null
      last_error: string | null
    }>(
      `SELECT intents.user_id, payload_json, status, existing_word_id, last_error
        FROM dictionary_import_intents intents JOIN words
          ON words.word_id = intents.word_id AND words.user_id = intents.user_id
        WHERE intents.user_id = ? AND words.deleted_at IS NULL ORDER BY sequence`,
      [userId]
    )
    return rows.map(row => ({
      userId: row.user_id,
      intent: parseDictionaryImportIntent(
        JSON.parse(row.payload_json) as unknown
      ),
      status: row.status,
      existingWordId: row.existing_word_id,
      lastError: row.last_error,
    }))
  },

  async acceptReceipt(
    userId: string,
    intent: DictionaryImportIntent,
    value: DictionaryImportReceipt
  ): Promise<void> {
    const receipt = parseDictionaryImportReceipt(value, intent)
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      const row = await transaction.getFirstAsync<{ payload_json: string }>(
        `SELECT payload_json FROM dictionary_import_intents
         WHERE user_id = ? AND operation_id = ? AND word_id = ?`,
        [userId, intent.operation_id, intent.word_id]
      )
      if (
        !row ||
        JSON.stringify(
          parseDictionaryImportIntent(JSON.parse(row.payload_json) as unknown)
        ) !== JSON.stringify(intent)
      ) {
        throw new Error(
          'Dictionary import intent changed before acknowledgement'
        )
      }
      if (receipt.outcome === 'identity-conflict') {
        await transaction.runAsync(
          `UPDATE dictionary_import_intents SET status = 'conflict', existing_word_id = ?,
           last_error = 'Personal word identity conflict. All local content and learning queues are preserved.'
           WHERE user_id = ? AND operation_id = ?`,
          receipt.existing_word_id,
          userId,
          intent.operation_id
        )
      } else {
        // Keep word metadata pending: learning and later moves/edits may have changed.
        await transaction.runAsync(
          `DELETE FROM dictionary_import_intents WHERE user_id = ? AND operation_id = ?`,
          userId,
          intent.operation_id
        )
      }
    })
  },

  async markError(
    userId: string,
    operationId: string,
    message: string
  ): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `UPDATE dictionary_import_intents SET status = 'error', last_error = ?
       WHERE user_id = ? AND operation_id = ? AND status <> 'conflict'`,
      message,
      userId,
      operationId
    )
  },

  async retryConflict(
    userId: string,
    previous: DictionaryImportIntent,
    nextOperationId: string
  ): Promise<void> {
    const next = parseDictionaryImportIntent({
      ...previous,
      operation_id: nextOperationId,
    })
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      const row = await transaction.getFirstAsync<{ payload_json: string }>(
        `SELECT payload_json FROM dictionary_import_intents WHERE user_id = ?
         AND operation_id = ? AND word_id = ? AND status = 'conflict'
         AND EXISTS (SELECT 1 FROM words WHERE words.word_id = dictionary_import_intents.word_id
           AND words.user_id = dictionary_import_intents.user_id AND words.deleted_at IS NULL)`,
        [userId, previous.operation_id, previous.word_id]
      )
      if (
        !row ||
        JSON.stringify(
          parseDictionaryImportIntent(JSON.parse(row.payload_json) as unknown)
        ) !== JSON.stringify(previous)
      ) {
        throw new Error('Import conflict changed. Reload the word.')
      }
      await transaction.runAsync(
        `UPDATE dictionary_import_intents SET operation_id = ?, payload_json = ?,
         status = 'pending', existing_word_id = NULL, last_error = NULL
         WHERE user_id = ? AND operation_id = ?`,
        next.operation_id,
        JSON.stringify(next),
        userId,
        previous.operation_id
      )
    })
  },
}
