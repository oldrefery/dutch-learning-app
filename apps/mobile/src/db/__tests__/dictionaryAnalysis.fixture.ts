import type {
  DictionaryAnalysisClientOperation,
  DictionaryAnalysisReceiptV2,
  DictionaryAnalysisStatus,
} from '@woordenaar/domain'
import {
  ENTRY,
  OWNER_A,
  WORD_A,
  REVISION_1,
  REVISION_2,
} from './dictionaryFollowing.fixture'

export const ANALYSIS_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
export const NEXT_ANALYSIS_ID = 'dededede-dede-4ede-8ede-dededededede'
export const analysisIntent = (): DictionaryAnalysisClientOperation => ({
  user_id: OWNER_A,
  word_id: WORD_A,
  submitted: false,
  response: null,
  command: {
    protocol_version: 2,
    operation_id: ANALYSIS_ID,
    entry_id: ENTRY,
    expected_revision_id: REVISION_1,
    expected_head_sequence: '9007199254740993',
  },
})
export const analysisReceipt = (
  status: DictionaryAnalysisStatus = 'published'
): DictionaryAnalysisReceiptV2 => ({
  ...analysisIntent().command,
  fence: '9007199254740997',
  status,
  quota_charged: true,
  result_sha256: ['accepted', 'dispatching'].includes(status)
    ? null
    : 'a'.repeat(64),
  error_code: [
    'accepted',
    'dispatching',
    'validating',
    'published',
    'no-change',
  ].includes(status)
    ? null
    : 'provider-outcome-unknown',
  published_revision_id:
    status === 'published'
      ? REVISION_2
      : status === 'no-change'
        ? REVISION_1
        : null,
  published_head_sequence:
    status === 'published'
      ? '9007199254740994'
      : status === 'no-change'
        ? '9007199254740993'
        : null,
})
