'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type {
  CollectionSharingState,
  SharedCollectionImportState,
} from './form-state'
import {
  buildSharedCollectionImportPayload,
  buildSharedCollectionUrl,
  isSharedResourceId,
  removeExistingSharedWords,
  selectSharedCollectionWords,
} from './shared-collection-domain'
import { getOwnedImportContext, loadSharedCollectionRows } from './repository'

const getStringValues = (formData: FormData, name: string): string[] =>
  formData
    .getAll(name)
    .flatMap(value => (typeof value === 'string' ? [value] : []))

export async function updateCollectionSharing(
  collectionId: string,
  previousState: CollectionSharingState,
  formData: FormData
): Promise<CollectionSharingState> {
  const auth = await requireAuthContext()
  if (!isSharedResourceId(collectionId)) {
    return { ...previousState, status: 'error', message: 'Invalid collection.' }
  }

  const intent = formData.get('intent')
  if (intent !== 'publish' && intent !== 'stop') {
    return {
      ...previousState,
      status: 'error',
      message: 'Choose a valid sharing action.',
    }
  }

  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('share_token')
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (collectionError || !collection) {
    return {
      ...previousState,
      status: 'error',
      message: 'The collection could not be found.',
    }
  }

  const isShared = intent === 'publish'
  const shareToken = collection.share_token ?? crypto.randomUUID()
  const { data: updatedCollection, error: updateError } = await supabase
    .from('collections')
    .update({
      is_shared: isShared,
      share_token: shareToken,
      shared_at: isShared ? new Date().toISOString() : null,
    })
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .select('collection_id')
    .maybeSingle()

  if (updateError || !updatedCollection) {
    return {
      ...previousState,
      status: 'error',
      message: isShared
        ? 'Could not publish the collection.'
        : 'Could not stop sharing the collection.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${collectionId}`)
  revalidatePath(`/share/${shareToken}`)

  return {
    status: 'success',
    message: isShared
      ? 'Collection published. The link is ready to share.'
      : 'Collection sharing stopped. The link no longer opens the collection.',
    isShared,
    shareUrl: isShared ? buildSharedCollectionUrl(shareToken) : null,
  }
}

export async function importSharedCollection(
  shareToken: string,
  _previousState: SharedCollectionImportState,
  formData: FormData
): Promise<SharedCollectionImportState> {
  const auth = await requireAuthContext()
  const targetCollectionId = formData.get('targetCollectionId')
  if (
    !isSharedResourceId(shareToken) ||
    typeof targetCollectionId !== 'string' ||
    !isSharedResourceId(targetCollectionId)
  ) {
    return { status: 'error', message: 'Select a valid target collection.' }
  }

  const selectedWordIds = getStringValues(formData, 'wordIds').filter(
    isSharedResourceId
  )
  if (selectedWordIds.length === 0) {
    return { status: 'error', message: 'Select at least one word to import.' }
  }

  const [shared, owned] = await Promise.all([
    loadSharedCollectionRows(shareToken),
    getOwnedImportContext(auth.userId),
  ])
  if (!shared) {
    return {
      status: 'error',
      message: 'This collection is no longer shared or the link has expired.',
    }
  }

  const targetCollection = owned.collections.find(
    collection => collection.id === targetCollectionId
  )
  if (!targetCollection) {
    return {
      status: 'error',
      message: 'The selected target collection could not be found.',
    }
  }

  const selectedWords = selectSharedCollectionWords(
    shared.words,
    selectedWordIds
  )
  const importWords = removeExistingSharedWords(
    selectedWords,
    owned.existingWords
  )
  if (importWords.length === 0) {
    return {
      status: 'error',
      message: 'The selected words already exist in your collections.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('import_words_to_collection', {
    p_collection_id: targetCollection.id,
    p_words: buildSharedCollectionImportPayload(importWords),
  })
  if (error) {
    return {
      status: 'error',
      message: 'Could not import the shared words. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${targetCollection.id}`)
  revalidatePath(`/share/${shareToken}`)

  return {
    status: 'success',
    message: `Imported ${importWords.length} ${importWords.length === 1 ? 'word' : 'words'} into “${targetCollection.name}”.`,
    importedCount: importWords.length,
    collectionId: targetCollection.id,
    collectionName: targetCollection.name,
  }
}
