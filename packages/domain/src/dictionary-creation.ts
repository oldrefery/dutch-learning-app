import { parseDictionarySequence } from './dictionary-following'
import type { PublishedDictionaryReference } from './dictionary-following-import'
import { normalizeDictionaryMeaningQuery } from './dictionary-meaning-lookup'
import { type DictionaryValidationResult } from './shared-dictionary'

/** User intent only. Neither query spelling nor a hint is reviewed source evidence. */
export interface DictionaryMeaningResolutionRequestV2 {
  protocol_version: 2
  resolution_id: string
  original_query: string
  meaning_hint: string
}
export interface DictionaryMeaningResolutionReceiptV2 extends DictionaryMeaningResolutionRequestV2 {
  outcome: 'new-meaning' | 'existing-meaning' | 'review-required' | 'rejected'
  resolved_identity_id: string | null
  published: PublishedDictionaryReference | null
  decision_code:
    'meaning-uncertain' | 'source-unapproved' | 'identity-conflict' | null
}
/** Actor, entry, anchor, source approval and provider policy come from the server. */
export interface DictionaryCreationCommandV2 {
  protocol_version: 2
  operation_id: string
  resolution_id: string
}
export const DICTIONARY_CREATION_STATUSES = [
  'accepted',
  'dispatching',
  'validating',
  'published',
  'rejected',
  'review-required',
  'identity-conflict',
  'authorization-revoked',
  'provider-failed',
  'provider-outcome-unknown',
] as const
export type DictionaryCreationStatus =
  (typeof DICTIONARY_CREATION_STATUSES)[number]
export interface DictionaryCreationReceiptV2 extends DictionaryCreationCommandV2 {
  entry_id: string
  fence: string
  status: DictionaryCreationStatus
  quota_charged: true
  result_sha256: string | null
  error_code: string | null
  published: PublishedDictionaryReference | null
  published_head_sequence: string | null
}
export type DictionaryCreationResponseV2 = DictionaryCreationCommandV2 &
  (
    | DictionaryCreationReceiptV2
    | {
        outcome: 'existing-meaning'
        quota_charged: false
        published: PublishedDictionaryReference
      }
    | { outcome: 'creation-in-progress'; quota_charged: false }
  )
