import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DictionaryFollowingImportDatabase,
  Json,
} from '@woordenaar/supabase-contracts'
import { createDictionaryCreationAdoptionService } from '@woordenaar/domain'
import { dictionaryCreationRepository } from '@/db/dictionaryCreationRepository'
import { dictionaryFollowingImportRepository } from '@/db/dictionaryFollowingImportRepository'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { supabase } from '@/lib/supabase'
import {
  loadFollowingImport,
  loadFollowingExistingCard,
} from './dictionaryFollowingImportHydration'

export function createMobileCreationAdoptionService(
  userId: string,
  assertCurrent: () => void,
  signal: AbortSignal
) {
  return createDictionaryCreationAdoptionService({
    userId,
    assertCurrent,
    signal,
    enabled: isDictionaryFollowingImportsEnabled,
    connect: () => {
      const sdk =
        supabase as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
      return {
        auth: sdk.auth,
        journal: dictionaryCreationRepository,
        imports: dictionaryFollowingImportRepository,
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
        ? loadFollowingExistingCard(value, assert)
        : loadFollowingImport(value, assert),
  })
}
