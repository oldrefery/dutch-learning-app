'use client'

import type {
  DictionaryCollectionExportV2,
  FollowingImportOperation,
} from '@woordenaar/domain'
import { createWebFollowingImportService } from '@/features/sharing/following-import-client'
import { saveWordToCollection, type SaveWordResult } from './actions'

export const isLinkedWordImportEnabled = () =>
  process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true'

export async function savePublishedWord({
  userId,
  collectionId,
  entry,
  previousIntent,
  onIntent,
}: {
  userId: string
  collectionId: string
  entry: DictionaryCollectionExportV2['entries'][number]
  previousIntent?: FollowingImportOperation | null
  onIntent: (intent: FollowingImportOperation) => void
}): Promise<SaveWordResult> {
  if (!isLinkedWordImportEnabled()) {
    return saveWordToCollection(
      userId,
      collectionId,
      JSON.stringify(entry.content)
    )
  }
  if (!entry.shared_reference)
    throw new Error('This shared reference is unavailable.')
  const source = {
    kind: 'published-reference' as const,
    ...entry.shared_reference,
  }
  let intent = previousIntent
  if (
    intent?.kind !== 'import' ||
    intent.user_id !== userId ||
    intent.request.collection_id !== collectionId ||
    intent.request.source.reference.revision_id !== source.reference.revision_id
  ) {
    intent = {
      kind: 'import',
      user_id: userId,
      result: null,
      request: {
        protocol_version: 2,
        collection_id: collectionId,
        word_id: crypto.randomUUID(),
        operation_id: crypto.randomUUID(),
        source,
      },
    }
    onIntent(intent)
  }
  const imports = createWebFollowingImportService(userId, true)
  const saved = await imports.prepare(intent)
  const receipt = await imports.deliver(saved)
  if (receipt.kind !== 'import' || !receipt.result) {
    throw new Error('Could not confirm the import.')
  }
  if (receipt.result.outcome === 'identity-conflict') {
    return {
      success: false,
      duplicate: true,
      message: 'This word already exists in your vocabulary.',
    }
  }
  return { success: true, wordId: receipt.result.word_id }
}
