import 'server-only'

import type { Database } from '@woordenaar/supabase-contracts'
import { createClient } from '@/lib/supabase/server'
import {
  buildSharedCollectionPreview,
  isSharedResourceId,
  type ExistingSharedImportWord,
  type SharedCollectionPreviewWord,
  type SharedCollectionWord,
} from './shared-collection-domain'

type CollectionRow = Database['public']['Tables']['collections']['Row']

type SharedCollectionRow = Pick<CollectionRow, 'collection_id' | 'name'>

export interface SharedTargetCollection {
  id: string
  name: string
}

export interface SharedCollectionRows {
  collection: SharedCollectionRow
  words: SharedCollectionWord[]
}

export interface SharedCollectionImportContext {
  collection: SharedCollectionRow
  collections: SharedTargetCollection[]
  previewWords: SharedCollectionPreviewWord[]
}

const SHARED_WORD_COLUMNS =
  'analysis_notes, antonyms, article, conjugation, created_at, dutch_lemma, dutch_original, examples, expression_type, image_url, is_expression, is_irregular, is_reflexive, is_separable, part_of_speech, plural, prefix_part, preposition, register, root_verb, synonyms, translations, tts_url, usage_notes, word_id'

export async function loadSharedCollectionRows(
  shareToken: string
): Promise<SharedCollectionRows | null> {
  if (!isSharedResourceId(shareToken)) return null

  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('collection_id, name')
    .eq('share_token', shareToken)
    .eq('is_shared', true)
    .maybeSingle()

  if (collectionError) {
    throw new Error('Could not load the shared collection.')
  }
  if (!collection) return null

  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select(SHARED_WORD_COLUMNS)
    .eq('collection_id', collection.collection_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (wordsError) {
    throw new Error('Could not load the shared collection words.')
  }

  return {
    collection,
    words: words ?? [],
  }
}

export async function getOwnedImportContext(userId: string): Promise<{
  collections: SharedTargetCollection[]
  existingWords: ExistingSharedImportWord[]
}> {
  const supabase = await createClient()
  const [collectionsResult, wordsResult] = await Promise.all([
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('words')
      .select('article, collection_id, dutch_lemma, part_of_speech')
      .eq('user_id', userId)
      .is('deleted_at', null),
  ])

  if (collectionsResult.error || wordsResult.error) {
    throw new Error('Could not prepare the shared collection import.')
  }

  const collections = (collectionsResult.data ?? []).map(collection => ({
    id: collection.collection_id,
    name: collection.name,
  }))
  const collectionNames = new Map(
    collections.map(collection => [collection.id, collection.name])
  )

  return {
    collections,
    existingWords: (wordsResult.data ?? []).map(word => ({
      dutchLemma: word.dutch_lemma,
      partOfSpeech: word.part_of_speech,
      article: word.article,
      collectionName: word.collection_id
        ? (collectionNames.get(word.collection_id) ?? null)
        : null,
    })),
  }
}

export async function getSharedCollectionImportContext(
  userId: string,
  shareToken: string
): Promise<SharedCollectionImportContext | null> {
  const shared = await loadSharedCollectionRows(shareToken)
  if (!shared) return null

  const owned = await getOwnedImportContext(userId)
  return {
    collection: shared.collection,
    collections: owned.collections,
    previewWords: buildSharedCollectionPreview(
      shared.words,
      owned.existingWords
    ),
  }
}
