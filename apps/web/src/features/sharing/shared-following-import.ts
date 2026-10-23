'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryFollowingImportDatabase } from '@woordenaar/supabase-contracts'
import {
  parseSharedDictionaryCollectionV2,
  requireFollowingImportOwner,
  verifySharedCollectionFollowingSource,
  withDictionaryAnalysisOwner,
  type SharedDictionaryCollectionV2,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'

export const prepareSharedFollowingImport = async (
  userId: string,
  shareToken: string,
  original: SharedDictionaryCollectionV2,
  enabled: boolean,
  assertCurrent: () => void
) => {
  requireFollowingImportOwner(shareToken)
  const client =
    createClient() as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
  return withDictionaryAnalysisOwner(
    userId,
    client.auth,
    async owner => {
      const assert = () => {
        owner.assert()
        assertCurrent()
        if (
          !enabled ||
          process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED !==
            'true'
        )
          throw new Error('Following shared imports are unavailable')
      }
      assert()
      const { data, error } = await client.rpc(
        'get_shared_dictionary_collection_v2',
        {
          p_share_token: shareToken,
        }
      )
      assert()
      if (error) throw error
      if (data === null)
        throw new Error('Shared collection is unavailable or revoked')
      const current = parseSharedDictionaryCollectionV2(data)
      await owner.check()
      assert()
      return verifySharedCollectionFollowingSource(
        shareToken,
        original,
        current
      )
    },
    'shared collection import'
  )
}
