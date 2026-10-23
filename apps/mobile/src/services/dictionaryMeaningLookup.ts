import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryMeaningLookupDatabase } from '@woordenaar/supabase-contracts'
import {
  findPublishedDictionaryMeanings,
  DICTIONARY_MEANING_ENTRY_COLUMNS,
  DICTIONARY_MEANING_HEAD_COLUMNS,
  DICTIONARY_MEANING_LOOKUP_LIMIT,
  DICTIONARY_TRANSFER_REVISION_COLUMNS,
} from '@woordenaar/domain'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { supabase } from '@/lib/supabase'
import { withDictionaryImportOwner } from './dictionaryImportOwner'

export const lookupPublishedMeanings = (
  userId: string,
  input: string,
  assertCurrent: () => void
) =>
  withDictionaryImportOwner(userId, owner => {
    const client =
      supabase as unknown as SupabaseClient<DictionaryMeaningLookupDatabase>
    return findPublishedDictionaryMeanings(input, {
      owner: {
        assert: () => {
          owner.assert()
          assertCurrent()
        },
        check: owner.check,
      },
      enabled: isDictionaryFollowingImportsEnabled,
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
    })
  })
