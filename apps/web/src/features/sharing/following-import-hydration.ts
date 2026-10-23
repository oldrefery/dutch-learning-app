'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DictionaryFollowingImportDatabase,
  Json,
} from '@woordenaar/supabase-contracts'
import {
  followingImportRoot,
  followingImportHydrationWordId,
  requireFollowingImportHydrationState,
  type FollowingImportHydrationKind,
  requireFollowingImportHydration,
  requireFollowingImportCard,
  parseDictionaryFollowingCapability,
  parseDictionaryEffectiveBatchV2,
  parseDictionaryImportRecoveryStateV2,
  withDictionaryAnalysisOwner,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createFollowingImportBrowserJournal } from './following-import-journal'

/** Browser rows are request-scoped. Only refresh the route after complete reads;
 * do not copy receipt metadata into personal data or persist private read caches. */
async function loadWebFollowingImportTarget(
  value: FollowingImportOperation,
  followingEnabled: boolean,
  assertCurrent: () => void,
  refresh: () => void,
  kind: FollowingImportHydrationKind
): Promise<void> {
  const sdk =
    createClient() as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
  await withDictionaryAnalysisOwner(value.user_id, sdk.auth, async owner => {
    const assert = () => {
      owner.assert()
      assertCurrent()
      if (!followingEnabled)
        throw new Error('Dictionary following is unavailable')
    }
    const check = async () => {
      await owner.check()
      assert()
      const latest = requireFollowingImportHydration(
        value,
        await journal.list(value.user_id),
        kind
      )
      if (JSON.stringify(latest) !== JSON.stringify(operation))
        throw new Error('Import recovery changed during loading')
      assert()
    }
    assert()
    const journal = createFollowingImportBrowserJournal()
    const operation = requireFollowingImportHydration(
      value,
      await journal.list(value.user_id),
      kind
    )
    const root = followingImportRoot(operation)
    const wordId = followingImportHydrationWordId(operation, kind)
    const capability = await sdk.rpc('dictionary_content_capability_v2')
    await check()
    const parsedCapability = parseDictionaryFollowingCapability(capability.data)
    if (
      capability.error ||
      !parsedCapability.success ||
      !parsedCapability.data.following_enabled
    )
      throw new Error('Dictionary following is unavailable')
    const state = await sdk.rpc('read_dictionary_import_recovery_v2', {
      p_intent: root as unknown as Json,
    })
    await check()
    if (state.error) throw state.error
    requireFollowingImportHydrationState(
      operation,
      parseDictionaryImportRecoveryStateV2(state.data, root),
      kind
    )
    const personal = await sdk
      .from('words')
      .select('word_id,user_id,collection_id,deleted_at')
      .eq('user_id', value.user_id)
      .eq('word_id', wordId)
      .maybeSingle()
    await check()
    if (
      personal.error ||
      !personal.data ||
      personal.data.user_id !== value.user_id ||
      personal.data.word_id !== wordId ||
      personal.data.deleted_at !== null
    )
      throw new Error('Imported personal row is unavailable')
    const response = await sdk.rpc('get_dictionary_effective_content_v2', {
      p_word_ids: [wordId],
    })
    await check()
    const batch = parseDictionaryEffectiveBatchV2(response.data)
    if (response.error || !batch.success || batch.data.cards.length !== 1)
      throw new Error('Imported shared content is unavailable')
    requireFollowingImportCard(operation, batch.data.cards[0], kind)
    if (kind === 'existing') {
      const current = await sdk.rpc('read_dictionary_import_recovery_v2', {
        p_intent: root as unknown as Json,
      })
      await check()
      if (current.error) throw current.error
      requireFollowingImportHydrationState(
        operation,
        parseDictionaryImportRecoveryStateV2(current.data, root),
        kind
      )
    }
    await check()
    refresh()
  })
}

export const loadWebFollowingImport = (
  value: FollowingImportOperation,
  followingEnabled: boolean,
  assertCurrent: () => void,
  refresh: () => void
): Promise<void> =>
  loadWebFollowingImportTarget(
    value,
    followingEnabled,
    assertCurrent,
    refresh,
    'imported'
  )

export const loadWebFollowingExistingCard = (
  value: FollowingImportOperation,
  followingEnabled: boolean,
  assertCurrent: () => void,
  refresh: () => void
): Promise<void> =>
  loadWebFollowingImportTarget(
    value,
    followingEnabled,
    assertCurrent,
    refresh,
    'existing'
  )
