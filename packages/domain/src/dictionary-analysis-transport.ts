import { parseDictionaryAnalysisActorV1 } from './dictionary-analysis-actor'
import type { DictionaryAnalysisCommandV2 } from './dictionary-analysis'
import { parseDictionaryFollowingCapability } from './dictionary-following'
import {
  createDictionaryAnalysisClient,
  type DictionaryAnalysisClientJournal,
  type DictionaryAnalysisClientOperation,
  type DictionaryAnalysisClientOwner,
} from './dictionary-analysis-client'

export interface DictionaryAnalysisRemote {
  rpc(
    name:
      | 'dictionary_content_capability_v2'
      | 'get_dictionary_analysis_operation_v2'
      | 'dictionary_analysis_actor_v1',
    args?: { p_operation: string }
  ): PromiseLike<{ data: unknown; error: unknown }>
  getSession(): Promise<{
    data: { session: { user: { id: string }; access_token: string } | null }
    error: unknown
  }>
  invoke(
    name: 'dictionary-analysis',
    options: {
      body: DictionaryAnalysisCommandV2
      headers: { Authorization: string }
    }
  ): Promise<{ data: unknown; error: unknown }>
}

/** Dormant transport binding. Receipt reads bypass feature/permission availability;
 * submission is gated and never retried. Tokens remain only in the SDK call. */
export function createDictionaryAnalysisRemoteClient(options: {
  userId: string
  journal: DictionaryAnalysisClientJournal
  remote: DictionaryAnalysisRemote
  enabled: () => boolean
  refresh: (
    operation: DictionaryAnalysisClientOperation,
    owner: DictionaryAnalysisClientOwner
  ) => Promise<void>
}) {
  const requireEnabled = () => {
    if (!options.enabled())
      throw new Error('Shared dictionary analysis is unavailable')
  }
  const requireAvailable = async (owner: DictionaryAnalysisClientOwner) => {
    requireEnabled()
    await owner.check()
    const { data, error } = await options.remote.rpc(
      'dictionary_content_capability_v2'
    )
    await owner.check()
    const parsed = parseDictionaryFollowingCapability(data)
    if (
      error ||
      !parsed.success ||
      !parsed.data.following_enabled ||
      !parsed.data.shared_analysis_enabled ||
      !parsed.data.command_protocol_versions.includes(2)
    )
      throw new Error('Shared dictionary analysis is unavailable')
    requireEnabled()

    const actor = await options.remote.rpc('dictionary_analysis_actor_v1')
    await owner.check()
    const permission = parseDictionaryAnalysisActorV1(actor.data)
    if (
      actor.error ||
      permission.actor_id !== options.userId ||
      !permission.may_analyze
    )
      throw new Error('Shared analysis permission is unavailable')
    requireEnabled()
  }
  const client = createDictionaryAnalysisClient({
    userId: options.userId,
    journal: options.journal,
    requireAvailable,
    async submit(command, owner) {
      await requireAvailable(owner)
      const { data, error } = await options.remote.getSession()
      owner.assert()
      if (
        error ||
        data.session?.user.id !== options.userId ||
        !data.session.access_token
      )
        throw new Error('Shared analysis authentication is unavailable')
      requireEnabled()
      const response = await options.remote.invoke('dictionary-analysis', {
        body: command,
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      await owner.check()
      if (response.error)
        throw new Error(
          'Shared analysis reply is unavailable; read the existing operation'
        )
      return response.data
    },
    async readReceipt(operationId, owner) {
      await owner.check()
      const { data, error } = await options.remote.rpc(
        'get_dictionary_analysis_operation_v2',
        { p_operation: operationId }
      )
      await owner.check()
      if (error) throw new Error('Shared analysis receipt is unavailable')
      return data
    },
    refresh: options.refresh,
  })
  return {
    ...client,
    async isAvailable(owner: DictionaryAnalysisClientOwner): Promise<boolean> {
      if (!options.enabled()) return false
      try {
        await requireAvailable(owner)
        return true
      } catch {
        owner.assert()
        return false
      }
    },
  }
}
