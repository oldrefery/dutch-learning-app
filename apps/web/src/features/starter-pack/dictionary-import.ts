import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import {
  isDictionaryContentEnabled,
  type DictionaryDatabase,
} from '@/features/dictionary/repository'
import {
  buildStarterPackDictionaryCopies,
  buildStarterPackImportPayload,
  type StarterPackEntry,
  type StarterPackManifest,
} from './starter-pack-domain'

export async function importStarterPackEntries(
  client: SupabaseClient<Database>,
  collectionId: string,
  manifest: StarterPackManifest,
  entries: StarterPackEntry[]
) {
  if (!isDictionaryContentEnabled()) {
    return client.rpc('import_words_to_collection', {
      p_collection_id: collectionId,
      p_words: buildStarterPackImportPayload(entries),
    })
  }
  const target = client as unknown as SupabaseClient<DictionaryDatabase>
  const result = await target.rpc('import_official_dictionary_pack_v1', {
    p_collection_id: collectionId,
    p_pack_id: manifest.packId,
    p_version: manifest.version,
    p_entry_ids: entries.map(entry => entry.entryId),
  })
  if (
    manifest.packId === 'official-dutch-a1-essentials' &&
    result.error?.message === 'official-pack-unavailable'
  ) {
    return target.rpc('import_dictionary_copies_v1', {
      p_collection_id: collectionId,
      p_contents: buildStarterPackDictionaryCopies(entries),
    })
  }
  return result
}