const REQUEST_FIELDS = [
  'protocol_version',
  'resolution_id',
  'original_query',
  'meaning_hint',
]
const COMMAND_FIELDS = ['protocol_version', 'operation_id', 'resolution_id']
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256 = /^[0-9a-f]{64}$/
class CreationContractError extends Error {
  constructor(
    readonly path: string,
    message: string
  ) {
    super(message)
  }
}
const fail = (path: string, message: string): never => {
  throw new CreationContractError(path, message)
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('creation', 'must be an object')
  return value as Record<string, unknown>
}
const exact = (value: Record<string, unknown>, fields: string[]) => {
  if (
    Object.keys(value).length !== fields.length ||
    fields.some(key => !Object.hasOwn(value, key))
  )
    fail('creation', 'must contain exactly the supported fields')
}
const uuid = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    return fail(path, 'must be a UUID')
  return value.toLowerCase()
}
const text = (value: unknown, limit: number, path: string): string => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > limit ||
    [...value].some(
      char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
    )
  )
    return fail(
      path,
      'must be bounded non-empty text without control characters'
    )
  return value
}
const digest = (value: unknown): string => {
  if (typeof value !== 'string' || !SHA256.test(value))
    return fail('sha256', 'must be a lowercase SHA256')
  return value
}
const published = (value: unknown): PublishedDictionaryReference => {
  const row = object(value)
  exact(row, ['reference', 'content_sha256'])
  const ref = object(row.reference)
  exact(ref, ['entry_id', 'revision_id'])
  return {
    reference: {
      entry_id: uuid(ref.entry_id, 'entry_id'),
      revision_id: uuid(ref.revision_id, 'revision_id'),
    },
    content_sha256: digest(row.content_sha256),
  }
}
const protocol = (row: Record<string, unknown>) => {
  if (row.protocol_version !== 2) fail('protocol_version', 'must be 2')
}
const request = (
  row: Record<string, unknown>
): DictionaryMeaningResolutionRequestV2 => {
  protocol(row)
  const original_query = text(row.original_query, 240, 'original_query')
  try {
    normalizeDictionaryMeaningQuery(original_query)
  } catch {
    fail('original_query', 'must normalize to a bounded Dutch query')
  }
  return {
    protocol_version: 2,
    resolution_id: uuid(row.resolution_id, 'resolution_id'),
    original_query,
    meaning_hint: text(row.meaning_hint, 1000, 'meaning_hint'),
  }
}
const command = (row: Record<string, unknown>): DictionaryCreationCommandV2 => {
  protocol(row)
  const result: DictionaryCreationCommandV2 = {
    protocol_version: 2,
    operation_id: uuid(row.operation_id, 'operation_id'),
    resolution_id: uuid(row.resolution_id, 'resolution_id'),
  }
  if (result.operation_id === result.resolution_id)
    fail('operation_id', 'must use a separate nonce from resolution')
  return result
}
const resolution = (value: unknown): DictionaryMeaningResolutionReceiptV2 => {
  const row = object(value)
  exact(row, [
    ...REQUEST_FIELDS,
    'outcome',
    'resolved_identity_id',
    'published',
    'decision_code',
  ])
  const base = request(row)
  if (
    row.outcome === 'new-meaning' &&
    row.published === null &&
    row.decision_code === null
  )
    return {
      ...base,
      outcome: 'new-meaning',
      resolved_identity_id: uuid(
        row.resolved_identity_id,
        'resolved_identity_id'
      ),
      published: null,
      decision_code: null,
    }
  if (
    row.outcome === 'existing-meaning' &&
    row.resolved_identity_id === null &&
    row.decision_code === null
  )
    return {
      ...base,
      outcome: 'existing-meaning',
      resolved_identity_id: null,
      published: published(row.published),
      decision_code: null,
    }
  if (row.resolved_identity_id !== null || row.published !== null)
    return fail(
      'resolution',
      'unresolved meaning must not expose a creation identity or publication'
    )
  if (
    row.outcome === 'review-required' &&
    row.decision_code === 'meaning-uncertain'
  )
    return {
      ...base,
      outcome: 'review-required',
      resolved_identity_id: null,
      published: null,
      decision_code: 'meaning-uncertain',
    }
  if (
    row.outcome === 'rejected' &&
    (row.decision_code === 'source-unapproved' ||
      row.decision_code === 'identity-conflict')
  )
    return {
      ...base,
      outcome: 'rejected',
      resolved_identity_id: null,
      published: null,
      decision_code: row.decision_code,
    }
  return fail('resolution', 'unsupported resolution outcome')
}
const receipt = (row: Record<string, unknown>): DictionaryCreationReceiptV2 => {
  exact(row, [
    ...COMMAND_FIELDS,
    'entry_id',
    'fence',
    'status',
    'quota_charged',
    'result_sha256',
    'error_code',
    'published',
    'published_head_sequence',
  ])
  const base = command(row)
  const fence = parseDictionarySequence(row.fence)
  if (!fence.success || fence.data === '0')
    return fail('fence', 'must be a positive canonical BIGINT string')
  if (
    !DICTIONARY_CREATION_STATUSES.some(status => status === row.status) ||
    row.quota_charged !== true
  )
    return fail(
      'status',
      'must be a charged creation receipt with a supported status'
    )
  const status = row.status as DictionaryCreationStatus
  const result_sha256 =
    row.result_sha256 === null ? null : digest(row.result_sha256)
  const entry_id = uuid(row.entry_id, 'entry_id')
  const ref = row.published === null ? null : published(row.published)
  if (status === 'published') {
    if (
      !ref ||
      ref.reference.entry_id !== entry_id ||
      !parseDictionarySequence(row.published_head_sequence).success ||
      row.published_head_sequence === '0' ||
      !result_sha256
    )
      return fail(
        'published',
        'must identify the first validated head of this new entry'
      )
  } else if (ref !== null || row.published_head_sequence !== null)
    return fail('published', 'must be absent before publication')
  if (['accepted', 'dispatching'].includes(status) && result_sha256 !== null)
    fail('result_sha256', 'must be absent before durable result reconciliation')
  if (
    ['validating', 'review-required'].includes(status) &&
    result_sha256 === null
  )
    fail('result_sha256', 'must identify a durable result')
  const active = [
    'accepted',
    'dispatching',
    'validating',
    'published',
  ].includes(status)
  if (
    active
      ? row.error_code !== null
      : typeof row.error_code !== 'string' ||
        !/^[a-z][a-z0-9-]{0,99}$/.test(row.error_code)
  )
    fail('error_code', 'must agree with operation status')
  return {
    ...base,
    entry_id,
    fence: fence.data,
    status,
    quota_charged: true,
    result_sha256,
    error_code: row.error_code as string | null,
    published: ref,
    published_head_sequence: ref
      ? (row.published_head_sequence as string)
      : null,
  }
}
const response = (value: unknown): DictionaryCreationResponseV2 => {
  const row = object(value)
  if (!Object.hasOwn(row, 'outcome')) return receipt(row)
  const base = command(row)
  if (row.quota_charged !== false)
    return fail('quota_charged', 'non-accepted response must not charge quota')
  if (row.outcome === 'existing-meaning') {
    exact(row, [...COMMAND_FIELDS, 'outcome', 'quota_charged', 'published'])
    return {
      ...base,
      outcome: 'existing-meaning',
      quota_charged: false,
      published: published(row.published),
    }
  }
  exact(row, [...COMMAND_FIELDS, 'outcome', 'quota_charged'])
  if (row.outcome !== 'creation-in-progress')
    return fail('outcome', 'unsupported creation response')
  return { ...base, outcome: 'creation-in-progress', quota_charged: false }
}
const validate = <T>(read: () => T): DictionaryValidationResult<T> => {
  try {
    return { success: true, data: read() }
  } catch (error) {
    if (!(error instanceof CreationContractError)) throw error
    return {
      success: false,
      issues: [{ path: error.path, message: error.message }],
    }
  }
}
export const parseDictionaryMeaningResolutionRequestV2 = (value: unknown) =>
  validate(() => {
    const row = object(value)
    exact(row, REQUEST_FIELDS)
    return request(row)
  })
export const parseDictionaryMeaningResolutionReceiptV2 = (value: unknown) =>
  validate(() => resolution(value))
export const parseDictionaryCreationCommandV2 = (value: unknown) =>
  validate(() => {
    const row = object(value)
    exact(row, COMMAND_FIELDS)
    return command(row)
  })
export const parseDictionaryCreationResponseV2 = (value: unknown) =>
  validate(() => response(value))
