import {
  canonicalizeJson,
  parseDictionaryContent,
  type DictionaryContent,
  type DictionaryContentField,
  type DictionaryValidationResult,
} from './shared-dictionary'
import {
  parseDictionarySequence,
  type DictionarySequence,
} from './dictionary-following'

export interface DictionaryRollbackCommandV2 {
  protocol_version: 2
  operation_id: string
  entry_id: string
  expected_revision_id: string
  expected_head_sequence: DictionarySequence
  target_revision_id: string
  reason: string
}
export interface DictionaryRollbackReceiptV2 extends DictionaryRollbackCommandV2 {
  outcome: 'reverted' | 'no-change' | 'head-conflict' | 'entry-unavailable'
  applied_revision_id: string | null
  applied_head_sequence: DictionarySequence | null
  idempotent: boolean
}
export interface DictionaryHistoryEventV2 {
  head_sequence: DictionarySequence
  revision_id: string
  revision_no: number
  content_sha256: string
  changed_at: string
  kind: 'head' | 'rollback'
}
export interface DictionaryEntryHistoryV2 {
  protocol_version: 2
  entry_id: string
  current_revision_id: string
  current_head_sequence: DictionarySequence
  events: DictionaryHistoryEventV2[]
  next_before: DictionarySequence | null
}
export type DictionaryRevisionFieldChange = {
  [Field in DictionaryContentField]: {
    field: Field
    before: DictionaryContent[Field]
    after: DictionaryContent[Field]
  }
}[DictionaryContentField]
export interface DictionaryRevisionDiffV2 {
  protocol_version: 2
  entry_id: string
  from_revision_id: string
  to_revision_id: string
  from_content: DictionaryContent
  to_content: DictionaryContent
  from_content_sha256: string
  to_content_sha256: string
  changes: DictionaryRevisionFieldChange[]
}
export interface DictionaryRollbackAuditV2 {
  audit_id: string
  actor_id: string | null
  created_at: string
  receipt: DictionaryRollbackReceiptV2
}
const COMMAND_KEYS = [
  'protocol_version',
  'operation_id',
  'entry_id',
  'expected_revision_id',
  'expected_head_sequence',
  'target_revision_id',
  'reason',
]
class HistoryContractError extends Error {}
const fail = (): never => {
  throw new HistoryContractError('Invalid dictionary history/rollback contract')
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return fail()
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== keys.length ||
    keys.some(key => !Object.hasOwn(record, key))
  )
    return fail()
  return record
}
const id = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    return fail()
  return value.toLowerCase()
}
const seq = (value: unknown): DictionarySequence => {
  const parsed = parseDictionarySequence(value)
  return parsed.success ? parsed.data : fail()
}
const digest = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) return fail()
  return value
}
const date = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return fail()
  return value
}
const canonical = (value: unknown): string => {
  try {
    return canonicalizeJson(value)
  } catch {
    return fail()
  }
}
function parse<T>(read: () => T): DictionaryValidationResult<T> {
  try {
    return { success: true, data: read() }
  } catch (error) {
    if (!(error instanceof HistoryContractError)) throw error
    return {
      success: false,
      issues: [{ path: 'history', message: error.message }],
    }
  }
}
function command(input: Record<string, unknown>): DictionaryRollbackCommandV2 {
  if (
    input.protocol_version !== 2 ||
    typeof input.reason !== 'string' ||
    input.reason.trim() === '' ||
    input.reason.length > 1000
  )
    return fail()
  return {
    protocol_version: 2,
    operation_id: id(input.operation_id),
    entry_id: id(input.entry_id),
    expected_revision_id: id(input.expected_revision_id),
    expected_head_sequence: seq(input.expected_head_sequence),
    target_revision_id: id(input.target_revision_id),
    reason: input.reason,
  }
}
export const parseDictionaryRollbackCommandV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryRollbackCommandV2> =>
  parse(() => command(object(value, COMMAND_KEYS)))
function receipt(
  value: unknown,
  expected?: DictionaryRollbackCommandV2
): DictionaryRollbackReceiptV2 {
  const input = object(value, [
    ...COMMAND_KEYS,
    'outcome',
    'applied_revision_id',
    'applied_head_sequence',
    'idempotent',
  ])
  const base = command(input)
  if (
    expected &&
    canonical(base) !==
      canonical(command(expected as unknown as Record<string, unknown>))
  )
    return fail()
  const revision =
    input.applied_revision_id === null ? null : id(input.applied_revision_id)
  const sequence =
    input.applied_head_sequence === null
      ? null
      : seq(input.applied_head_sequence)
  if (typeof input.idempotent !== 'boolean') return fail()
  const outcome = input.outcome
  if (outcome === 'entry-unavailable') {
    if (revision !== null || sequence !== null) return fail()
  } else {
    if (revision === null || sequence === null || sequence === '0')
      return fail()
    if (outcome === 'reverted') {
      if (
        revision !== base.target_revision_id ||
        revision === base.expected_revision_id ||
        BigInt(sequence) <= BigInt(base.expected_head_sequence)
      )
        return fail()
    } else if (outcome === 'no-change') {
      if (
        revision !== base.expected_revision_id ||
        revision !== base.target_revision_id ||
        sequence !== base.expected_head_sequence
      )
        return fail()
    } else if (outcome === 'head-conflict') {
      if (
        revision === base.expected_revision_id &&
        sequence === base.expected_head_sequence
      )
        return fail()
    } else return fail()
  }
  return {
    ...base,
    outcome,
    applied_revision_id: revision,
    applied_head_sequence: sequence,
    idempotent: input.idempotent,
  }
}
export const parseDictionaryRollbackReceiptV2 = (
  value: unknown,
  expected: DictionaryRollbackCommandV2
): DictionaryValidationResult<DictionaryRollbackReceiptV2> =>
  parse(() => receipt(value, expected))
