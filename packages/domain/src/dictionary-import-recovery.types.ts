import type { DictionaryImportIntent } from './dictionary-import'

export interface DictionaryImportCancellation {
  protocol_version: 1
  operation_id: string
  original_intent: DictionaryImportIntent
}

export interface DictionaryImportRecovery extends DictionaryImportCancellation {
  expected_recovery_version: number
  expected_collection_id: string | null
  target_collection_id: string
}

export interface DictionaryImportRecoveryState {
  protocol_version: 1
  original_operation_id: string
  word_id: string
  recovery_version: number
  inserted_once: boolean
  state: 'uncreated' | 'active' | 'unavailable' | 'cancelled'
  collection_id: string | null
}

interface RecoveryIdentity {
  protocol_version: 1
  operation_id: string
  original_operation_id: string
  word_id: string
  target_collection_id: string
}

export type DictionaryImportRecoveryReceipt = RecoveryIdentity & {
  recovery_version: number
  idempotent: boolean
} & (
    | { outcome: 'applied'; existing_word_id: null }
    | { outcome: 'identity-conflict'; existing_word_id: string }
  )

export type DictionaryImportRecoveryResult =
  | DictionaryImportRecoveryReceipt
  | (RecoveryIdentity & {
      outcome: 'state-conflict' | 'placement-conflict'
      state: DictionaryImportRecoveryState
    })

export interface DictionaryImportCancellationReceipt {
  protocol_version: 1
  operation_id: string
  original_operation_id: string
  word_id: string
  outcome: 'cancelled'
  recovery_version: number
  idempotent: boolean
}
