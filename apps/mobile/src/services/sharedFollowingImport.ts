import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryFollowingImportDatabase } from '@woordenaar/supabase-contracts'
import {
  parseSharedDictionaryCollectionV2,
  requireFollowingImportOwner,
  verifySharedCollectionFollowingSource,
  type SharedDictionaryCollectionV2,
} from '@woordenaar/domain'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { supabase } from '@/lib/supabase'
import { withDictionaryImportOwner } from './dictionaryImportOwner'

/** Explicit, fresh-owner v2 read; missing/revoked shares never use a v1 fallback. */
export const readSharedFollowingCollection = (
  userId: string,
  shareToken: string,
  assertCurrent: () => void
) => {
  requireFollowingImportOwner(shareToken)
  return withDictionaryImportOwner(userId, async owner => {
    const assert = () => {
      owner.assert()
      assertCurrent()
      if (!isDictionaryFollowingImportsEnabled())
        throw new Error('Following shared imports are unavailable')
    }
    assert()
    const client =
      supabase as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
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
    const shared = parseSharedDictionaryCollectionV2(data)
    await owner.check()
    assert()
    return shared
  })
}

export const prepareSharedFollowingImport = async (
  userId: string,
  shareToken: string,
  original: SharedDictionaryCollectionV2,
  assertCurrent: () => void
) => {
  const current = await readSharedFollowingCollection(
    userId,
    shareToken,
    assertCurrent
  )
  assertCurrent()
  return verifySharedCollectionFollowingSource(shareToken, original, current)
}
