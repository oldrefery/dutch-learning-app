import * as Crypto from 'expo-crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DictionaryFollowingImportDatabase,
  Json,
} from '@woordenaar/supabase-contracts'
import {
  createDictionaryFollowingImportClient,
  createDictionaryFollowingTransferClient,
  readFollowingTransferRevisions,
  DICTIONARY_TRANSFER_REVISION_COLUMNS,
  type DictionaryAnalysisClientOwner,
  type FollowingTransferSession,
} from '@woordenaar/domain'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { dictionaryFollowingTransferRepository as journal } from '@/db/dictionaryFollowingTransferRepository'
import { dictionaryFollowingImportRepository } from '@/db/dictionaryFollowingImportRepository'
import { supabase } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { withDictionaryImportOwner } from './dictionaryImportOwner'

const client = (userId: string) => {
  const sdk =
    supabase as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
  return createDictionaryFollowingTransferClient({
    userId,
    journal,
    enabled: isDictionaryFollowingImportsEnabled,
    createId: Crypto.randomUUID,
    readPublished: (ids, owner) =>
      readFollowingTransferRevisions(ids, owner, selected =>
        sdk
          .from('dictionary_revisions')
          .select(DICTIONARY_TRANSFER_REVISION_COLUMNS)
          .in('revision_id', selected)
          .eq('review_status', 'published')
      ),
    imports: createDictionaryFollowingImportClient({
      userId,
      journal: dictionaryFollowingImportRepository,
      enabled: isDictionaryFollowingImportsEnabled,
      remote: {
        rpc: (name, args) =>
          sdk.rpc(
            name,
            args as { p_intent: Json } | { p_request: Json } | undefined
          ),
      },
    }),
  })
}
const local = async <T>(
  userId: string,
  action: (owner: DictionaryAnalysisClientOwner) => Promise<T>
) => {
  let changed = false
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || session?.user.id !== userId) changed = true
  })
  const assert = () => {
    if (changed || useApplicationStore.getState().currentUserId !== userId)
      throw new Error('Authentication changed during local dictionary transfer')
  }
  try {
    assert()
    const result = await action({ assert, check: async () => assert() })
    assert()
    return result
  } finally {
    subscription.unsubscribe()
  }
}
export const dictionaryFollowingTransferService = {
  list: (userId: string) => local(userId, () => client(userId).list()),
  prepare: (value: FollowingTransferSession) =>
    local(value.user_id, owner => client(value.user_id).prepare(value, owner)),
  resolve: (userId: string, sessionId: string) =>
    withDictionaryImportOwner(userId, owner =>
      client(userId).resolve(sessionId, owner)
    ),
  queueEntry: (userId: string, sessionId: string, index: number) =>
    local(userId, owner => client(userId).queueEntry(sessionId, index, owner)),
  deliverEntry: (userId: string, sessionId: string, index: number) =>
    withDictionaryImportOwner(userId, owner =>
      client(userId).deliverEntry(sessionId, index, owner)
    ),
}
