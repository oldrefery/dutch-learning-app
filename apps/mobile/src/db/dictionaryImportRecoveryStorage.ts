import type { SQLiteDatabase } from 'expo-sqlite'
import {
  parseDictionaryImportCancellation,
  parseDictionaryImportIntent,
  parseDictionaryImportRecovery,
  type DictionaryImportCancellation,
  type DictionaryImportRecovery,
} from '@woordenaar/domain'

export interface ImportDelivery {
  word_id: string
  user_id: string
  original_intent_json: string | null
  local_placement_revision: number
  acknowledged_placement_revision: number | null
  recovery_version: number | null
  cancelled: number
}

export interface RecoveryRow {
  word_id: string
  user_id: string
  operation_id: string
  kind: 'recovery' | 'cancel'
  payload_json: string
  placement_revision: number | null
  status:
    | 'pending'
    | 'error'
    | 'identity-conflict'
    | 'state-conflict'
    | 'placement-conflict'
  last_error: string | null
}

export const changed = (): never => {
  throw new Error('Dictionary import recovery changed. Reload the card.')
}

export function parseRecoveryRow(row: RecoveryRow) {
  const value: unknown = JSON.parse(row.payload_json)
  const request =
    row.kind === 'cancel'
      ? parseDictionaryImportCancellation(value)
      : parseDictionaryImportRecovery(value)
  if (
    request.operation_id !== row.operation_id ||
    request.original_intent.word_id !== row.word_id
  )
    return changed()
  return request
}

export async function loadDelivery(
  db: SQLiteDatabase,
  userId: string,
  wordId: string
): Promise<ImportDelivery> {
  const row = await db.getFirstAsync<ImportDelivery>(
    'SELECT * FROM dictionary_import_delivery WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  if (!row) return changed()
  return row
}

export function requireOrigin(delivery: ImportDelivery) {
  if (delivery.original_intent_json === null)
    throw new Error(
      'Exact import provenance is unavailable. Local data remains saved.'
    )
  const intent = parseDictionaryImportIntent(
    JSON.parse(delivery.original_intent_json) as unknown
  )
  if (intent.word_id !== delivery.word_id) return changed()
  return intent
}

export async function loadOutbox(
  db: SQLiteDatabase,
  userId: string,
  wordId: string
): Promise<RecoveryRow | null> {
  return db.getFirstAsync<RecoveryRow>(
    'SELECT * FROM dictionary_import_recovery_outbox WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
}

export function requireBinding(
  delivery: ImportDelivery,
  request: DictionaryImportCancellation
) {
  const intent = requireOrigin(delivery)
  if (JSON.stringify(intent) !== JSON.stringify(request.original_intent))
    changed()
}

export async function persistOutbox(
  transaction: SQLiteDatabase,
  userId: string,
  request: DictionaryImportRecovery | DictionaryImportCancellation,
  revision: number | null,
  queuedAt: string
) {
  await transaction.runAsync(
    `INSERT INTO dictionary_import_recovery_outbox(
       word_id,user_id,operation_id,kind,payload_json,placement_revision,queued_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(word_id) DO UPDATE SET operation_id = excluded.operation_id,
       kind = excluded.kind,payload_json = excluded.payload_json,
       placement_revision = excluded.placement_revision,status = 'pending',
       server_state_json = NULL,last_error = NULL,queued_at = excluded.queued_at`,
    request.original_intent.word_id,
    userId,
    request.operation_id,
    revision === null ? 'cancel' : 'recovery',
    JSON.stringify(request),
    revision,
    queuedAt
  )
}

export async function requireQueued(
  transaction: SQLiteDatabase,
  userId: string,
  request: DictionaryImportCancellation,
  kind: RecoveryRow['kind']
) {
  const row = await loadOutbox(
    transaction,
    userId,
    request.original_intent.word_id
  )
  if (
    !row ||
    row.kind !== kind ||
    JSON.stringify(parseRecoveryRow(row)) !== JSON.stringify(request)
  )
    return changed()
  const delivery = await loadDelivery(transaction, userId, row.word_id)
  requireBinding(delivery, request)
  return { row, delivery }
}

export async function retireOutboxes(
  transaction: SQLiteDatabase,
  userId: string,
  request: DictionaryImportCancellation
) {
  await transaction.runAsync(
    `INSERT OR IGNORE INTO dictionary_import_acknowledgements(word_id,user_id)
     VALUES (?, ?)`,
    request.original_intent.word_id,
    userId
  )
  await transaction.runAsync(
    'DELETE FROM dictionary_import_intents WHERE user_id = ? AND operation_id = ? AND word_id = ?',
    userId,
    request.original_intent.operation_id,
    request.original_intent.word_id
  )
  await transaction.runAsync(
    'DELETE FROM dictionary_import_recovery_outbox WHERE user_id = ? AND operation_id = ?',
    userId,
    request.operation_id
  )
}
