'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { StarterPackImportState } from './form-state'
import {
  buildStarterPackImportPayload,
  getStarterPackSemanticKey,
  loadOfficialStarterPack,
  NEW_STARTER_PACK_COLLECTION_ID,
  selectStarterPackEntries,
} from './starter-pack-domain'

const getSelectedEntryIds = (formData: FormData): string[] =>
  formData
    .getAll('entryIds')
    .flatMap(value => (typeof value === 'string' ? [value] : []))

export async function importStarterPack(
  _state: StarterPackImportState,
  formData: FormData
): Promise<StarterPackImportState> {
  const auth = await requireAuthContext()
  const manifest = loadOfficialStarterPack()
  const selectedEntries = selectStarterPackEntries(
    manifest,
    getSelectedEntryIds(formData)
  )

  if (selectedEntries.length === 0) {
    return {
      status: 'error',
      message: 'Select at least one available word to import.',
    }
  }

  const requestedTarget = formData.get('targetCollectionId')
  if (typeof requestedTarget !== 'string' || requestedTarget === '') {
    return { status: 'error', message: 'Select a target collection.' }
  }

  const supabase = await createClient()
  const { data: existingWords, error: existingWordsError } = await supabase
    .from('words')
    .select('article, dutch_lemma, part_of_speech')
    .eq('user_id', auth.userId)
    .is('deleted_at', null)

  if (existingWordsError) {
    return {
      status: 'error',
      message: 'Could not check existing words. Please try again.',
    }
  }

  const existingKeys = new Set(
    (existingWords ?? []).map(word =>
      getStarterPackSemanticKey(
        word.dutch_lemma,
        word.part_of_speech,
        word.article
      )
    )
  )
  const importEntries = selectedEntries.filter(
    entry =>
      !existingKeys.has(
        getStarterPackSemanticKey(
          entry.dutchLemma,
          entry.partOfSpeech,
          entry.article
        )
      )
  )

  if (importEntries.length === 0) {
    return {
      status: 'error',
      message: 'The selected words already exist in your collections.',
    }
  }

  let targetCollection: { id: string; name: string } | null = null
  let createdCollectionId: string | null = null

  if (requestedTarget === NEW_STARTER_PACK_COLLECTION_ID) {
    if (auth.accessLevel !== 'full_access') {
      return {
        status: 'error',
        message: 'Read-only accounts must import into an existing collection.',
      }
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({ name: manifest.title, user_id: auth.userId })
      .select('collection_id, name')
      .single()

    if (error || !data) {
      return {
        status: 'error',
        message: 'Could not create the starter-pack collection.',
      }
    }

    targetCollection = { id: data.collection_id, name: data.name }
    createdCollectionId = data.collection_id
  } else {
    const { data, error } = await supabase
      .from('collections')
      .select('collection_id, name')
      .eq('collection_id', requestedTarget)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (error || !data) {
      return {
        status: 'error',
        message: 'The selected target collection could not be found.',
      }
    }

    targetCollection = { id: data.collection_id, name: data.name }
  }

  const { data: importedWords, error: importError } = await supabase.rpc(
    'import_words_to_collection',
    {
      p_collection_id: targetCollection.id,
      p_words: buildStarterPackImportPayload(importEntries),
    }
  )

  if (importError) {
    if (createdCollectionId) {
      await supabase
        .from('collections')
        .delete()
        .eq('collection_id', createdCollectionId)
        .eq('user_id', auth.userId)
    }

    return {
      status: 'error',
      message: 'Could not import the starter pack. Please try again.',
    }
  }

  const importedCount = importedWords?.length ?? 0
  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${targetCollection.id}`)
  revalidatePath('/app/starter-pack')

  return {
    status: 'success',
    message: `Imported ${importedCount} ${importedCount === 1 ? 'word' : 'words'} into “${targetCollection.name}”.`,
    importedCount,
    collectionId: targetCollection.id,
    collectionName: targetCollection.name,
  }
}
