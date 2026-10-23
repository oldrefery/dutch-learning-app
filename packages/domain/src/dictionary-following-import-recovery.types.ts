import type { DictionaryImportIntentV2 } from './dictionary-following-import'

export interface DictionaryImportCancellationV2 {
  protocol_version: 2
  operation_id: string
  original_intent: DictionaryImportIntentV2
}

export interface DictionaryImportRecoveryV2 extends DictionaryImportCancellationV2 {
  expected_recovery_version: number
  expected_collection_id: string | null
  target_collection_id: string
}

export interface DictionaryImportRecoveryStateV2 {
  protocol_version: 2
  original_operation_id: string
  word_id: string
  recovery_version: number
  inserted_once: boolean
  state: 'uncreated' | 'active' | 'unavailable' | 'cancelled'
  collection_id: string | null
}

interface RecoveryIdentity {
  protocol_version: 2
  operation_id: string
  original_operation_id: string
  word_id: string
  target_collection_id: string
}

export type DictionaryImportRecoveryReceiptV2 = RecoveryIdentity & {
  recovery_version: number
  idempotent: boolean
} & (
    | { outcome: 'applied'; existing_word_id: null }
    | { outcome: 'identity-conflict'; existing_word_id: string }
  )

export type DictionaryImportRecoveryResultV2 =
  | DictionaryImportRecoveryReceiptV2
  | (RecoveryIdentity & {
      outcome: 'state-conflict' | 'placement-conflict'
      state: DictionaryImportRecoveryStateV2
    })

export interface DictionaryImportCancellationReceiptV2 {
  protocol_version: 2
  operation_id: string
  original_operation_id: string
  word_id: string
  outcome: 'cancelled'
  recovery_version: number
  idempotent: boolean
}
