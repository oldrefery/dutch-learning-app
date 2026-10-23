import type { DictionaryCreationOwner } from './dictionary-creation-owner'
import {
  prepareDictionaryCreationCommand,
  recordDictionaryMeaningResolution,
  reconcileDictionaryCreationResponse,
} from './dictionary-creation-client'
import {
  parseCreationJournalRow,
  requireCreationJournalIntent,
  assertCreationJournalOwner,
  type DictionaryCreationJournal,
  type DictionaryCreationJournalRow,
} from './dictionary-creation-journal'
import { canonicalizeJson } from './shared-dictionary'
import type { DictionaryMeaningResolutionRequestV2 } from './dictionary-creation'
import type { DictionaryCreationOwnerCommandV2 } from './dictionary-creation-recovery'

export interface DictionaryCreationWorkflowPorts {
  userId: string
  journal: DictionaryCreationJournal
  requireAvailable(owner: DictionaryCreationOwner): Promise<void>
  requestResolution(
    request: DictionaryMeaningResolutionRequestV2,
    owner: DictionaryCreationOwner
  ): Promise<unknown>
  readResolution(id: string, owner: DictionaryCreationOwner): Promise<unknown>
  submit(
    command: DictionaryCreationOwnerCommandV2,
    owner: DictionaryCreationOwner
  ): Promise<unknown>
  readReceipt(id: string, owner: DictionaryCreationOwner): Promise<unknown>
}
/** Resolution is idempotent and uncharged. Creation dispatch requires a fresh durable
 * claim; every restored submitted command uses status reads only. No personal adoption. */
export function createDictionaryCreationWorkflow(
  ports: DictionaryCreationWorkflowPorts
) {
  const owned = (
    value: DictionaryCreationJournalRow,
    owner: DictionaryCreationOwner
  ) => {
    const row = parseCreationJournalRow(value)
    assertCreationJournalOwner(ports.userId, owner)
    if (row.session.user_id !== ports.userId)
      throw new Error('Creation workflow owner mismatch')
    return row
  }
  const latest = async (
    expected: DictionaryCreationJournalRow,
    owner: DictionaryCreationOwner
  ) => {
    const row = owned(expected, owner)
    const saved = await ports.journal.read(
      ports.userId,
      row.session.request.resolution_id,
      owner
    )
    owner.assert()
    return requireCreationJournalIntent(saved ?? undefined, row)
  }
  const saveResolution = async (
    row: DictionaryCreationJournalRow,
    value: unknown,
    owner: DictionaryCreationOwner
  ) => {
    await owner.check()
    const current = await latest(row, owner)
    if (value === null) {
      if (current.session.resolution)
        throw new Error('Creation resolution is unavailable')
      return current
    }
    const session = recordDictionaryMeaningResolution(
      current.session,
      value,
      ports.userId
    )
    return ports.journal.save(current, { ...current, session }, owner)
  }
  const recover = async (
    row: DictionaryCreationJournalRow,
    owner: DictionaryCreationOwner
  ) => {
    if (!row.session.command || !row.session.submitted) return row
    const value = await ports.readReceipt(
      row.session.command.operation_id,
      owner
    )
    await owner.check()
    const current = await latest(row, owner)
    if (value === null) {
      if (current.session.response)
        throw new Error('Creation receipt is unavailable')
      return current
    }
    const session = reconcileDictionaryCreationResponse(
      current.session,
      value,
      ports.userId
    )
    return ports.journal.save(current, { ...current, session }, owner)
  }
  return {
    async list(owner: DictionaryCreationOwner) {
      assertCreationJournalOwner(ports.userId, owner)
      return ports.journal.list(ports.userId, owner)
    },
    async readSaved(id: string, owner: DictionaryCreationOwner) {
      assertCreationJournalOwner(ports.userId, owner)
      return ports.journal.read(ports.userId, id, owner)
    },
    async resolve(
      value: DictionaryCreationJournalRow,
      owner: DictionaryCreationOwner
    ) {
      const candidate = owned(value, owner)
      const row = await ports.journal.prepare(candidate, owner)
      if (row.session.resolution) return row
      const prior = await ports.readResolution(
        row.session.request.resolution_id,
        owner
      )
      if (prior !== null) return saveResolution(row, prior, owner)
      await ports.requireAvailable(owner)
      await owner.check()
      const receipt = await ports.requestResolution(row.session.request, owner)
      return saveResolution(row, receipt, owner)
    },
    async recoverResolution(id: string, owner: DictionaryCreationOwner) {
      assertCreationJournalOwner(ports.userId, owner)
      const row = await ports.journal.read(ports.userId, id, owner)
      if (!row) return null
      const receipt = await ports.readResolution(id, owner)
      return saveResolution(row, receipt, owner)
    },
    async prepareCommand(
      expected: DictionaryCreationJournalRow,
      operationId: string,
      owner: DictionaryCreationOwner,
      recoveryId?: string
    ) {
      const row = await latest(expected, owner)
      await ports.requireAvailable(owner)
      await owner.check()
      const session = prepareDictionaryCreationCommand(
        row.session,
        operationId,
        ports.userId
      )
      const next = parseCreationJournalRow({
        ...row,
        session: {
          ...session,
          command: {
            ...session.command,
            ...(recoveryId === undefined ? {} : { recovery_id: recoveryId }),
          },
        },
      })
      return ports.journal.save(expected, next, owner)
    },
    async submit(
      expected: DictionaryCreationJournalRow,
      owner: DictionaryCreationOwner
    ) {
      const candidate = owned(expected, owner)
      const row = await latest(candidate, owner)
      if (
        canonicalizeJson(row.session.command) !==
        canonicalizeJson(candidate.session.command)
      )
        throw new Error('Creation command changed before submission')
      if (row.session.submitted) return recover(row, owner)
      if (!row.session.command) throw new Error('Creation command is missing')
      await ports.requireAvailable(owner)
      await owner.check()
      const claim = await ports.journal.claim(row, owner)
      if (!claim.claimed) return recover(claim.row, owner)
      const response = await ports.submit(claim.row.session.command!, owner)
      await owner.check()
      const current = await latest(claim.row, owner)
      const session = reconcileDictionaryCreationResponse(
        current.session,
        response,
        ports.userId
      )
      return ports.journal.save(current, { ...current, session }, owner)
    },
    async recover(id: string, owner: DictionaryCreationOwner) {
      assertCreationJournalOwner(ports.userId, owner)
      const row = await ports.journal.read(ports.userId, id, owner)
      return row ? recover(row, owner) : null
    },
  }
}
