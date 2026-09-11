'use server'

import { revalidatePath } from 'next/cache'
import type { Database } from '@woordenaar/supabase-contracts'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import type { StarterPackImportState } from './form-state'
import { loadRemoteOfficialStarterPack } from './official-content-repository'
import {
  buildStarterPackImportPayload,
  getStarterPackSemanticKey,
  loadOfficialStarterPack,
  NEW_STARTER_PACK_COLLECTION_ID,
  selectStarterPackEntries,
  type StarterPackEntry,
} from './starter-pack-domain'

type ExistingWordRow = Pick<
  Database['public']['Tables']['words']['Row'],
  'article' | 'collection_id' | 'dutch_lemma' | 'part_of_speech'
>

const getSelectedEntryIds = (formData: FormData): string[] =>
  formData
    .getAll('entryIds')
    .flatMap(value => (typeof value === 'string' ? [value] : []))

const BUNDLED_PACK_ID = 'official-dutch-a1-essentials'

const getWordRowSemanticKey = (word: ExistingWordRow) =>
  getStarterPackSemanticKey(word.dutch_lemma, word.part_of_speech, word.article)

const completeImport = (
  targetCollection: { id: string; name: string },
  importedCount?: number
): StarterPackImportState => {
  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${targetCollection.id}`)
  revalidatePath('/app/starter-pack')

  return {
    status: 'success',
    message:
      importedCount === undefined
        ? `The import into “${targetCollection.name}” completed, but the final word count could not be verified.`
        : `Imported ${importedCount} ${importedCount === 1 ? 'word' : 'words'} into “${targetCollection.name}”.`,
    importedCount,
    collectionId: targetCollection.id,
    collectionName: targetCollection.name,
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type AuthContext = Awaited<ReturnType<typeof requireAuthContext>>

type TargetResolution =
  | {
      targetCollection: { id: string; name: string }
      createdCollectionId: string | null
    }
  | {
      error: string
    }

async function resolveImportTarget(
  supabase: SupabaseClient,
  auth: AuthContext,
  requestedTarget: string,
  collectionName: string
): Promise<TargetResolution> {
  if (requestedTarget === NEW_STARTER_PACK_COLLECTION_ID) {
    if (auth.accessLevel !== 'full_access') {
      return {
        error: 'Read-only accounts must import into an existing collection.',
      }
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({ name: collectionName, user_id: auth.userId })
      .select('collection_id, name')
      .single()

    return error || !data
      ? { error: 'Could not create the starter-pack collection.' }
      : {
          targetCollection: { id: data.collection_id, name: data.name },
          createdCollectionId: data.collection_id,
        }
  }

  const { data, error } = await supabase
    .from('collections')
    .select('collection_id, name')
    .eq('collection_id', requestedTarget)
    .eq('user_id', auth.userId)
    .maybeSingle()

  return error || !data
    ? { error: 'The selected target collection could not be found.' }
    : {
        targetCollection: { id: data.collection_id, name: data.name },
        createdCollectionId: null,
      }
}

const countVerifiedImports = (
  entries: StarterPackEntry[],
  targetKeysBefore: Set<string>,
  targetWordsAfter: ExistingWordRow[]
): number => {
  const targetKeysAfter = new Set(targetWordsAfter.map(getWordRowSemanticKey))
  return entries.reduce((count, entry) => {
    const key = getStarterPackSemanticKey(
      entry.dutchLemma,
      entry.partOfSpeech,
      entry.article
    )
    return (
      count + (!targetKeysBefore.has(key) && targetKeysAfter.has(key) ? 1 : 0)
    )
  }, 0)
}

interface VerifyImportOptions {
  auth: AuthContext
  createdCollectionId: string | null
  importEntries: StarterPackEntry[]
  importError: unknown
  supabase: SupabaseClient
  targetCollection: { id: string; name: string }
  targetKeysBefore: Set<string>
}

async function verifyImportResult({
  auth,
  createdCollectionId,
  importEntries,
  importError,
  supabase,
  targetCollection,
  targetKeysBefore,
}: VerifyImportOptions): Promise<StarterPackImportState> {
  const { data: targetWordsAfter, error: verificationError } =
    await fetchAllRows<ExistingWordRow>((from, to) =>
      supabase
        .from('words')
        .select('article, collection_id, dutch_lemma, part_of_speech')
        .eq('user_id', auth.userId)
        .eq('collection_id', targetCollection.id)
        .is('deleted_at', null)
        .order('word_id')
        .range(from, to)
    )

  if (verificationError) {
    if (!importError) return completeImport(targetCollection)
    return {
      status: 'error',
      message:
        'The import result could not be verified. The target collection was kept to avoid losing committed words; reload before retrying.',
      collectionId: targetCollection.id,
      collectionName: targetCollection.name,
    }
  }

  const verifiedWords = targetWordsAfter ?? []
  const importedCount = countVerifiedImports(
    importEntries,
    targetKeysBefore,
    verifiedWords
  )
  if (importedCount > 0) {
    return completeImport(targetCollection, importedCount)
  }

  if (createdCollectionId && verifiedWords.length === 0) {
    const { error: cleanupError } = await supabase
      .from('collections')
      .delete()
      .eq('collection_id', createdCollectionId)
      .eq('user_id', auth.userId)

    if (cleanupError) {
      return {
        status: 'error',
        message:
          'No words were imported, and the empty collection could not be removed. Reload before retrying.',
        collectionId: targetCollection.id,
        collectionName: targetCollection.name,
      }
    }
  }

  return {
    status: 'error',
    message: importError
      ? 'Could not import the starter pack. Please try again.'
      : 'The selected words already exist in your collections.',
  }
}

async function loadRequestedManifest(formData: FormData) {
  const packId = formData.get('packId')
  const version = formData.get('packVersion')
  if (typeof packId !== 'string' || typeof version !== 'string') {
    throw new Error('Official content identity is missing.')
  }

  if (packId === BUNDLED_PACK_ID) {
    const bundled = loadOfficialStarterPack()
    if (version !== bundled.version) {
      throw new Error('The bundled official content version is unavailable.')
    }
    return bundled
  }
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId) ||
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version)
  ) {
    throw new Error('Official content identity is invalid.')
  }
  return loadRemoteOfficialStarterPack(packId, version)
}

export async function importStarterPack(
  _state: StarterPackImportState,
  formData: FormData
): Promise<StarterPackImportState> {
  const auth = await requireAuthContext()
  let manifest
  try {
    manifest = await loadRequestedManifest(formData)
  } catch {
    return {
      status: 'error',
      message: 'This official content version is no longer available.',
    }
  }
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
  const { data: existingWords, error: existingWordsError } =
    await fetchAllRows<ExistingWordRow>((from, to) =>
      supabase
        .from('words')
        .select('article, collection_id, dutch_lemma, part_of_speech')
        .eq('user_id', auth.userId)
        .is('deleted_at', null)
        .order('word_id')
        .range(from, to)
    )

  if (existingWordsError) {
    return {
      status: 'error',
      message: 'Could not check existing words. Please try again.',
    }
  }

  const existingKeys = new Set((existingWords ?? []).map(getWordRowSemanticKey))
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

  const target = await resolveImportTarget(
    supabase,
    auth,
    requestedTarget,
    manifest.title
  )
  if ('error' in target) {
    return { status: 'error', message: target.error }
  }
  const { createdCollectionId, targetCollection } = target

  const targetKeysBefore = new Set(
    (existingWords ?? [])
      .filter(word => word.collection_id === targetCollection.id)
      .map(getWordRowSemanticKey)
  )

  const { error: importError } = await supabase.rpc(
    'import_words_to_collection',
    {
      p_collection_id: targetCollection.id,
      p_words: buildStarterPackImportPayload(importEntries),
    }
  )

  return verifyImportResult({
    auth,
    createdCollectionId,
    importEntries,
    importError,
    supabase,
    targetCollection,
    targetKeysBefore,
  })
}
