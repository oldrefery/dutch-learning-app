import {
  parseDictionaryAnalysisCommandV2,
  parseDictionaryAnalysisAcceptanceV2,
  parseDictionaryAnalysisReceiptV2,
  type DictionaryAnalysisCommandV2,
  type DictionaryAnalysisAcceptanceV2,
  type DictionaryAnalysisReceiptV2,
} from './dictionary-analysis'
import { compareDictionarySequences } from './dictionary-following'
import { canonicalizeJson } from './shared-dictionary'
import type { DictionaryAnalysisAttemptJournal } from './dictionary-analysis-attempts'

/** Operation metadata only: no linguistic payload, token, role or provider key. */
export interface DictionaryAnalysisClientOperation {
  user_id: string
  word_id: string
  command: DictionaryAnalysisCommandV2
  submitted: boolean
  response: DictionaryAnalysisAcceptanceV2 | null
}
export interface DictionaryAnalysisClientOwner {
  assert(): void
  check(): Promise<void>
}
export interface DictionaryAnalysisClientJournal {
  read(
    userId: string,
    wordId: string
  ): Promise<DictionaryAnalysisClientOperation | null>
  prepare(
    operation: DictionaryAnalysisClientOperation,
    assertOwner: () => void
  ): Promise<DictionaryAnalysisClientOperation>
  claim(
    operation: DictionaryAnalysisClientOperation,
    assertOwner: () => void
  ): Promise<boolean>
  save(
    operation: DictionaryAnalysisClientOperation,
    response: unknown,
    assertOwner: () => void
  ): Promise<DictionaryAnalysisClientOperation>
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTIVE = [
  'accepted',
  'dispatching',
  'validating',
  'provider-outcome-unknown',
]

export const isDictionaryAnalysisTerminal = (
  response: DictionaryAnalysisAcceptanceV2 | null
): response is DictionaryAnalysisReceiptV2 =>
  response !== null &&
  !('outcome' in response) &&
  !ACTIVE.includes(response.status)

const commandIdentity = (command: DictionaryAnalysisCommandV2) =>
  canonicalizeJson(command)
export const matchDictionaryAnalysisResponse = (
  command: DictionaryAnalysisCommandV2,
  value: unknown,
  previous: DictionaryAnalysisAcceptanceV2 | null = null
): DictionaryAnalysisAcceptanceV2 => {
  const parsed = parseDictionaryAnalysisAcceptanceV2(value)
  if (!parsed.success) throw new Error('Invalid shared analysis response')
  const result = parsed.data
  if ('outcome' in result) {
    if (previous && !('outcome' in previous))
      throw new Error('Shared analysis receipt was lost')
    return result
  }
  const {
    protocol_version,
    operation_id,
    entry_id,
    expected_revision_id,
    expected_head_sequence,
  } = result
  if (
    commandIdentity({
      protocol_version,
      operation_id,
      entry_id,
      expected_revision_id,
      expected_head_sequence,
    }) !== commandIdentity(command)
  )
    throw new Error('Shared analysis response belongs to another request')
  if (
    result.status === 'published' &&
    (compareDictionarySequences(
      result.published_head_sequence!,
      command.expected_head_sequence
    ) <= 0 ||
      result.published_revision_id === command.expected_revision_id)
  )
    throw new Error('Invalid shared analysis publication boundary')
  if (
    result.status === 'no-change' &&
    (result.published_head_sequence !== command.expected_head_sequence ||
      result.published_revision_id !== command.expected_revision_id)
  )
    throw new Error('Invalid unchanged shared analysis boundary')
  if (previous && !('outcome' in previous))
    validateReceiptProgress(previous, result)
  return result
}

const validateReceiptProgress = (
  previous: DictionaryAnalysisReceiptV2,
  next: DictionaryAnalysisReceiptV2
) => {
  if (previous.fence !== next.fence)
    throw new Error('Shared analysis fence changed')
  if (
    isDictionaryAnalysisTerminal(previous) &&
    canonicalizeJson(previous) !== canonicalizeJson(next)
  )
    throw new Error('Terminal shared analysis receipt changed')
  // Unknown outcome can quarantine either generation or semantic validation.
  // Explicit server reconciliation may resume validation with the same result.
  if (
    (next.status === 'accepted' && previous.status !== 'accepted') ||
    (next.status === 'dispatching' &&
      !['accepted', 'dispatching'].includes(previous.status))
  )
    throw new Error('Stale shared analysis receipt')
  if (
    previous.result_sha256 !== null &&
    next.result_sha256 !== previous.result_sha256
  )
    throw new Error('Durable shared analysis result changed')
}

export const parseDictionaryAnalysisClientOperation = (
  value: unknown
): DictionaryAnalysisClientOperation => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid local shared analysis operation')
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== 5 ||
    typeof row.user_id !== 'string' ||
    !UUID.test(row.user_id) ||
    typeof row.word_id !== 'string' ||
    !UUID.test(row.word_id) ||
    typeof row.submitted !== 'boolean' ||
    !Object.hasOwn(row, 'response')
  )
    throw new Error('Invalid local shared analysis identity')
  const parsed = parseDictionaryAnalysisCommandV2(row.command)
  if (!parsed.success) throw new Error('Invalid local shared analysis command')
  const response =
    row.response === null
      ? null
      : matchDictionaryAnalysisResponse(parsed.data, row.response)
  if (!row.submitted && response !== null)
    throw new Error('Premature local shared analysis response')
  return {
    user_id: row.user_id.toLowerCase(),
    word_id: row.word_id.toLowerCase(),
    command: parsed.data,
    submitted: row.submitted,
    response,
  }
}

