import type { DictionaryAnalysisClientOwner } from './dictionary-analysis-client'
import type { DictionaryRevision } from './shared-dictionary'
import {
  requireFollowingImportOwner,
  type FollowingImportOperation,
} from './dictionary-following-import-journal'
import {
  parseFollowingTransferSession,
  type FollowingTransferJournal,
  type FollowingTransferSession,
} from './dictionary-following-transfer-journal'

/** Documents and index-to-nonce mappings must be durable before reserving or
 * delivering a root. Receipts never stand in for personal/shared hydration. */
export function createDictionaryFollowingTransferClient(ports: {
  userId: string
  enabled: () => boolean
  journal: FollowingTransferJournal
  readPublished: (
    ids: readonly string[],
    owner: DictionaryAnalysisClientOwner
  ) => Promise<DictionaryRevision[]>
  createId: () => string
  imports: {
    queue(
      value: FollowingImportOperation,
      assertOwner: () => void
    ): Promise<FollowingImportOperation>
    deliver(
      value: FollowingImportOperation,
      owner: DictionaryAnalysisClientOwner
    ): Promise<FollowingImportOperation>
  }
}) {
  requireFollowingImportOwner(ports.userId)
  const assert = (owner: DictionaryAnalysisClientOwner) => {
    owner.assert()
    if (!ports.enabled()) throw new Error('Following transfers are unavailable')
  }
  const saved = async (
    sessionId: string,
    owner: DictionaryAnalysisClientOwner
  ) => {
    owner.assert()
    const row = (await ports.journal.list(ports.userId)).find(
      row => row.session_id === sessionId
    )
    owner.assert()
    if (!row) throw new Error('Following transfer session is unavailable')
    return row
  }
  const operation = async (
    sessionId: string,
    index: number,
    owner: DictionaryAnalysisClientOwner
  ): Promise<FollowingImportOperation> => {
    const row = await saved(sessionId, owner)
    const item = row.plan?.intents.find(item => item.index === index)
    if (!item) throw new Error('This transfer entry requires review')
    return {
      user_id: ports.userId,
      kind: 'import',
      request: item.intent,
      result: null,
    }
  }
  return {
    list: () => ports.journal.list(ports.userId),
    async prepare(
      value: FollowingTransferSession,
      owner: DictionaryAnalysisClientOwner
    ) {
      assert(owner)
      const input = parseFollowingTransferSession(value)
      if (input.user_id !== ports.userId)
        throw new Error('Following transfer owner mismatch')
      return ports.journal.prepare(input, () => assert(owner))
    },
    async resolve(sessionId: string, owner: DictionaryAnalysisClientOwner) {
      const row = await saved(sessionId, owner)
      if (row.plan) return row
      assert(owner)
      await owner.check()
      const ids = [
        ...new Set(
          row.selected_indexes.flatMap(index => {
            const hint = row.document.entries[index].shared_reference
            return hint ? [hint.reference.revision_id] : []
          })
        ),
      ]
      const revisions = await ports.readPublished(ids, owner)
      await owner.check()
      assert(owner)
      return ports.journal.decide(row, revisions, ports.createId, () =>
        assert(owner)
      )
    },
    async queueEntry(
      sessionId: string,
      index: number,
      owner: DictionaryAnalysisClientOwner
    ) {
      return ports.imports.queue(await operation(sessionId, index, owner), () =>
        assert(owner)
      )
    },
    async deliverEntry(
      sessionId: string,
      index: number,
      owner: DictionaryAnalysisClientOwner
    ) {
      // Reservation is a separate explicit action. Missing roots fail closed;
      // existing finished roots remain readable when creation gates withdraw.
      const value = await operation(sessionId, index, owner)
      return ports.imports.deliver(value, owner)
    },
  }
}
