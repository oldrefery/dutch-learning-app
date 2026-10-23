'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DictionaryFollowingImportDatabase,
  Json,
} from '@woordenaar/supabase-contracts'
import {
  createDictionaryFollowingImportClient,
  createDictionaryFollowingTransferClient,
  readFollowingTransferRevisions,
  withDictionaryAnalysisOwner,
  DICTIONARY_TRANSFER_REVISION_COLUMNS,
  type DictionaryAnalysisClientOwner,
  type FollowingTransferSession,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createFollowingImportBrowserJournal } from './following-import-journal'
import { createFollowingTransferBrowserJournal } from './following-transfer-journal'

/** No storage, Auth or network access until an explicit method is invoked. */
export function createWebFollowingTransferService(
  userId: string,
  followingEnabled = false
) {
  const run = async <T>(
    cached: boolean,
    action: (
      client: ReturnType<typeof createDictionaryFollowingTransferClient>,
      owner: DictionaryAnalysisClientOwner
    ) => Promise<T>
  ) => {
    const sdk =
      createClient() as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
    const enabled = () =>
      followingEnabled &&
      process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true'
    return withDictionaryAnalysisOwner(
      userId,
      cached
        ? {
            onAuthStateChange: callback => sdk.auth.onAuthStateChange(callback),
            getUser: async () => {
              const { data, error } = await sdk.auth.getSession()
              return { data: { user: data.session?.user ?? null }, error }
            },
          }
        : sdk.auth,
      async owner => {
        const client = createDictionaryFollowingTransferClient({
          userId,
          enabled,
          journal: createFollowingTransferBrowserJournal(),
          createId: () => crypto.randomUUID(),
          readPublished: (ids, guard) =>
            readFollowingTransferRevisions(ids, guard, selected =>
              sdk
                .from('dictionary_revisions')
                .select(DICTIONARY_TRANSFER_REVISION_COLUMNS)
                .in('revision_id', selected)
                .eq('review_status', 'published')
            ),
          imports: createDictionaryFollowingImportClient({
            userId,
            enabled,
            journal: createFollowingImportBrowserJournal(),
            remote: {
              rpc: (name, args) =>
                sdk.rpc(
                  name,
                  args as { p_intent: Json } | { p_request: Json } | undefined
                ),
            },
          }),
        })
        const result = await action(client, owner)
        owner.assert()
        return result
      },
      'transfer'
    )
  }
  return {
    list: () => run(true, client => client.list()),
    prepare: (value: FollowingTransferSession) =>
      run(true, (client, owner) => client.prepare(value, owner)),
    resolve: (sessionId: string) =>
      run(false, (client, owner) => client.resolve(sessionId, owner)),
    queueEntry: (sessionId: string, index: number) =>
      run(true, (client, owner) => client.queueEntry(sessionId, index, owner)),
    deliverEntry: (sessionId: string, index: number) =>
      run(false, (client, owner) =>
        client.deliverEntry(sessionId, index, owner)
      ),
  }
}