export const parseDictionaryEntryHistoryV2 = (
  value: unknown,
  entryId: string,
  before: DictionarySequence | null = null,
  limit = 50
): DictionaryValidationResult<DictionaryEntryHistoryV2> =>
  parse(() => {
    const input = object(value, [
      'protocol_version',
      'entry_id',
      'current_revision_id',
      'current_head_sequence',
      'events',
      'next_before',
    ])
    if (
      input.protocol_version !== 2 ||
      id(input.entry_id) !== id(entryId) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Array.isArray(input.events) ||
      input.events.length > limit
    )
      return fail()
    const current = seq(input.current_head_sequence),
      revision = id(input.current_revision_id)
    if (current === '0') return fail()
    let previous =
      before === null ? BigInt(current) + BigInt(1) : BigInt(seq(before))
    const events = input.events.map((value): DictionaryHistoryEventV2 => {
      const event = object(value, [
        'head_sequence',
        'revision_id',
        'revision_no',
        'content_sha256',
        'changed_at',
        'kind',
      ])
      const sequence = seq(event.head_sequence)
      if (
        sequence === '0' ||
        BigInt(sequence) >= previous ||
        BigInt(sequence) > BigInt(current) ||
        typeof event.revision_no !== 'number' ||
        !Number.isInteger(event.revision_no) ||
        event.revision_no < 1 ||
        event.revision_no > 2147483647 ||
        (event.kind !== 'head' && event.kind !== 'rollback')
      )
        return fail()
      previous = BigInt(sequence)
      return {
        head_sequence: sequence,
        revision_id: id(event.revision_id),
        revision_no: event.revision_no,
        content_sha256: digest(event.content_sha256),
        changed_at: date(event.changed_at),
        kind: event.kind,
      }
    })
    if (
      (before === null || BigInt(before) > BigInt(current)) &&
      (events[0]?.head_sequence !== current ||
        events[0]?.revision_id !== revision)
    )
      return fail()
    const next = input.next_before === null ? null : seq(input.next_before)
    if (
      next !== null &&
      (events.length !== limit || next !== events.at(-1)?.head_sequence)
    )
      return fail()
    return {
      protocol_version: 2,
      entry_id: id(entryId),
      current_revision_id: revision,
      current_head_sequence: current,
      events,
      next_before: next,
    }
  })
export const parseDictionaryRevisionDiffV2 = (
  value: unknown,
  entryId: string,
  fromId: string,
  toId: string
): DictionaryValidationResult<DictionaryRevisionDiffV2> =>
  parse(() => {
    const input = object(value, [
      'protocol_version',
      'entry_id',
      'from_revision_id',
      'to_revision_id',
      'from_content',
      'to_content',
      'from_content_sha256',
      'to_content_sha256',
      'changes',
    ])
    if (
      input.protocol_version !== 2 ||
      id(input.entry_id) !== id(entryId) ||
      id(input.from_revision_id) !== id(fromId) ||
      id(input.to_revision_id) !== id(toId)
    )
      return fail()
    const from = parseDictionaryContent(input.from_content),
      to = parseDictionaryContent(input.to_content)
    if (!from.success || !to.success || !Array.isArray(input.changes))
      return fail()
    const changes = (Object.keys(from.data) as DictionaryContentField[])
      .sort()
      .filter(
        field =>
          canonicalizeJson(from.data[field]) !==
          canonicalizeJson(to.data[field])
      )
      .map(
        field =>
          ({
            field,
            before: from.data[field],
            after: to.data[field],
          }) as DictionaryRevisionFieldChange
      )
    // Derive the complete diff from validated content; never trust an incomplete
    // changed-fields list that omits media or injects personal/private properties.
    if (
      input.changes.length !== changes.length ||
      input.changes.some((value, index) => {
        const change = object(value, ['field', 'before', 'after'])
        const expected = changes[index]
        return (
          change.field !== expected.field ||
          canonical(change.before) !== canonicalizeJson(expected.before) ||
          canonical(change.after) !== canonicalizeJson(expected.after)
        )
      })
    )
      return fail()
    const fromHash = digest(input.from_content_sha256),
      toHash = digest(input.to_content_sha256)
    if (
      id(fromId) === id(toId) &&
      (fromHash !== toHash || changes.length !== 0)
    )
      return fail()
    return {
      protocol_version: 2,
      entry_id: id(entryId),
      from_revision_id: id(fromId),
      to_revision_id: id(toId),
      from_content: from.data,
      to_content: to.data,
      from_content_sha256: fromHash,
      to_content_sha256: toHash,
      changes,
    }
  })
export const parseDictionaryRollbackAuditV2 = (
  value: unknown,
  entryId: string,
  limit = 50
): DictionaryValidationResult<DictionaryRollbackAuditV2[]> =>
  parse(() => {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Array.isArray(value) ||
      value.length > limit
    )
      return fail()
    const seen = new Set<string>()
    return value.map(value => {
      const input = object(value, [
        'audit_id',
        'actor_id',
        'created_at',
        'receipt',
      ])
      const audit = id(input.audit_id),
        result = receipt(input.receipt)
      if (
        seen.has(audit) ||
        result.entry_id !== id(entryId) ||
        result.idempotent
      )
        return fail()
      seen.add(audit)
      return {
        audit_id: audit,
        actor_id: input.actor_id === null ? null : id(input.actor_id),
        created_at: date(input.created_at),
        receipt: result,
      }
    })
  })
