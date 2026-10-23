import {
  parseDictionarySequence,
  type DictionarySequence,
} from './dictionary-following'
import type { DictionaryValidationResult } from './shared-dictionary'

export interface DictionaryAnalysisCommandV2 {
  protocol_version: 2
  operation_id: string
  entry_id: string
  expected_revision_id: string
  expected_head_sequence: DictionarySequence
}

export const DICTIONARY_ANALYSIS_STATUSES = [
  'accepted',
  'dispatching',
  'validating',
  'published',
  'no-change',
  'rejected',
  'head-conflict',
  'authorization-revoked',
  'provider-failed',
  'provider-outcome-unknown',
] as const
export type DictionaryAnalysisStatus =
  (typeof DICTIONARY_ANALYSIS_STATUSES)[number]

export interface DictionaryAnalysisReceiptV2 extends DictionaryAnalysisCommandV2 {
  fence: DictionarySequence
  status: DictionaryAnalysisStatus
  quota_charged: true
  result_sha256: string | null
  error_code: string | null
  published_revision_id: string | null
  published_head_sequence: DictionarySequence | null
}
export type DictionaryAnalysisAcceptanceV2 =
  | DictionaryAnalysisReceiptV2
  | {
      protocol_version: 2
      outcome: 'analysis-in-progress'
    }

const COMMAND_FIELDS = [
  'protocol_version',
  'operation_id',
  'entry_id',
  'expected_revision_id',
  'expected_head_sequence',
]
const RECEIPT_FIELDS = [
  ...COMMAND_FIELDS,
  'fence',
  'status',
  'quota_charged',
  'result_sha256',
  'error_code',
  'published_revision_id',
  'published_head_sequence',
]
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
class AnalysisContractError extends Error {
  constructor(
    readonly path: string,
    message: string
  ) {
    super(message)
  }
}
const fail = (path: string, message: string): never => {
  throw new AnalysisContractError(path, message)
}
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return fail('analysis', 'must be an object')
  return value as Record<string, unknown>
}
const exact = (value: Record<string, unknown>, fields: string[]): void => {
  if (
    Object.keys(value).length !== fields.length ||
    fields.some(field => !Object.hasOwn(value, field))
  )
    fail('analysis', 'must contain exactly the supported fields')
}
const uuid = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    return fail(path, 'must be a UUID')
  return value.toLowerCase()
}
const sequence = (value: unknown, path: string): DictionarySequence => {
  const parsed = parseDictionarySequence(value)
  return parsed.success
    ? parsed.data
    : fail(path, 'must be a canonical PostgreSQL BIGINT decimal string')
}
const command = (
  value: Record<string, unknown>
): DictionaryAnalysisCommandV2 => {
  if (value.protocol_version !== 2) fail('protocol_version', 'must be 2')
  return {
    protocol_version: 2,
    operation_id: uuid(value.operation_id, 'operation_id'),
    entry_id: uuid(value.entry_id, 'entry_id'),
    expected_revision_id: uuid(
      value.expected_revision_id,
      'expected_revision_id'
    ),
    expected_head_sequence: sequence(
      value.expected_head_sequence,
      'expected_head_sequence'
    ),
  }
}
const validate = <T>(read: () => T): DictionaryValidationResult<T> => {
  try {
    return { success: true, data: read() }
  } catch (error) {
    if (!(error instanceof AnalysisContractError)) throw error
    return {
      success: false,
      issues: [{ path: error.path, message: error.message }],
    }
  }
}
export const parseDictionaryAnalysisCommandV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryAnalysisCommandV2> =>
  validate(() => {
    const input = object(value)
    exact(input, COMMAND_FIELDS)
    return command(input)
  })

const receipt = (
  input: Record<string, unknown>
): DictionaryAnalysisReceiptV2 => {
  exact(input, RECEIPT_FIELDS)
  const base = command(input)
  if (
    typeof input.status !== 'string' ||
    !DICTIONARY_ANALYSIS_STATUSES.some(status => status === input.status)
  )
    fail('status', 'is not supported')
  const status = input.status as DictionaryAnalysisStatus
  const fence = sequence(input.fence, 'fence')
  if (fence === '0') fail('fence', 'must be positive')
  if (input.quota_charged !== true)
    fail('quota_charged', 'must be true for an accepted attempt')
  if (
    input.result_sha256 !== null &&
    (typeof input.result_sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(input.result_sha256))
  )
    fail('result_sha256', 'must be a SHA256 or null')
  if (
    input.error_code !== null &&
    (typeof input.error_code !== 'string' ||
      !/^[a-z][a-z0-9-]{0,99}$/.test(input.error_code))
  )
    fail('error_code', 'must be a bounded machine code or null')
  const revision =
    input.published_revision_id === null
      ? null
      : uuid(input.published_revision_id, 'published_revision_id')
  const head =
    input.published_head_sequence === null
      ? null
      : sequence(input.published_head_sequence, 'published_head_sequence')
  const published = status === 'published' || status === 'no-change'
  if (
    published !== (revision !== null && head !== null) ||
    (!published && (revision !== null || head !== null))
  )
    fail(
      'published_revision_id',
      'publication dependencies must match the operation status'
    )
  if (
    ['validating', 'published', 'no-change'].includes(status) &&
    input.result_sha256 === null
  )
    fail('result_sha256', 'a durable result is required')
  if (
    ['accepted', 'dispatching'].includes(status) &&
    input.result_sha256 !== null
  )
    fail('result_sha256', 'is premature for this status')
  if (
    [
      'accepted',
      'dispatching',
      'validating',
      'published',
      'no-change',
    ].includes(status) &&
    input.error_code !== null
  )
    fail('error_code', 'must be null for this status')
  if (
    [
      'rejected',
      'head-conflict',
      'authorization-revoked',
      'provider-failed',
      'provider-outcome-unknown',
    ].includes(status) &&
    input.error_code === null
  )
    fail('error_code', 'a terminal or quarantined outcome requires a code')
  return {
    ...base,
    fence,
    status,
    quota_charged: true,
    result_sha256: input.result_sha256 as string | null,
    error_code: input.error_code as string | null,
    published_revision_id: revision,
    published_head_sequence: head,
  }
}
export const parseDictionaryAnalysisReceiptV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryAnalysisReceiptV2> =>
  validate(() => receipt(object(value)))
export const parseDictionaryAnalysisAcceptanceV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryAnalysisAcceptanceV2> =>
  validate(() => {
    const input = object(value)
    if (Object.hasOwn(input, 'outcome')) {
      exact(input, ['protocol_version', 'outcome'])
      if (
        input.protocol_version !== 2 ||
        input.outcome !== 'analysis-in-progress'
      )
        fail('outcome', 'is not supported')
      return { protocol_version: 2, outcome: 'analysis-in-progress' }
    }
    return receipt(input)
  })
