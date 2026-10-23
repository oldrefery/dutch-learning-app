'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryAnalysisDatabase } from '@woordenaar/supabase-contracts'
import {
  createDictionaryAnalysisRemoteClient,
  parseDictionaryEffectiveBatchV2,
  requireDictionaryAnalysisHead,
  requireDictionaryAnalysisPublication,
  withDictionaryAnalysisOwner,
  type DictionaryAnalysisClientOperation,
  type DictionaryAnalysisClientOwner,
  type DictionaryEffectiveBatchV2,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import {
  createBrowserAnalysisJournal,
  createBrowserDictionaryAnalysisJournal,
} from './analysis-journal'

/** The server's following gate is supplied separately; public opt-in alone is insufficient.
 * Each action captures its own owner lifetime; no request starts on construction. */
export function createWebDictionaryAnalysisService(
  userId: string,
  followingEnabled = false,
  captureCurrent: () => () => void = () => () => {}
) {
  const enabled = () =>
    followingEnabled &&
    process.env.NEXT_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED === 'true'
  const run = async <T>(
    action: (
      client: ReturnType<typeof createDictionaryAnalysisRemoteClient>,
      owner: DictionaryAnalysisClientOwner
    ) => Promise<T>
  ): Promise<{ result: T; hydrated: DictionaryEffectiveBatchV2 | null }> => {
    const assertCurrent = captureCurrent()
    assertCurrent()
    const sdk =
      createClient() as unknown as SupabaseClient<DictionaryAnalysisDatabase>
    return withDictionaryAnalysisOwner(userId, sdk.auth, async captured => {
      const guard = () => {
        captured.assert()
        assertCurrent()
      }
      const owner: DictionaryAnalysisClientOwner = {
        assert: guard,
        check: async () => {
          await captured.check()
          guard()
        },
      }
      owner.assert()
      let hydrated: DictionaryEffectiveBatchV2 | null = null
      const readCards = async (
        operation: DictionaryAnalysisClientOperation
      ) => {
        owner.assert()
        if (!followingEnabled)
          throw new Error('Dictionary following is unavailable')
        const { data, error } = await sdk.rpc(
          'get_dictionary_effective_content_v2',
          { p_word_ids: [operation.word_id] }
        )
        await owner.check()
        const parsed = parseDictionaryEffectiveBatchV2(data)
        if (
          error ||
          !parsed.success ||
          parsed.data.cards.length !== 1 ||
          parsed.data.cards[0].word_id !== operation.word_id
        )
          throw new Error('Shared analysis content is unavailable')
        return parsed.data
      }
      const journal = createBrowserAnalysisJournal(async operation => {
        const batch = await readCards(operation)
        requireDictionaryAnalysisHead(operation, batch.cards[0])
      })
      const client = createDictionaryAnalysisRemoteClient({
        userId,
        journal,
        enabled,
        remote: {
          rpc: (name, args) => sdk.rpc(name, args),
          getSession: () => sdk.auth.getSession(),
          invoke: (name, options) => sdk.functions.invoke(name, options),
        },
        refresh: async operation => {
          const batch = await readCards(operation)
          requireDictionaryAnalysisPublication(operation, batch.cards[0])
          owner.assert()
          hydrated = batch
        },
      })
      const result = await action(client, owner)
      await owner.check()
      return { result, hydrated }
    })
  }
  return {
    async readHistory(wordId: string) {
      return createBrowserDictionaryAnalysisJournal({
        storage: window.localStorage,
        withLock: async () => {
          throw new Error('Read-only analysis journal')
        },
        assertHead: async () => {
          throw new Error('Read-only analysis journal')
        },
      }).history(userId, wordId)
    },
    async nextAttempt(
      expected: DictionaryAnalysisClientOperation,
      candidate: DictionaryAnalysisClientOperation
    ) {
      return run((client, owner) =>
        client.nextAttempt(expected, candidate, owner)
      )
    },
    async readSaved(wordId: string) {
      return createBrowserDictionaryAnalysisJournal({
        storage: window.localStorage,
        withLock: async () => {
          throw new Error('Read-only analysis journal')
        },
        assertHead: async () => {
          throw new Error('Read-only analysis journal')
        },
      }).read(userId, wordId)
    },
    async isAvailable(): Promise<boolean> {
      if (!enabled()) return false
      return (await run((client, owner) => client.isAvailable(owner))).result
    },
    async submit(operation: DictionaryAnalysisClientOperation) {
      if (operation.user_id !== userId)
        throw new Error('Shared analysis owner mismatch')
      return run((client, owner) => client.submit(operation, owner))
    },
    async loadPublished(operation: DictionaryAnalysisClientOperation) {
      return run((client, owner) => client.loadPublished(operation, owner))
    },
    async recover(wordId: string) {
      return run((client, owner) => client.recover(userId, wordId, owner))
    },
  }
}
