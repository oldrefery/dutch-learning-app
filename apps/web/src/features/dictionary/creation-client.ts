'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryCreationDatabase } from '@woordenaar/supabase-contracts'
import { createDictionaryCreationService } from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createBrowserCreationJournal } from './creation-journal'

/** Explicit following capability/lifecycle from the caller; no I/O on construction. */
export function createWebDictionaryCreationService(
  userId: string,
  assertCurrent: () => void,
  followingEnabled = false,
  signal?: AbortSignal
) {
  return createDictionaryCreationService({
    userId,
    assertCurrent,
    signal,
    enabled: () =>
      followingEnabled &&
      process.env.NEXT_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED === 'true',
    connect: () => {
      const sdk =
        createClient() as unknown as SupabaseClient<DictionaryCreationDatabase>
      return {
        auth: sdk.auth,
        journal: createBrowserCreationJournal(),
        remote: {
          capability: () => sdk.rpc('dictionary_content_capability_v2'),
          actor: () => sdk.rpc('dictionary_analysis_actor_v1'),
          requestResolution: request =>
            sdk.rpc('request_dictionary_meaning_resolution_v2', {
              p_request: { ...request },
            }),
          readResolution: id =>
            sdk.rpc('get_dictionary_meaning_resolution_v2', {
              p_resolution: id,
            }),
          readReceipt: id =>
            sdk.rpc('get_dictionary_creation_operation_v2', {
              p_operation: id,
            }),
          getSession: () => sdk.auth.getSession(),
          getUser: token => sdk.auth.getUser(token),
          invoke: (name, options) => sdk.functions.invoke(name, options),
        },
      }
    },
  })
}
