import 'server-only'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import { getSemanticWordKey } from '@woordenaar/domain'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { hydrateOwnedWords } from '@/features/dictionary/repository'
import {
  exportOwnedDictionaryCollection,
  importDictionaryCollectionExport,
} from './dictionary-transfer'
import {
  buildTransferPreview,
  isTransferRecord,
  transferContentKey,
  validateTransferDocument,
  type TransferCommand,
  type TransferReply,
} from './dictionary-transfer-contract'
import { isSharedResourceId } from './shared-collection-domain'

type Client = SupabaseClient<Database>
type Word = Pick<
  Database['public']['Tables']['words']['Row'],
  'word_id' | 'article' | 'dutch_lemma' | 'part_of_speech' | 'collection_id'
>

export async function getTransferContext(client: Client, userId: string) {
  const [collections, words] = await Promise.all([
    client
      .from('collections')
      .select('collection_id,name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    fetchAllRows<Word>((from, to) =>
      client
        .from('words')
        .select('word_id,article,dutch_lemma,part_of_speech,collection_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('word_id')
        .range(from, to)
    ),
  ])
  if (collections.error || words.error)
    throw new Error('Could not prepare the document import.')
  const targets = (collections.data ?? []).map(collection => ({
    id: collection.collection_id,
    name: collection.name,
  }))
  const names = new Map(targets.map(target => [target.id, target.name]))
  return {
    collections: targets,
    existingWords: (await hydrateOwnedWords(client, words.data ?? [])).map(
      word => ({
        dutchLemma: word.dutch_lemma,
        partOfSpeech: word.part_of_speech,
        article: word.article,
        collectionName: word.collection_id
          ? (names.get(word.collection_id) ?? null)
          : null,
      })
    ),
  }
}

const uncertain = (): TransferReply => ({
  status: 'uncertain',
  message:
    'The import could not be confirmed. Check your collections, then preview again before retrying.',
})

function savedCount(
  rows: unknown,
  userId: string,
  keys: Set<string>
): number | null {
  if (!Array.isArray(rows) || rows.length !== keys.size) return null
  const seen = new Set<string>()
  for (const row of rows) {
    if (
      !isTransferRecord(row) ||
      row.user_id !== userId ||
      typeof row.word_id !== 'string' ||
      !isSharedResourceId(row.word_id) ||
      typeof row.dutch_lemma !== 'string' ||
      !(
        typeof row.part_of_speech === 'string' || row.part_of_speech === null
      ) ||
      !(typeof row.article === 'string' || row.article === null)
    )
      return null
    const key = getSemanticWordKey(
      row.dutch_lemma,
      row.part_of_speech,
      row.article
    )
    if (!keys.has(key) || seen.has(key)) return null
    seen.add(key)
  }
  return seen.size
}

function refreshTransferViews(collectionId: string) {
  try {
    revalidatePath('/app/collections')
    revalidatePath(`/app/collections/${collectionId}`)
    revalidatePath('/app/dictionary-import')
    revalidatePath('/app/review')
    return true
  } catch {
    // A saved import must not turn into a retryable failure after cache trouble.
    return false
  }
}

export async function executeDictionaryTransfer(
  client: Client,
  userId: string,
  command: TransferCommand
): Promise<TransferReply> {
  if (command.ownerId !== userId)
    return { status: 'error', message: 'Account changed. Reload to continue.' }
  const { data: target, error } = await client
    .from('collections')
    .select('collection_id,name')
    .eq('collection_id', command.collectionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !target)
    return {
      status: 'error',
      message: 'The selected collection is unavailable.',
    }
  if (command.kind === 'export') {
    const document = validateTransferDocument(
      await exportOwnedDictionaryCollection(client, target.collection_id)
    )
    return { status: 'exported', ownerId: userId, document }
  }

  const context = await getTransferContext(client, userId)
  // Recheck the target after the fresh read; the RPC also enforces ownership.
  if (
    !context.collections.some(
      collection => collection.id === target.collection_id
    )
  )
    return {
      status: 'error',
      message: 'The selected collection is unavailable.',
    }
  const selected = new Set(command.selectedIndexes)
  const available = buildTransferPreview(
    command.document,
    context.existingWords
  )
    .filter(word => selected.has(word.index) && !word.duplicate)
    .map(word => command.document.entries[word.index])
  const result = {
    status: 'saved' as const,
    ownerId: userId,
    collectionId: target.collection_id,
    collectionName: target.name,
    skippedCount: selected.size - available.length,
  }
  if (available.length === 0)
    return { ...result, savedCount: 0, cacheRefreshed: true }
  try {
    const { data, error: importError } = await importDictionaryCollectionExport(
      client,
      target.collection_id,
      { ...command.document, entries: available }
    )
    if (importError) return uncertain()
    return {
      ...result,
      // The RPC can return a concurrently existing card. Never call these new.
      savedCount: savedCount(
        data,
        userId,
        new Set(available.map(entry => transferContentKey(entry.content)))
      ),
      cacheRefreshed: refreshTransferViews(target.collection_id),
    }
  } catch {
    return uncertain()
  }
}
