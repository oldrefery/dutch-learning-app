import { parseDictionaryImportIntentV2 } from './dictionary-following-import'
import { parseDictionaryImportRecoveryStateV2 } from './dictionary-following-import-recovery'
import { parseDictionaryFollowingCapability } from './dictionary-following'
import {
  followingImportRoot,
  parseFollowingImportOperation,
  requireFollowingImportOwner,
  type FollowingImportJournal,
  type FollowingImportOperation,
} from './dictionary-following-import-journal'
import type { DictionaryAnalysisClientOwner } from './dictionary-analysis-client'

export type FollowingImportRpcName =
  | 'dictionary_content_capability_v2'
  | 'apply_dictionary_import_intent_v2'
  | 'read_dictionary_import_recovery_v2'
  | 'recover_dictionary_import_v2'
  | 'cancel_dictionary_import_v2'
export interface FollowingImportRemote {
  rpc(
    name: FollowingImportRpcName,
    args?: { p_intent: unknown } | { p_request: unknown }
  ): PromiseLike<{ data: unknown; error: unknown }>
}

/** No construction-time requests or private-copy fallback. Explicit delivery may
 * replay only the same saved import nonce; these RPCs never call a paid provider. */
export function createDictionaryFollowingImportClient(ports: {
  userId: string
  enabled: () => boolean
  journal: FollowingImportJournal
  remote: FollowingImportRemote
}) {
  const userId = requireFollowingImportOwner(ports.userId)
  const owned = (value: unknown) => {
    const row = parseFollowingImportOperation(value)
    if (row.user_id !== userId)
      throw new Error('Following import owner mismatch')
    return row
  }
  const call = async (
    name: FollowingImportRpcName,
    args: { p_intent: unknown } | { p_request: unknown } | undefined,
    owner: DictionaryAnalysisClientOwner
  ) => {
    await owner.check()
    const { data, error } = await ports.remote.rpc(name, args)
    await owner.check()
    if (error) throw error
    return data
  }
  const requireEnabled = () => {
    if (!ports.enabled()) throw new Error('Following imports are unavailable')
  }
  const availability = async (owner: DictionaryAnalysisClientOwner) => {
    requireEnabled()
    const parsed = parseDictionaryFollowingCapability(
      await call('dictionary_content_capability_v2', undefined, owner)
    )
    requireEnabled()
    if (
      !parsed.success ||
      !parsed.data.following_enabled ||
      !parsed.data.command_protocol_versions.includes(2)
    )
      throw new Error('Following imports are unavailable')
    // The server independently enforces its nonpublic imports gate at creation.
  }
  const saved = async (
    value: FollowingImportOperation,
    owner: DictionaryAnalysisClientOwner
  ) => {
    const expected = owned(value)
    owner.assert()
    const row = (await ports.journal.list(userId)).find(
      row => row.request.operation_id === expected.request.operation_id
    )
    if (
      !row ||
      row.kind !== expected.kind ||
      JSON.stringify(row.request) !== JSON.stringify(expected.request)
    )
      throw new Error('Following import intent changed')
    owner.assert()
    return row
  }
  const readState = async (
    value: FollowingImportOperation,
    owner: DictionaryAnalysisClientOwner
  ) => {
    const row = await saved(value, owner)
    const intent = followingImportRoot(row)
    return parseDictionaryImportRecoveryStateV2(
      await call(
        'read_dictionary_import_recovery_v2',
        { p_intent: intent },
        owner
      ),
      intent
    )
  }
  return {
    async queue(value: FollowingImportOperation, assertOwner: () => void) {
      const row = owned(value)
      if (row.kind !== 'import')
        throw new Error('Recovery requires current server state')
      const assertQueue = () => {
        assertOwner()
        requireEnabled()
      }
      assertQueue()
      return ports.journal.prepare(row, assertQueue)
    },
    async prepare(
      value: FollowingImportOperation,
      owner: DictionaryAnalysisClientOwner
    ) {
      const row = owned(value)
      if (row.kind === 'import') await availability(owner)
      else {
        const root = (await ports.journal.list(userId)).find(
          item =>
            item.kind === 'import' &&
            item.request.operation_id === followingImportRoot(row).operation_id
        )
        if (!root)
          throw new Error('Following import original intent is unavailable')
        if (
          JSON.stringify(root.request) !==
          JSON.stringify(followingImportRoot(row))
        )
          throw new Error('Following import original intent changed')
        if (row.kind === 'recover') {
          const state = await readState(root, owner)
          if (
            state.state === 'cancelled' ||
            state.recovery_version !== row.request.expected_recovery_version ||
            state.collection_id !== row.request.expected_collection_id
          )
            throw new Error(
              'Following import placement changed; reload recovery state'
            )
          if (!state.inserted_once) await availability(owner)
        }
      }
      await owner.check()
      return ports.journal.prepare(row, owner.assert)
    },
    readState,
    async deliver(
      value: FollowingImportOperation,
      owner: DictionaryAnalysisClientOwner
    ) {
      const row = await saved(value, owner)
      if (row.result !== null) return row
      if (row.kind === 'import') {
        const rows = await ports.journal.list(userId)
        if (
          rows.some(
            item =>
              item.kind !== 'import' &&
              followingImportRoot(item).operation_id ===
                row.request.operation_id
          )
        )
          throw new Error(
            'Following import original delivery is fenced by recovery'
          )
        await availability(owner)
      }
      if (row.kind === 'recover') {
        const state = await readState(row, owner)
        if (!state.inserted_once) await availability(owner)
      }
      const name =
        row.kind === 'import'
          ? 'apply_dictionary_import_intent_v2'
          : row.kind === 'recover'
            ? 'recover_dictionary_import_v2'
            : 'cancel_dictionary_import_v2'
      const result = await call(
        name,
        row.kind === 'import'
          ? { p_intent: parseDictionaryImportIntentV2(row.request) }
          : { p_request: row.request },
        owner
      )
      return ports.journal.save(row, result, owner.assert)
    },
  }
}
