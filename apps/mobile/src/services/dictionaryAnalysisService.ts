import {
  createDictionaryAnalysisRemoteClient,
  type DictionaryAnalysisClientOperation,
} from '@woordenaar/domain'
import { isDictionarySharedAnalysisEnabled } from '@/constants/dictionaryContent'
import { dictionaryAnalysisRepository } from '@/db/dictionaryAnalysisRepository'
import { supabase } from '@/lib/supabase'
import { dictionaryFollowingSync } from './dictionaryFollowingSync'
import {
  withDictionaryOwner,
  type DictionaryOwnerGuard,
} from './dictionaryImportOwner'

const OWNER_CONTEXT = 'shared analysis'
const client = (userId: string) =>
  createDictionaryAnalysisRemoteClient({
    userId,
    journal: dictionaryAnalysisRepository,
    enabled: isDictionarySharedAnalysisEnabled,
    remote: {
      rpc: (name, args) => supabase.rpc(name, args),
      getSession: () => supabase.auth.getSession(),
      invoke: (name, options) => supabase.functions.invoke(name, options),
    },
    refresh: async (operation, owner) => {
      await dictionaryFollowingSync.pullForAnalysis(operation, owner)
    },
  })

const run = <T>(
  userId: string,
  assertCurrent: () => void,
  action: (owner: DictionaryOwnerGuard) => Promise<T>
) =>
  withDictionaryOwner(
    userId,
    async owner => {
      const guard = () => {
        owner.assert()
        assertCurrent()
      }
      guard()
      return action({
        assert: guard,
        check: async () => {
          await owner.check()
          guard()
        },
      })
    },
    OWNER_CONTEXT
  )

/** SDK and journal binding only; no automatic POST, no private analysis or UI enablement. */
export const dictionaryAnalysisService = {
  async readHistory(userId: string, wordId: string) {
    return dictionaryAnalysisRepository.history(userId, wordId)
  },
  async nextAttempt(
    expected: DictionaryAnalysisClientOperation,
    candidate: DictionaryAnalysisClientOperation,
    assertCurrent: () => void = () => {}
  ) {
    return run(expected.user_id, assertCurrent, owner =>
      client(expected.user_id).nextAttempt(expected, candidate, owner)
    )
  },
  async readSaved(userId: string, wordId: string) {
    return dictionaryAnalysisRepository.read(userId, wordId)
  },
  async isAvailable(userId: string): Promise<boolean> {
    if (!isDictionarySharedAnalysisEnabled()) return false
    return withDictionaryOwner(
      userId,
      owner => client(userId).isAvailable(owner),
      OWNER_CONTEXT
    )
  },
  async submit(
    operation: DictionaryAnalysisClientOperation,
    assertCurrent: () => void = () => {}
  ) {
    return run(operation.user_id, assertCurrent, owner =>
      client(operation.user_id).submit(operation, owner)
    )
  },
  async loadPublished(
    operation: DictionaryAnalysisClientOperation,
    assertCurrent: () => void = () => {}
  ) {
    return run(operation.user_id, assertCurrent, owner =>
      client(operation.user_id).loadPublished(operation, owner)
    )
  },
  async recover(
    userId: string,
    wordId: string,
    assertCurrent: () => void = () => {}
  ) {
    return run(userId, assertCurrent, owner =>
      client(userId).recover(userId, wordId, owner)
    )
  },
}
