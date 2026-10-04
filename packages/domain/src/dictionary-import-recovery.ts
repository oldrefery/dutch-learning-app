import {
  parseDictionaryImportIntent,
  type DictionaryImportIntent,
} from './dictionary-import'
import type {
  DictionaryImportCancellation,
  DictionaryImportCancellationReceipt,
  DictionaryImportRecovery,
  DictionaryImportRecoveryResult,
  DictionaryImportRecoveryState,
} from './dictionary-import-recovery.types'

export type * from './dictionary-import-recovery.types'

const identityKeys = [
  'protocol_version',
  'operation_id',
  'original_operation_id',
  'word_id',
]
const requestKeys = ['protocol_version', 'operation_id', 'original_intent']
const invalid = (): never => {
  throw new Error('Invalid dictionary import recovery contract')
}
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
const placement = (value: unknown) => value === null || uuid(value)
const sameId = (value: unknown, expected: string) =>
  uuid(value) && value.toLowerCase() === expected.toLowerCase()
const version = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 2147483647

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return invalid()
  return value as Record<string, unknown>
}

function exact(value: Record<string, unknown>, expected: string[]): void {
  if (
    Object.keys(value).length !== expected.length ||
    !expected.every(key => Object.hasOwn(value, key)) ||
    value.protocol_version !== 1
  )
    invalid()
}

function request(value: Record<string, unknown>): DictionaryImportCancellation {
  const intent = parseDictionaryImportIntent(value.original_intent)
  if (
    !uuid(value.operation_id) ||
    sameId(value.operation_id, intent.operation_id)
  )
    return invalid()
  return {
    protocol_version: 1,
    operation_id: value.operation_id,
    original_intent: intent,
  }
}

export function parseDictionaryImportCancellation(
  value: unknown
): DictionaryImportCancellation {
  const input = object(value)
  exact(input, requestKeys)
  return request(input)
}

export function parseDictionaryImportRecovery(
  value: unknown
): DictionaryImportRecovery {
  const input = object(value)
  exact(input, [
    ...requestKeys,
    'expected_recovery_version',
    'expected_collection_id',
    'target_collection_id',
  ])
  const base = request(input)
  if (
    !version(input.expected_recovery_version) ||
    !placement(input.expected_collection_id) ||
    !uuid(input.target_collection_id)
  )
    return invalid()
  return {
    ...base,
    expected_recovery_version: input.expected_recovery_version,
    expected_collection_id: input.expected_collection_id as string | null,
    target_collection_id: input.target_collection_id,
  }
}

function bound(
  value: Record<string, unknown>,
  intent: DictionaryImportIntent,
  operation?: string
): void {
  if (
    !sameId(value.original_operation_id, intent.operation_id) ||
    !sameId(value.word_id, intent.word_id) ||
    (operation !== undefined && !sameId(value.operation_id, operation))
  )
    invalid()
}

export function parseDictionaryImportRecoveryState(
  value: unknown,
  intent: DictionaryImportIntent
): DictionaryImportRecoveryState {
  const input = object(value)
  exact(input, [
    'protocol_version',
    'original_operation_id',
    'word_id',
    'recovery_version',
    'inserted_once',
    'state',
    'collection_id',
  ])
  bound(input, intent)
  if (
    !version(input.recovery_version) ||
    typeof input.inserted_once !== 'boolean' ||
    !placement(input.collection_id) ||
    typeof input.state !== 'string' ||
    !['uncreated', 'active', 'unavailable', 'cancelled'].includes(input.state)
  )
    return invalid()
  if (
    ((input.state === 'active' || input.state === 'unavailable') &&
      !input.inserted_once) ||
    (input.state === 'uncreated' && input.inserted_once) ||
    ((input.state === 'uncreated' || input.state === 'unavailable') &&
      input.collection_id !== null) ||
    (input.state === 'cancelled' &&
      (input.recovery_version === 0 ||
        (!input.inserted_once && input.collection_id !== null)))
  )
    return invalid()
  return input as unknown as DictionaryImportRecoveryState
}

export function parseDictionaryImportRecoveryResult(
  value: unknown,
  request: DictionaryImportRecovery
): DictionaryImportRecoveryResult {
  const input = object(value)
  bound(input, request.original_intent, request.operation_id)
  if (!sameId(input.target_collection_id, request.target_collection_id))
    return invalid()
  if (
    input.outcome === 'state-conflict' ||
    input.outcome === 'placement-conflict'
  ) {
    exact(input, [...identityKeys, 'target_collection_id', 'outcome', 'state'])
    const state = parseDictionaryImportRecoveryState(
      input.state,
      request.original_intent
    )
    if (
      state.state === 'cancelled' ||
      (input.outcome === 'state-conflict' &&
        state.recovery_version === request.expected_recovery_version) ||
      (input.outcome === 'placement-conflict' &&
        (state.state !== 'active' ||
          state.recovery_version !== request.expected_recovery_version ||
          state.collection_id === request.expected_collection_id))
    )
      return invalid()
    return input as unknown as DictionaryImportRecoveryResult
  }
  exact(input, [
    ...identityKeys,
    'target_collection_id',
    'outcome',
    'existing_word_id',
    'recovery_version',
    'idempotent',
  ])
  if (
    !version(input.recovery_version) ||
    input.recovery_version !== request.expected_recovery_version + 1 ||
    typeof input.idempotent !== 'boolean' ||
    !(
      (input.outcome === 'applied' && input.existing_word_id === null) ||
      (input.outcome === 'identity-conflict' &&
        uuid(input.existing_word_id) &&
        !sameId(input.existing_word_id, request.original_intent.word_id))
    )
  )
    return invalid()
  return input as unknown as DictionaryImportRecoveryResult
}

export function parseDictionaryImportCancellationReceipt(
  value: unknown,
  request: DictionaryImportCancellation
): DictionaryImportCancellationReceipt {
  const input = object(value)
  exact(input, [...identityKeys, 'outcome', 'recovery_version', 'idempotent'])
  bound(input, request.original_intent, request.operation_id)
  if (
    input.outcome !== 'cancelled' ||
    !version(input.recovery_version) ||
    input.recovery_version < 1 ||
    typeof input.idempotent !== 'boolean'
  )
    return invalid()
  return input as unknown as DictionaryImportCancellationReceipt
}
