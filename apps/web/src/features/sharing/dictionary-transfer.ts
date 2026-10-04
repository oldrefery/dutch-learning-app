import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@woordenaar/supabase-contracts'
import { parseDictionaryCollectionExport } from '@woordenaar/domain'
import {
  isDictionaryContentEnabled,
  type DictionaryDatabase,
} from '@/features/dictionary/repository'

const requireEnabled = () => {
  if (!isDictionaryContentEnabled())
    throw new Error('Dictionary transfer is unavailable.')
}

export async function exportOwnedDictionaryCollection(
  client: SupabaseClient<Database>,
  collectionId: string
) {
  requireEnabled()
  const { data, error } = await (
    client as unknown as SupabaseClient<DictionaryDatabase>
  ).rpc('export_dictionary_collection_v1', { p_collection_id: collectionId })
  if (error) throw new Error('Could not export the collection. Please retry.')
  return parseDictionaryCollectionExport(data)
}

export async function importDictionaryCollectionExport(
  client: SupabaseClient<Database>,
  collectionId: string,
  value: unknown
) {
  requireEnabled()
  const document = parseDictionaryCollectionExport(value)
  if (document.entries.length === 0) return { data: [], error: null }
  return (client as unknown as SupabaseClient<DictionaryDatabase>).rpc(
    'import_dictionary_copies_v1',
    {
      p_collection_id: collectionId,
      p_contents: document.entries.map(
        entry => entry.content
      ) as unknown as Json,
    }
  )
}
