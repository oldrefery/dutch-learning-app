import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryCreationDatabase } from '@woordenaar/supabase-contracts'
import { createDictionaryCreationService } from '@woordenaar/domain'
import { isDictionarySharedAnalysisEnabled } from '@/constants/dictionaryContent'
import { dictionaryCreationRepository } from '@/db/dictionaryCreationRepository'
import { supabase } from '@/lib/supabase'

/** Dormant SDK binding; caller supplies the mounted lifetime guard. No auto-submit. */
export function createMobileDictionaryCreationService(
  userId: string,
  assertCurrent: () => void,
  signal?: AbortSignal
) {
  return createDictionaryCreationService({
    userId,
    assertCurrent,
    signal,
    enabled: isDictionarySharedAnalysisEnabled,
    connect: () => {
      const sdk =
        supabase as unknown as SupabaseClient<DictionaryCreationDatabase>
      return {
        auth: sdk.auth,
        journal: dictionaryCreationRepository,
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
