import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@woordenaar/supabase-contracts'
import {
  parseDictionaryReference,
  type DictionaryReference,
} from '@woordenaar/domain'
import {
  applyEffectiveCards,
  parseEffectiveCards,
  type EffectiveCard,
  type DictionaryCardMetadata,
} from './content'

/** Additive local target RPCs; the deployed generated schema stays unchanged. */
export type DictionaryDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions' | 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      dictionary_entry_heads: {
        Row: { entry_id: string; revision_id: string }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Functions: Database['public']['Functions'] & {
      get_dictionary_effective_content_v1: {
        Args: { p_word_ids: string[] }
        Returns: Json
      }
      get_web_review_snapshot_v2: { Args: Record<string, never>; Returns: Json }
      import_official_dictionary_pack_v1: {
        Args: {
          p_collection_id: string
          p_pack_id: string
          p_version: string
          p_entry_ids: string[]
        }
        Returns: Database['public']['Tables']['words']['Row'][]
      }
      import_dictionary_copies_v1: {
        Args: { p_collection_id: string; p_contents: Json }
        Returns: Database['public']['Tables']['words']['Row'][]
      }
      import_shared_dictionary_collection_v1: {
        Args: {
          p_collection_id: string
          p_share_token: string
          p_word_ids: string[]
        }
        Returns: Database['public']['Tables']['words']['Row'][]
      }
      get_shared_dictionary_collection_v1: {
        Args: { p_share_token: string }
        Returns: Json
      }
      export_dictionary_collection_v1: {
        Args: { p_collection_id: string }
        Returns: Json
      }
    }
  }
}

export const isDictionaryContentEnabled = () =>
  process.env.DICTIONARY_CONTENT_ENABLED === 'true'

export const getAvailableRevision = async (
  client: SupabaseClient<Database>,
  reference: DictionaryReference
): Promise<DictionaryReference | undefined> => {
  const dictionaryClient =
    client as unknown as SupabaseClient<DictionaryDatabase>
  const { data, error } = await dictionaryClient
    .from('dictionary_entry_heads')
    .select('entry_id, revision_id')
    .eq('entry_id', reference.entry_id)
    .maybeSingle()
  if (error)
    throw new Error('Could not check dictionary updates. Please retry.')
  if (!data) return undefined
  const parsed = parseDictionaryReference(data)
  if (!parsed.success || parsed.data.entry_id !== reference.entry_id)
    throw new Error('Invalid dictionary update.')
  return parsed.data.revision_id === reference.revision_id
    ? undefined
    : parsed.data
}

export const hydrateOwnedWords = async <Row extends { word_id: string }>(
  client: SupabaseClient<Database>,
  rows: Row[]
): Promise<(Row & { dictionary?: DictionaryCardMetadata })[]> => {
  if (!isDictionaryContentEnabled() || rows.length === 0) return rows
  const dictionaryClient =
    client as unknown as SupabaseClient<DictionaryDatabase>
  const ids = [...new Set(rows.map(row => row.word_id))]
  const cards = new Map<string, EffectiveCard>()
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const requested = ids.slice(offset, offset + 1000)
    const { data, error } = await dictionaryClient.rpc(
      'get_dictionary_effective_content_v1',
      { p_word_ids: requested }
    )
    if (error)
      throw new Error('Could not load dictionary content. Please retry.')
    const batch = parseEffectiveCards(data)
    if (
      batch.size !== requested.length ||
      requested.some(id => !batch.has(id))
    ) {
      throw new Error('Dictionary content is incomplete. Please retry.')
    }
    for (const [id, card] of batch) cards.set(id, card)
  }
  return applyEffectiveCards(rows, cards)
}
