import {
  parseDictionaryCreationResponseV2,
  parseDictionaryMeaningResolutionRequestV2,
  parseDictionaryMeaningResolutionReceiptV2,
  type DictionaryCreationResponseV2,
  type DictionaryCreationStatus,
  type DictionaryMeaningResolutionRequestV2,
  type DictionaryMeaningResolutionReceiptV2,
} from './dictionary-creation'
import {
  parseDictionaryCreationOwnerCommandV2,
  type DictionaryCreationOwnerCommandV2,
} from './dictionary-creation-recovery'
import {
  canonicalizeJson,
  type DictionaryValidationResult,
} from './shared-dictionary'

export interface DictionaryCreationSessionV2 {
  user_id: string
  request: DictionaryMeaningResolutionRequestV2
  resolution: DictionaryMeaningResolutionReceiptV2 | null
  command: DictionaryCreationOwnerCommandV2 | null
  submitted: boolean
  response: DictionaryCreationResponseV2 | null
}

class CreationSessionError extends Error {
  constructor(
    readonly path: string,
    message: string
  ) {
    super(message)
  }
}
const fail = (path: string, message: string): never => {
  throw new CreationSessionError(path, message)
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('session', 'must be an object')
  return value as Record<string, unknown>
}
const exact = (value: Record<string, unknown>, fields: string[]) => {
  if (
    Object.keys(value).length !== fields.length ||
    fields.some(key => !Object.hasOwn(value, key))
  )
    fail('session', 'must contain exactly the supported fields')
}
const uuid = (value: unknown, path: string): string => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    return fail(path, 'must be a UUID')
  return value.toLowerCase()
}
const parsed = <T>(result: DictionaryValidationResult<T>): T => {
  if (!result.success)
    return fail(
      result.issues[0]?.path ?? 'session',
      result.issues[0]?.message ?? 'invalid session'
    )
  return result.data
}
const validate = <T>(read: () => T): DictionaryValidationResult<T> => {
  try {
    return { success: true, data: read() }
  } catch (error) {
    if (!(error instanceof CreationSessionError)) throw error
    return {
      success: false,
      issues: [{ path: error.path, message: error.message }],
    }
  }
}
const same = (left: unknown, right: unknown) =>
  canonicalizeJson(left) === canonicalizeJson(right)
const session = (value: unknown): DictionaryCreationSessionV2 => {
  const row = object(value)
  exact(row, [
    'user_id',
    'request',
    'resolution',
    'command',
    'submitted',
    'response',
  ])
  const savedRequest = parsed(
    parseDictionaryMeaningResolutionRequestV2(row.request)
  )
  const savedResolution =
    row.resolution === null
      ? null
      : parsed(parseDictionaryMeaningResolutionReceiptV2(row.resolution))
  if (
    savedResolution &&
    !same(
      {
        protocol_version: savedResolution.protocol_version,
        resolution_id: savedResolution.resolution_id,
        original_query: savedResolution.original_query,
        meaning_hint: savedResolution.meaning_hint,
      },
      savedRequest
    )
  )
    fail('resolution', 'must match the original owner request exactly')
  let savedCommand: DictionaryCreationOwnerCommandV2 | null = null
  if (row.command !== null) {
    savedCommand = parsed(parseDictionaryCreationOwnerCommandV2(row.command))
    if (
      savedResolution?.outcome !== 'new-meaning' ||
      savedCommand.resolution_id !== savedRequest.resolution_id
    )
      fail('command', 'requires this resolved new meaning')
  }
  if (typeof row.submitted !== 'boolean' || (row.submitted && !savedCommand))
    fail('submitted', 'must agree with durable command reservation')
  const savedResponse =
    row.response === null
      ? null
      : parsed(parseDictionaryCreationResponseV2(row.response))
  if (
    savedResponse &&
    (!row.submitted ||
      !savedCommand ||
      !same(
        {
          protocol_version: savedResponse.protocol_version,
          operation_id: savedResponse.operation_id,
          resolution_id: savedResponse.resolution_id,
        },
        savedCommand && {
          protocol_version: savedCommand.protocol_version,
          operation_id: savedCommand.operation_id,
          resolution_id: savedCommand.resolution_id,
        }
      ))
  )
    fail('response', 'must belong to the submitted command')
  return {
    user_id: uuid(row.user_id, 'user_id'),
    request: savedRequest,
    resolution: savedResolution,
    command: savedCommand,
    submitted: row.submitted as boolean,
    response: savedResponse,
  }
}
export const parseDictionaryCreationSessionV2 = (value: unknown) =>
  validate(() => session(value))

