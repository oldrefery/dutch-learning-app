import {
  parseDictionaryRevision,
  type FollowingTransferSession,
} from '@woordenaar/domain'
import { publishedRevision } from '@/features/dictionary/__fixtures__/following'

export const TRANSFER_OWNER = '11111111-1111-4111-8111-111111111111'
export const TRANSFER_OTHER = '22222222-2222-4222-8222-222222222222'
export const TRANSFER_ID = '14141414-1414-4141-8141-141414141414'
export const TRANSFER_WORD = '15151515-1515-4151-8151-151515151515'
export const TRANSFER_OPERATION = '16161616-1616-4161-8161-161616161616'
const parsed = parseDictionaryRevision(publishedRevision())
if (!parsed.success) throw new Error('Invalid transfer fixture')
export const transferRevision = parsed.data
export const transferSession = (): FollowingTransferSession => ({
  user_id: TRANSFER_OWNER,
  session_id: TRANSFER_ID,
  collection_id: TRANSFER_OTHER,
  selected_indexes: [0, 1, 2],
  plan: null,
  document: {
    schema_version: 2,
    collection: { name: 'Protected original' },
    entries: [
      {
        content: transferRevision.content,
        shared_reference: {
          reference: {
            entry_id: transferRevision.entry_id,
            revision_id: transferRevision.revision_id,
          },
          content_sha256: transferRevision.content_sha256,
        },
      },
      {
        content: {
          ...transferRevision.content,
          examples: [
            { nl: 'Private original.', en: 'Private example.', ru: null },
          ],
        },
        shared_reference: {
          reference: {
            entry_id: transferRevision.entry_id,
            revision_id: transferRevision.revision_id,
          },
          content_sha256: transferRevision.content_sha256,
        },
      },
      { content: transferRevision.content, shared_reference: null },
      {
        content: {
          ...transferRevision.content,
          image_url: 'https://example.com/unselected.png',
        },
        shared_reference: null,
      },
    ],
  },
})
export const transferReceipt = () => ({
  protocol_version: 2,
  operation_id: TRANSFER_OPERATION,
  word_id: TRANSFER_WORD,
  outcome: 'inserted',
  idempotent: false,
  existing_word_id: null,
  reference: {
    entry_id: transferRevision.entry_id,
    revision_id: transferRevision.revision_id,
  },
  applied_reference: {
    entry_id: transferRevision.entry_id,
    revision_id: transferRevision.revision_id,
  },
  applied_head_sequence: '9007199254740993',
})
export const transferCapability = () => ({
  dictionary_content_protocol: 2,
  read_protocol_versions: [1, 2],
  command_protocol_versions: [1, 2],
  following_enabled: true,
  shared_analysis_enabled: false,
})
