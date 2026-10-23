import {
  parseDictionaryImportIntentV2,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import {
  OWNER_A,
  WORD_A,
  ENTRY,
  REVISION_1,
} from './dictionaryFollowing.fixture'

export const IMPORT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
export const RECOVERY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
export const CANCEL_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
export const COLLECTION_ID = '12121212-1212-4121-8121-121212121212'
export const TARGET_ID = '13131313-1313-4131-8131-131313131313'
export const importOperation = (): FollowingImportOperation => ({
  user_id: OWNER_A,
  kind: 'import',
  result: null,
  request: parseDictionaryImportIntentV2({
    protocol_version: 2,
    operation_id: IMPORT_ID,
    word_id: WORD_A,
    collection_id: COLLECTION_ID,
    source: {
      kind: 'published-reference',
      reference: { entry_id: ENTRY, revision_id: REVISION_1 },
      content_sha256: 'a'.repeat(64),
    },
  }),
})
export const importReceipt = () => ({
  protocol_version: 2,
  operation_id: IMPORT_ID,
  word_id: WORD_A,
  idempotent: false,
  outcome: 'inserted',
  existing_word_id: null,
  reference: { entry_id: ENTRY, revision_id: REVISION_1 },
  applied_reference: { entry_id: ENTRY, revision_id: REVISION_1 },
  applied_head_sequence: '9007199254740993',
})
export const importState = (inserted = false) => ({
  protocol_version: 2,
  original_operation_id: IMPORT_ID,
  word_id: WORD_A,
  recovery_version: 0,
  inserted_once: inserted,
  state: inserted ? 'active' : 'uncreated',
  collection_id: inserted ? COLLECTION_ID : null,
})
export const recoveryOperation = (
  inserted = false
): FollowingImportOperation => ({
  user_id: OWNER_A,
  kind: 'recover',
  result: null,
  request: {
    protocol_version: 2,
    operation_id: RECOVERY_ID,
    original_intent: importOperation().request as ReturnType<
      typeof parseDictionaryImportIntentV2
    >,
    expected_recovery_version: 0,
    expected_collection_id: inserted ? COLLECTION_ID : null,
    target_collection_id: TARGET_ID,
  },
})
export const cancellationOperation = (): FollowingImportOperation => ({
  user_id: OWNER_A,
  kind: 'cancel',
  result: null,
  request: {
    protocol_version: 2,
    operation_id: CANCEL_ID,
    original_intent: importOperation().request as ReturnType<
      typeof parseDictionaryImportIntentV2
    >,
  },
})
export const recoveryReceipt = () => ({
  protocol_version: 2,
  operation_id: RECOVERY_ID,
  original_operation_id: IMPORT_ID,
  word_id: WORD_A,
  target_collection_id: TARGET_ID,
  recovery_version: 1,
  idempotent: false,
  outcome: 'applied',
  existing_word_id: null,
})
export const cancellationReceipt = () => ({
  protocol_version: 2,
  operation_id: CANCEL_ID,
  original_operation_id: IMPORT_ID,
  word_id: WORD_A,
  recovery_version: 1,
  idempotent: false,
  outcome: 'cancelled',
})
export const importCapability = () => ({
  dictionary_content_protocol: 2,
  read_protocol_versions: [1, 2],
  command_protocol_versions: [1, 2],
  following_enabled: true,
  shared_analysis_enabled: false,
})
