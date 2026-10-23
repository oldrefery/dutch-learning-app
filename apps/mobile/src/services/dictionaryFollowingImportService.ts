import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Json,
  DictionaryFollowingImportDatabase,
} from '@woordenaar/supabase-contracts'
import {
  createDictionaryFollowingImportClient,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { dictionaryFollowingImportRepository as journal } from '@/db/dictionaryFollowingImportRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { supabase } from '@/lib/supabase'
import {
  withDictionaryImportOwner,
  type DictionaryOwnerGuard,
} from './dictionaryImportOwner'

const client = (userId: string) => {
  const sdk =
    supabase as unknown as SupabaseClient<DictionaryFollowingImportDatabase>
  return createDictionaryFollowingImportClient({
    userId,
    journal,
    enabled: isDictionaryFollowingImportsEnabled,
    remote: {
      rpc: (name, args) =>
        sdk.rpc(
          name,
          args as { p_intent: Json } | { p_request: Json } | undefined
        ),
    },
  })
}

const run = <T>(
  value: FollowingImportOperation,
  assertCurrent: () => void,
  action: (owner: DictionaryOwnerGuard) => Promise<T>
) =>
  withDictionaryImportOwner(value.user_id, owner => {
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
    return action({ assert, check })
  })

/** Explicit owner-scoped operations. Remote insert/move receipts remain separate
 * from personal pull and shared hydration; reading a receipt never writes SRS. */
export const dictionaryFollowingImportService = {
  list: journal.list,
  async queue(value: FollowingImportOperation) {
    let changed = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || session?.user.id !== value.user_id)
        changed = true
    })
    const assertOwner = () => {
      if (
        changed ||
        useApplicationStore.getState().currentUserId !== value.user_id
      )
        throw new Error('Authentication changed during local dictionary import')
    }
    try {
      // Local metadata only; authentication, source and creation authority are
      // independently checked online at explicit delivery. No getUser RPC here.
      return await client(value.user_id).queue(value, assertOwner)
    } finally {
      subscription.unsubscribe()
    }
  },
  async prepare(
    value: FollowingImportOperation,
    assertCurrent: () => void = () => {}
  ) {
    return run(value, assertCurrent, owner =>
      client(value.user_id).prepare(value, owner)
    )
  },
  async deliver(
    value: FollowingImportOperation,
    assertCurrent: () => void = () => {}
  ) {
    return run(value, assertCurrent, owner =>
      client(value.user_id).deliver(value, owner)
    )
  },
  async readState(
    value: FollowingImportOperation,
    assertCurrent: () => void = () => {}
  ) {
    return run(value, assertCurrent, owner =>
      client(value.user_id).readState(value, owner)
    )
  },
}
