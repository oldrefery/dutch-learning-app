'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DictionaryFollowingImportDatabase,
  Json,
} from '@woordenaar/supabase-contracts'
import { createDictionaryCreationAdoptionService } from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createBrowserCreationJournal } from './creation-journal'
import { createFollowingImportBrowserJournal } from '@/features/sharing/following-import-journal'
import {
  loadWebFollowingImport,
  loadWebFollowingExistingCard,
} from '@/features/sharing/following-import-hydration'

export function createWebCreationAdoptionService(
  userId: string,
  assertCurrent: () => void,
  signal: AbortSignal,
  followingEnabled: boolean,
  refresh: () => void
) {
  return createDictionaryCreationAdoptionService({
    userId,
    assertCurrent,
    signal,
    enabled: () =>
      followingEnabled &&
      process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true',
    connect: () => {
      const sdk =
        createClient() as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
      return {
        auth: sdk.auth,
        journal: createBrowserCreationJournal(),
        imports: createFollowingImportBrowserJournal(),
        remote: lifetime => ({
          rpc: (name, args) =>
            sdk
              .rpc(
                name,
                args as { p_intent: Json } | { p_request: Json } | undefined
              )
              .abortSignal(lifetime),
        }),
      }
    },
    load: (value, assert, kind) =>
      kind === 'existing'
        ? loadWebFollowingExistingCard(value, followingEnabled, assert, refresh)
        : loadWebFollowingImport(value, followingEnabled, assert, refresh),
  })
}