const ownedSession = (
  value: unknown,
  userId: string
): DictionaryCreationSessionV2 => {
  const saved = session(value)
  if (saved.user_id !== uuid(userId, 'user_id'))
    return fail('user_id', 'must match the active owner')
  return saved
}
/** A resolution is immutable. Review requires a separate explicitly prepared request. */
export const recordDictionaryMeaningResolution = (
  value: unknown,
  next: unknown,
  userId: string
): DictionaryCreationSessionV2 => {
  const saved = ownedSession(value, userId)
  const updated = session({
    ...saved,
    resolution: parsed(parseDictionaryMeaningResolutionReceiptV2(next)),
  })
  if (saved.resolution && !same(saved.resolution, updated.resolution))
    return fail('resolution', 'recorded resolution is immutable')
  return updated
}
export const prepareDictionaryCreationCommand = (
  value: unknown,
  operationId: string,
  userId: string
): DictionaryCreationSessionV2 => {
  const saved = ownedSession(value, userId)
  if (saved.command)
    return fail('command', 'creation command is already reserved')
  return session({
    ...saved,
    command: {
      protocol_version: 2,
      resolution_id: saved.request.resolution_id,
      operation_id: operationId,
    },
  })
}

/** Persist the returned reservation under fresh owner/epoch guards BEFORE any RPC.
 * A restored submitted reservation permits status reads, never blind redispatch. */
export const claimDictionaryCreationSubmission = (
  value: unknown,
  userId: string
): DictionaryCreationSessionV2 => {
  const saved = ownedSession(value, userId)
  if (!saved.command || saved.submitted)
    return fail(
      'submitted',
      'creation is missing or already reserved; reconcile status'
    )
  return session({ ...saved, submitted: true })
}
const NEXT: Record<
  DictionaryCreationStatus,
  readonly DictionaryCreationStatus[]
> = {
  accepted: [
    'dispatching',
    'validating',
    'published',
    'rejected',
    'review-required',
    'identity-conflict',
    'authorization-revoked',
    'provider-failed',
    'provider-outcome-unknown',
  ],
  dispatching: [
    'validating',
    'published',
    'rejected',
    'review-required',
    'identity-conflict',
    'authorization-revoked',
    'provider-failed',
    'provider-outcome-unknown',
  ],
  validating: [
    'provider-failed',
    'provider-outcome-unknown',
    'published',
    'rejected',
    'review-required',
    'identity-conflict',
    'authorization-revoked',
  ],
  'provider-outcome-unknown': [
    'provider-outcome-unknown',
    'validating',
    'published',
    'rejected',
    'review-required',
    'identity-conflict',
    'authorization-revoked',
  ],
  published: [],
  rejected: [],
  'review-required': [],
  'identity-conflict': [],
  'authorization-revoked': [],
  'provider-failed': [],
}
/** Server status may skip intermediate observations. A reconciled unknown result
 * cannot restart dispatch; terminal receipts and durable result/fence are immutable. */
export const reconcileDictionaryCreationResponse = (
  value: unknown,
  next: unknown,
  userId: string
): DictionaryCreationSessionV2 => {
  const saved = ownedSession(value, userId)
  const updated = session({
    ...saved,
    response: parsed(parseDictionaryCreationResponseV2(next)),
  })
  const before = saved.response
  const after = updated.response
  if (!before || same(before, after)) return updated
  if (!after || 'outcome' in before)
    return fail('response', 'terminal publication response is immutable')
  if (
    'outcome' in after ||
    before.entry_id !== after.entry_id ||
    before.fence !== after.fence ||
    (before.result_sha256 !== null &&
      before.result_sha256 !== after.result_sha256)
  )
    return fail(
      'response',
      'accepted attempt identity and durable result are immutable'
    )
  if (!NEXT[before.status].includes(after.status))
    return fail('status', 'must not regress or change a terminal receipt')
  return updated
}