export const requireSameAnalysisOperation = (
  current: DictionaryAnalysisClientOperation | null,
  expected: DictionaryAnalysisClientOperation
): DictionaryAnalysisClientOperation => {
  if (
    !current ||
    current.user_id !== expected.user_id ||
    current.word_id !== expected.word_id ||
    commandIdentity(current.command) !== commandIdentity(expected.command)
  )
    throw new Error('Local shared analysis operation changed')
  return current
}

/** Only explicit submit dispatches an endpoint. Recovery never calls it. Each local
 * intent claims submission durably once; even an uncertain reply cannot resend it. */
export const createDictionaryAnalysisClient = (ports: {
  userId: string
  journal: DictionaryAnalysisClientJournal &
    Partial<Pick<DictionaryAnalysisAttemptJournal, 'replace'>>
  requireAvailable(owner: DictionaryAnalysisClientOwner): Promise<void>
  submit(
    command: DictionaryAnalysisCommandV2,
    owner: DictionaryAnalysisClientOwner
  ): Promise<unknown>
  readReceipt(
    operationId: string,
    owner: DictionaryAnalysisClientOwner
  ): Promise<unknown>
  refresh(
    operation: DictionaryAnalysisClientOperation,
    owner: DictionaryAnalysisClientOwner
  ): Promise<void>
}) => {
  const recover = async (
    operation: DictionaryAnalysisClientOperation,
    owner: DictionaryAnalysisClientOwner
  ) => {
    owner.assert()
    const value = await ports.readReceipt(operation.command.operation_id, owner)
    await owner.check()
    owner.assert()
    if (value !== null && !parseDictionaryAnalysisReceiptV2(value).success)
      throw new Error('Invalid shared analysis recovery receipt')
    const latest = requireSameAnalysisOperation(
      await ports.journal.read(operation.user_id, operation.word_id),
      operation
    )
    owner.assert()
    const current =
      value === null
        ? latest
        : await ports.journal.save(latest, value, owner.assert)
    if (value === null && latest.response && !('outcome' in latest.response))
      throw new Error('Shared analysis receipt is unavailable')
    if (
      current.response &&
      !('outcome' in current.response) &&
      ['published', 'no-change'].includes(current.response.status)
    )
      await ports.refresh(current, owner)
    await owner.check()
    return current
  }
  const client = {
    /** Load only an exact saved publication. No receipt polling, readiness/actor
     * probe, journal rewrite, new intent or endpoint dispatch belongs here. */
    async loadPublished(
      value: DictionaryAnalysisClientOperation,
      owner: DictionaryAnalysisClientOwner
    ) {
      const expected = parseDictionaryAnalysisClientOperation(value)
      if (expected.user_id !== ports.userId)
        throw new Error('Shared analysis owner mismatch')
      const receipt = expected.response
      if (
        !receipt ||
        'outcome' in receipt ||
        !['published', 'no-change'].includes(receipt.status)
      )
        throw new Error('Shared analysis publication receipt is required')
      const requireCurrent = async () => {
        owner.assert()
        const current = requireSameAnalysisOperation(
          await ports.journal.read(expected.user_id, expected.word_id),
          expected
        )
        owner.assert()
        if (canonicalizeJson(current) !== canonicalizeJson(expected))
          throw new Error('Saved shared analysis publication changed')
        return current
      }
      const current = await requireCurrent()
      await ports.refresh(current, owner)
      await owner.check()
      await requireCurrent()
      return current
    },
    async nextAttempt(
      expected: DictionaryAnalysisClientOperation,
      value: DictionaryAnalysisClientOperation,
      owner: DictionaryAnalysisClientOwner
    ): Promise<DictionaryAnalysisClientOperation> {
      const candidate = parseDictionaryAnalysisClientOperation(value)
      const previous = parseDictionaryAnalysisClientOperation(expected)
      if (
        candidate.user_id !== ports.userId ||
        previous.user_id !== ports.userId
      )
        throw new Error('Shared analysis owner mismatch')
      if (!ports.journal.replace)
        throw new Error('Shared analysis history is unavailable')
      owner.assert()
      const receipt = await ports.readReceipt(
        previous.command.operation_id,
        owner
      )
      await owner.check()
      const parsed = parseDictionaryAnalysisReceiptV2(receipt)
      if (!parsed.success || !isDictionaryAnalysisTerminal(parsed.data))
        throw new Error('Shared analysis outcome is unresolved')
      const confirmed = await ports.journal.save(
        previous,
        parsed.data,
        owner.assert
      )
      await ports.requireAvailable(owner)
      await owner.check()
      const prepared = await ports.journal.replace(
        confirmed,
        candidate,
        owner.assert
      )
      owner.assert()
      return client.submit(prepared, owner)
    },
    async recover(
      userId: string,
      wordId: string,
      owner: DictionaryAnalysisClientOwner
    ) {
      if (userId !== ports.userId)
        throw new Error('Shared analysis owner mismatch')
      owner.assert()
      const operation = await ports.journal.read(userId, wordId)
      owner.assert()
      if (!operation) return null
      return recover(operation, owner)
    },
    async submit(
      value: DictionaryAnalysisClientOperation,
      owner: DictionaryAnalysisClientOwner
    ) {
      const candidate = parseDictionaryAnalysisClientOperation(value)
      if (candidate.user_id !== ports.userId)
        throw new Error('Shared analysis owner mismatch')
      if (candidate.submitted || candidate.response !== null)
        throw new Error('Expected a fresh shared analysis intent')
      owner.assert()
      const previous = await ports.journal.read(
        candidate.user_id,
        candidate.word_id
      )
      owner.assert()
      if (previous?.submitted) return recover(previous, owner)
      await ports.requireAvailable(owner)
      await owner.check()
      const operation = await ports.journal.prepare(
        previous ?? candidate,
        owner.assert
      )
      owner.assert()
      if (!(await ports.journal.claim(operation, owner.assert)))
        return recover(operation, owner)
      const response = await ports.submit(operation.command, owner)
      await owner.check()
      const saved = await ports.journal.save(operation, response, owner.assert)
      if (
        saved.response &&
        !('outcome' in saved.response) &&
        ['published', 'no-change'].includes(saved.response.status)
      )
        await ports.refresh(saved, owner)
      await owner.check()
      return saved
    },
  }
  return client
}
