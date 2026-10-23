'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DictionaryFollowingImportDatabase,
  Json,
} from '@woordenaar/supabase-contracts'
import {
  createDictionaryFollowingImportClient,
  withDictionaryAnalysisOwner,
  type FollowingImportOperation,
  type DictionaryAnalysisClientOwner,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createFollowingImportBrowserJournal } from './following-import-journal'

/** Construction is inert; each explicit action captures a fresh owner lifetime. */
export function createWebFollowingImportService(
  userId: string,
  followingEnabled = false
) {
  const run = async <T>(
    action: (
      client: ReturnType<typeof createDictionaryFollowingImportClient>,
      owner: DictionaryAnalysisClientOwner
    ) => Promise<T>,
    assertCurrent: () => void = () => {}
  ) => {
    const sdk =
      createClient() as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
    return withDictionaryAnalysisOwner(
      userId,
      sdk.auth,
      async owner => {
        const client = createDictionaryFollowingImportClient({
          userId,
          journal: createFollowingImportBrowserJournal(),
          enabled: () =>
            followingEnabled &&
            process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED ===
              'true',
          remote: {
            rpc: (name, args) =>
              sdk.rpc(
                name,
                args as { p_intent: Json } | { p_request: Json } | undefined
              ),
          },
        })
        const assert = () => {
          owner.assert()
          assertCurrent()
        }
        const check = async () => {
          assert()
          await owner.check()
          assert()
        }
        assert()
        return action(client, { assert, check })
      },
      'import'
    )
  }
  return {
    async queue(value: FollowingImportOperation) {
      const sdk =
        createClient() as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
      // Cached session is used only to reserve local metadata. The server
      // getUser check and creation permission remain mandatory at delivery.
      return withDictionaryAnalysisOwner(
        userId,
        {
          onAuthStateChange: callback => sdk.auth.onAuthStateChange(callback),
          getUser: async () => {
            const { data, error } = await sdk.auth.getSession()
            return { data: { user: data.session?.user ?? null }, error }
          },
        },
        async owner =>
          createDictionaryFollowingImportClient({
            userId,
            journal: createFollowingImportBrowserJournal(),
            enabled: () =>
              followingEnabled &&
              process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED ===
                'true',
            remote: {
              rpc: () => {
                throw new Error('Local import queue cannot dispatch')
              },
            },
          }).queue(value, owner.assert),
        'local import'
      )
    },
    list: () => createFollowingImportBrowserJournal().list(userId),
    prepare: (value: FollowingImportOperation, assertCurrent?: () => void) =>
      run((client, owner) => client.prepare(value, owner), assertCurrent),
    deliver: (value: FollowingImportOperation, assertCurrent?: () => void) =>
      run((client, owner) => client.deliver(value, owner), assertCurrent),
    readState: (value: FollowingImportOperation, assertCurrent?: () => void) =>
      run((client, owner) => client.readState(value, owner), assertCurrent),
  }
}
