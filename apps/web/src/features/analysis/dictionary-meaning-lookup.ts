'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryMeaningLookupDatabase } from '@woordenaar/supabase-contracts'
import {
  findPublishedDictionaryMeanings,
  withDictionaryAnalysisOwner,
  DICTIONARY_MEANING_ENTRY_COLUMNS,
  DICTIONARY_MEANING_HEAD_COLUMNS,
  DICTIONARY_MEANING_LOOKUP_LIMIT,
  DICTIONARY_TRANSFER_REVISION_COLUMNS,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'

export const lookupPublishedMeanings = (
  userId: string,
  input: string,
  followingEnabled: boolean,
  assertCurrent: () => void
) => {
  const client =
    createClient() as unknown as SupabaseClient<DictionaryMeaningLookupDatabase>
  return withDictionaryAnalysisOwner(
    userId,
    client.auth,
    owner =>
      findPublishedDictionaryMeanings(input, {
        owner: {
          assert: () => {
            owner.assert()
            assertCurrent()
          },
          check: owner.check,
        },
        enabled: () =>
          followingEnabled &&
          process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED ===
            'true',
        capability: () => client.rpc('dictionary_content_capability_v2'),
        entries: query =>
          client
            .from('dictionary_entries')
            .select(DICTIONARY_MEANING_ENTRY_COLUMNS)
            .eq('language_code', 'nl')
            .eq('lemma', query)
            .eq('state', 'published')
            .order('entry_id')
            .limit(DICTIONARY_MEANING_LOOKUP_LIMIT + 1),
        heads: ids =>
          client
            .from('dictionary_entry_heads')
            .select(DICTIONARY_MEANING_HEAD_COLUMNS)
            .in('entry_id', ids),
        revisions: ids =>
          client
            .from('dictionary_revisions')
            .select(DICTIONARY_TRANSFER_REVISION_COLUMNS)
            .in('revision_id', ids)
            .eq('review_status', 'published'),
      }),
    'published meaning lookup'
  )
}
