import type { FollowingTransferSession } from '@woordenaar/domain'
import {
  OWNER_A,
  followingBatch,
  followingContent,
} from './dictionaryFollowing.fixture'
import { COLLECTION_ID } from './dictionaryFollowingImport.fixture'

export const TRANSFER_ID = '14141414-1414-4141-8141-141414141414'
export const transferRevision = followingBatch().revisions[0]
export const transferSession = (): FollowingTransferSession => ({
  user_id: OWNER_A,
  session_id: TRANSFER_ID,
  collection_id: COLLECTION_ID,
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
      { content: followingContent, shared_reference: null },
      {
        content: {
          ...followingContent,
          image_url: 'https://example.com/unselected.png',
        },
        shared_reference: null,
      },
    ],
  },
})
