import type {
  DictionaryCreationJournalRow,
  DictionaryCreationJournalOwner,
} from './dictionary-creation-journal'
import type { DictionaryCreationReceiptV2 } from './dictionary-creation'

// Synthetic fixtures, no live user/provider identity.
export const CREATION_OWNER = '11111111-1111-4111-8111-111111111111'
export const CREATION_OTHER = '22222222-2222-4222-8222-222222222222'
export const creationUuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`
export const creationJournalFixture = (
  n = 1
): DictionaryCreationJournalRow => ({
  protocol_version: 1,
  owner_epoch: creationUuid(1),
  session_epoch: creationUuid(2),
  adoption: null,
  session: {
    user_id: CREATION_OWNER,
    request: {
      protocol_version: 2,
      resolution_id: creationUuid(1000 + n),
      original_query: '  BANK  ',
      meaning_hint: 'A financial institution.',
    },
    resolution: null,
    command: null,
    submitted: false,
    response: null,
  },
})
export const creationPreparedFixture = (
  row: DictionaryCreationJournalRow,
  recovery = false
): DictionaryCreationJournalRow => ({
  ...row,
  session: {
    ...row.session,
    resolution: {
      ...row.session.request,
      outcome: 'new-meaning',
      resolved_identity_id: creationUuid(3),
      published: null,
      decision_code: null,
    },
    command: {
      protocol_version: 2,
      resolution_id: row.session.request.resolution_id,
      operation_id: creationUuid(
        2000 + Number(row.session.request.resolution_id.slice(-12))
      ),
      ...(recovery ? { recovery_id: creationUuid(4) } : {}),
    },
  },
})
export const creationReceiptFixture = (
  row: DictionaryCreationJournalRow,
  overrides: Partial<DictionaryCreationReceiptV2> = {}
): DictionaryCreationReceiptV2 => ({
  protocol_version: 2,
  operation_id: row.session.command!.operation_id,
  resolution_id: row.session.request.resolution_id,
  entry_id: creationUuid(5),
  fence: '9007199254740993',
  status: 'accepted',
  quota_charged: true,
  result_sha256: null,
  error_code: null,
  published: null,
  published_head_sequence: null,
  ...overrides,
})
export const creationPublishedFixture = (
  row: DictionaryCreationJournalRow
): DictionaryCreationJournalRow => ({
  ...row,
  session: {
    ...row.session,
    response: creationReceiptFixture(row, {
      status: 'published',
      result_sha256: 'a'.repeat(64),
      published: {
        reference: { entry_id: creationUuid(5), revision_id: creationUuid(6) },
        content_sha256: 'b'.repeat(64),
      },
      published_head_sequence: '9007199254740995',
    }),
  },
})
export const creationAdoptionFixture = (
  row: DictionaryCreationJournalRow
): DictionaryCreationJournalRow => {
  const published =
    row.session.response && 'published' in row.session.response
      ? row.session.response.published
      : null
  if (!published) throw new Error('Published fixture required')
  return {
    ...row,
    adoption: {
      request: {
        protocol_version: 2,
        operation_id: creationUuid(7),
        word_id: creationUuid(8),
        collection_id: creationUuid(9),
        source: { kind: 'published-reference', ...published },
      },
      submitted: false,
      response: null,
    },
  }
}
export const creationOwnerFixture = (): DictionaryCreationJournalOwner => ({
  user_id: CREATION_OWNER,
  check: async () => {},
  assert: () => {},
})
