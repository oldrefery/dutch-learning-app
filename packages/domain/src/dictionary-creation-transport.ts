import type { DictionaryCreationOwner } from './dictionary-creation-owner'
import { parseDictionaryAnalysisActorV1 } from './dictionary-analysis-actor'
import { parseDictionaryFollowingCapability } from './dictionary-following'
import { createDictionaryCreationWorkflow } from './dictionary-creation-workflow'
import type { DictionaryMeaningResolutionRequestV2 } from './dictionary-creation'
import type { DictionaryCreationOwnerCommandV2 } from './dictionary-creation-recovery'
import {
  assertCreationJournalOwner,
  type DictionaryCreationJournal,
} from './dictionary-creation-journal'

type Reply = PromiseLike<{ data: unknown; error: unknown }>
export interface DictionaryCreationRemote {
  capability(): Reply
  actor(): Reply
  requestResolution(request: DictionaryMeaningResolutionRequestV2): Reply
  readResolution(id: string): Reply
  readReceipt(id: string): Reply
  getSession(): Promise<{
    data: { session: { user: { id: string }; access_token: string } | null }
    error: unknown
  }>
  getUser(
    token: string
  ): Promise<{ data: { user: { id: string } | null }; error: unknown }>
  invoke(
    name: 'dictionary-creation',
    options: {
      body: DictionaryCreationOwnerCommandV2
      headers: { Authorization: string }
      signal: AbortSignal
    }
  ): Promise<{ data: unknown; error: unknown }>
}
/** Existing following/analysis capability and actor preflight. Creation-specific
 * dormant SQL gates remain server authority; preflight is not a creation approval. */
export function createDictionaryCreationRemoteClient(options: {
  userId: string
  journal: DictionaryCreationJournal
  remote: DictionaryCreationRemote
  enabled(): boolean
}) {
  const unavailable = () => {
    throw new Error('Dictionary creation is unavailable')
  }
  const enabled = () => {
    if (!options.enabled()) unavailable()
  }
  const requireAvailable = async (owner: DictionaryCreationOwner) => {
    assertCreationJournalOwner(options.userId, owner)
    enabled()
    await owner.check()
    const capability = await options.remote.capability()
    await owner.check()
    const parsed = parseDictionaryFollowingCapability(capability.data)
    if (
      capability.error ||
      !parsed.success ||
      !parsed.data.following_enabled ||
      !parsed.data.shared_analysis_enabled ||
      !parsed.data.command_protocol_versions.includes(2)
    )
      unavailable()
    enabled()
    const actor = await options.remote.actor()
    await owner.check()
    const permission = parseDictionaryAnalysisActorV1(actor.data)
    if (
      actor.error ||
      permission.actor_id !== options.userId ||
      !permission.may_analyze
    )
      unavailable()
    enabled()
  }
  const read = async (action: () => Reply, owner: DictionaryCreationOwner) => {
    await owner.check()
    const response = await action()
    await owner.check()
    if (response.error) throw new Error('Creation status is unavailable')
    return response.data
  }
  const client = createDictionaryCreationWorkflow({
    userId: options.userId,
    journal: options.journal,
    requireAvailable,
    readResolution: (id, owner) =>
      read(() => options.remote.readResolution(id), owner),
    readReceipt: (id, owner) =>
      read(() => options.remote.readReceipt(id), owner),
    async requestResolution(request, owner) {
      await requireAvailable(owner)
      const response = await options.remote.requestResolution(request)
      await owner.check()
      if (response.error)
        throw new Error(
          'Meaning request reply is unavailable; read the same resolution'
        )
      return response.data
    },
    async submit(command, owner) {
      await requireAvailable(owner)
      const session = await options.remote.getSession()
      await owner.check()
      if (
        session.error ||
        session.data.session?.user.id !== options.userId ||
        !session.data.session.access_token ||
        /\s/.test(session.data.session.access_token)
      )
        throw new Error('Creation authentication is unavailable')
      const token = session.data.session.access_token
      const verified = await options.remote.getUser(token)
      await owner.check()
      if (verified.error || verified.data.user?.id !== options.userId)
        throw new Error('Creation authentication is unavailable')
      enabled()
      owner.assert()
      const response = await options.remote.invoke('dictionary-creation', {
        body: command,
        headers: { Authorization: `Bearer ${token}` },
        signal: owner.signal,
      })
      await owner.check()
      if (response.error)
        throw new Error(
          'Creation reply is unavailable; read the existing operation'
        )
      return response.data
    },
  })
  return {
    ...client,
    async isAvailable(owner: DictionaryCreationOwner) {
      assertCreationJournalOwner(options.userId, owner)
      if (!options.enabled()) {
        owner.assert()
        return false
      }
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
