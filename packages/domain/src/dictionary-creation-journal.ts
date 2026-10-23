import {
  parseDictionaryCreationSessionV2,
  reconcileDictionaryCreationResponse,
  recordDictionaryMeaningResolution,
  claimDictionaryCreationSubmission,
  type DictionaryCreationSessionV2,
} from './dictionary-creation-client'
import { canonicalizeJson } from './shared-dictionary'
import {
  parseDictionaryImportIntentV2,
  parseDictionaryImportReceiptV2,
  type DictionaryImportIntentV2,
  type DictionaryImportReceiptV2,
  type PublishedDictionaryReference,
} from './dictionary-following-import'
import { requireFollowingImportOwner } from './dictionary-following-import-journal'

export const CREATION_JOURNAL_LIMIT = 100
export const CREATION_JOURNAL_TEXT_LIMIT = 256_000
export interface DictionaryCreationJournalOwner {
  user_id: string
  assert(): void
  check(): Promise<void>
}
export interface DictionaryCreationAdoption {
  request: DictionaryImportIntentV2
  submitted: boolean
  response: DictionaryImportReceiptV2 | null
}
export interface DictionaryCreationJournalRow {
  protocol_version: 1
  // Durable local identity tags, never Auth credentials or server permission.
  owner_epoch: string
  session_epoch: string
  session: DictionaryCreationSessionV2
  adoption: DictionaryCreationAdoption | null
}
export interface DictionaryCreationJournal {
  list(
    userId: string,
    owner: DictionaryCreationJournalOwner
  ): Promise<DictionaryCreationJournalRow[]>
  read(
    userId: string,
    resolutionId: string,
    owner: DictionaryCreationJournalOwner
  ): Promise<DictionaryCreationJournalRow | null>
  prepare(
    value: DictionaryCreationJournalRow,
    owner: DictionaryCreationJournalOwner
  ): Promise<DictionaryCreationJournalRow>
  save(
    expected: DictionaryCreationJournalRow,
    value: DictionaryCreationJournalRow,
    owner: DictionaryCreationJournalOwner
  ): Promise<DictionaryCreationJournalRow>
  claim(
    expected: DictionaryCreationJournalRow,
    owner: DictionaryCreationJournalOwner
  ): Promise<{ row: DictionaryCreationJournalRow; claimed: boolean }>
  claimAdoption(
    expected: DictionaryCreationJournalRow,
    owner: DictionaryCreationJournalOwner
  ): Promise<{ row: DictionaryCreationJournalRow; claimed: boolean }>
}
const invalid = (): never => {
  throw new Error('Invalid creation journal')
}
const object = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== keys.length ||
    keys.some(key => !Object.hasOwn(row, key))
  )
    return invalid()
  return row
}
const same = (a: unknown, b: unknown) =>
  canonicalizeJson(a) === canonicalizeJson(b)
export const creationPublishedReference = (
  session: DictionaryCreationSessionV2
): PublishedDictionaryReference | null => {
  const response = session.response
  if (
    response &&
    ('outcome' in response
      ? response.outcome === 'existing-meaning'
      : response.status === 'published')
  )
    return 'published' in response ? response.published : null
  return !session.command && session.resolution?.outcome === 'existing-meaning'
    ? session.resolution.published
    : null
}
export const parseCreationJournalRow = (
  value: unknown
): DictionaryCreationJournalRow => {
  const row = object(value, [
    'protocol_version',
    'owner_epoch',
    'session_epoch',
    'session',
    'adoption',
  ])
  const parsed = parseDictionaryCreationSessionV2(row.session)
  if (row.protocol_version !== 1 || !parsed.success) return invalid()
  const session = parsed.data
  let adoption: DictionaryCreationAdoption | null = null
  if (row.adoption !== null) {
    const a = object(row.adoption, ['request', 'submitted', 'response'])
    const request = parseDictionaryImportIntentV2(a.request)
    const reference = creationPublishedReference(session)
    if (
      !reference ||
      request.source.kind !== 'published-reference' ||
      !same(reference, {
        reference: request.source.reference,
        content_sha256: request.source.content_sha256,
      }) ||
      typeof a.submitted !== 'boolean' ||
      (!a.submitted && a.response !== null) ||
      [session.request.resolution_id, session.command?.operation_id].includes(
        request.operation_id
      )
    )
      return invalid()
    adoption = {
      request,
      submitted: a.submitted,
      response:
        a.response === null
          ? null
          : parseDictionaryImportReceiptV2(a.response, request),
    }
  }
  return {
    protocol_version: 1,
    owner_epoch: requireFollowingImportOwner(row.owner_epoch),
    session_epoch: requireFollowingImportOwner(row.session_epoch),
    session,
    adoption,
  }
}
export const parseCreationJournalRows = (
  value: unknown,
  userId: string
): DictionaryCreationJournalRow[] => {
  requireFollowingImportOwner(userId)
  if (!Array.isArray(value) || value.length > CREATION_JOURNAL_LIMIT)
    return invalid()
  const rows = value.map(parseCreationJournalRow)
  const resolutionIds = rows.map(row => row.session.request.resolution_id)
  const nonces = rows.flatMap(row =>
    [
      row.session.command?.operation_id,
      row.adoption?.request.operation_id,
    ].filter((v): v is string => !!v)
  )
  if (
    rows.some(row => row.session.user_id !== userId) ||
    new Set(resolutionIds).size !== rows.length ||
    new Set(nonces).size !== nonces.length ||
    nonces.some(id => resolutionIds.includes(id)) ||
    JSON.stringify(rows).length > CREATION_JOURNAL_TEXT_LIMIT
  )
    return invalid()
  return rows
}
export const assertCreationJournalOwner = (
  userId: string,
  owner: DictionaryCreationJournalOwner
) => {
  if (requireFollowingImportOwner(userId) !== owner.user_id)
    throw new Error('Creation journal owner changed')
  owner.assert()
}
export const requireCreationJournalIntent = (
  current: DictionaryCreationJournalRow | undefined,
  expected: DictionaryCreationJournalRow
) => {
  const row = parseCreationJournalRow(expected)
  if (
    !current ||
    !same(
      [
        current.owner_epoch,
        current.session_epoch,
        current.session.user_id,
        current.session.request,
      ],
      [
        row.owner_epoch,
        row.session_epoch,
        row.session.user_id,
        row.session.request,
      ]
    )
  )
    throw new Error('Creation journal intent changed')
  return current
}
export const prepareCreationJournalRows = (
  rows: DictionaryCreationJournalRow[],
  value: DictionaryCreationJournalRow
) => {
  const row = parseCreationJournalRow(value),
    userId = row.session.user_id
  parseCreationJournalRows(rows, userId)
  if (
    row.session.resolution ||
    row.session.command ||
    row.session.submitted ||
    row.session.response ||
    row.adoption
  )
    throw new Error('Expected a fresh creation request')
  const current = rows.find(
    r => r.session.request.resolution_id === row.session.request.resolution_id
  )
  if (current) {
    requireCreationJournalIntent(current, row)
    return rows
  }
  return parseCreationJournalRows([...rows, row], userId)
}
export const saveCreationJournalRows = (
  rows: DictionaryCreationJournalRow[],
  expected: DictionaryCreationJournalRow,
  value: DictionaryCreationJournalRow
) => {
  let next = parseCreationJournalRow(value)
  const current = requireCreationJournalIntent(
    rows.find(
      row =>
        row.session.request.resolution_id ===
        expected.session.request.resolution_id
    ),
    expected
  )
  requireCreationJournalIntent(current, next)
  if (!same(current, parseCreationJournalRow(expected)))
    throw new Error('Creation journal snapshot changed')
  const a = current.session,
    b = next.session,
    userId = a.user_id
  if (a.resolution && !same(a.resolution, b.resolution))
    throw new Error('Creation resolution is immutable')
  if (b.resolution) recordDictionaryMeaningResolution(a, b.resolution, userId)
  if (a.command && !same(a.command, b.command))
    throw new Error('Creation command is immutable')
  if (a.submitted && !b.submitted)
    throw new Error('Creation submission is irreversible')
  if (a.response && b.response === null)
    throw new Error('Creation response is immutable')
  if (b.response)
    reconcileDictionaryCreationResponse(
      { ...b, response: a.response },
      b.response,
      userId
    )
  const oldAdoption = current.adoption
  if (oldAdoption) {
    if (
      !next.adoption ||
      !same(oldAdoption.request, next.adoption.request) ||
      (oldAdoption.submitted && !next.adoption.submitted)
    )
      throw new Error('Creation adoption is immutable')
    if (
      oldAdoption.response &&
      (!next.adoption.response ||
        !same(
          { ...oldAdoption.response, idempotent: false },
          { ...next.adoption.response, idempotent: false }
        ))
    )
      throw new Error('Creation adoption receipt is immutable')
    if (oldAdoption.response)
      next = {
        ...next,
        adoption: { ...next.adoption!, response: oldAdoption.response },
      }
  }
  return parseCreationJournalRows(
    rows.map(row => (row === current ? next : row)),
    userId
  )
}
export const claimCreationJournalRows = (
  rows: DictionaryCreationJournalRow[],
  expected: DictionaryCreationJournalRow,
  adoption = false
) => {
  const current = requireCreationJournalIntent(
    rows.find(
      row =>
        row.session.request.resolution_id ===
        expected.session.request.resolution_id
    ),
    expected
  )
  if (
    !same(current.session.command, expected.session.command) ||
    (adoption &&
      !same(
        current.adoption?.request ?? null,
        expected.adoption?.request ?? null
      ))
  )
    throw new Error('Creation command changed before claim')
  const claimed = adoption
    ? !current.adoption?.submitted
    : !current.session.submitted
  if (adoption && !current.adoption)
    throw new Error('Creation adoption is missing')
  if (!claimed) return { rows, row: current, claimed: false }
  const row = parseCreationJournalRow(
    adoption
      ? { ...current, adoption: { ...current.adoption!, submitted: true } }
      : {
          ...current,
          session: claimDictionaryCreationSubmission(
            current.session,
            current.session.user_id
          ),
        }
  )
  return {
    rows: saveCreationJournalRows(rows, current, row),
    row,
    claimed: true,
  }
}
