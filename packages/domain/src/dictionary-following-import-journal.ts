import {
  parseDictionaryImportIntentV2,
  parseDictionaryImportReceiptV2,
  type DictionaryImportIntentV2,
  type DictionaryImportReceiptV2,
} from './dictionary-following-import'
import {
  parseDictionaryImportCancellationV2,
  parseDictionaryImportCancellationReceiptV2,
  parseDictionaryImportRecoveryV2,
  parseDictionaryImportRecoveryResultV2,
  type DictionaryImportCancellationV2,
  type DictionaryImportCancellationReceiptV2,
  type DictionaryImportRecoveryV2,
  type DictionaryImportRecoveryResultV2,
} from './dictionary-following-import-recovery'

export type FollowingImportOperation = { user_id: string } & (
  | {
      kind: 'import'
      request: DictionaryImportIntentV2
      result: DictionaryImportReceiptV2 | null
    }
  | {
      kind: 'recover'
      request: DictionaryImportRecoveryV2
      result: DictionaryImportRecoveryResultV2 | null
    }
  | {
      kind: 'cancel'
      request: DictionaryImportCancellationV2
      result: DictionaryImportCancellationReceiptV2 | null
    }
)
export interface FollowingImportJournal {
  list(userId: string): Promise<FollowingImportOperation[]>
  prepare(
    value: FollowingImportOperation,
    assertOwner: () => void
  ): Promise<FollowingImportOperation>
  save(
    expected: FollowingImportOperation,
    value: unknown,
    assertOwner: () => void
  ): Promise<FollowingImportOperation>
}
export const FOLLOWING_IMPORT_JOURNAL_LIMIT = 100
export const FOLLOWING_IMPORT_JOURNAL_TEXT_LIMIT = 256_000
export const requireFollowingImportOwner = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new Error('Invalid following import owner')
  return value
}
export const followingImportRoot = (
  row: FollowingImportOperation
): DictionaryImportIntentV2 =>
  row.kind === 'import' ? row.request : row.request.original_intent

export function parseFollowingImportOperation(
  value: unknown
): FollowingImportOperation {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid following import journal')
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== 4 ||
    !['user_id', 'kind', 'request', 'result'].every(key =>
      Object.hasOwn(row, key)
    )
  )
    throw new Error('Invalid following import journal')
  const user_id = requireFollowingImportOwner(row.user_id)
  if (row.kind === 'import') {
    const request = parseDictionaryImportIntentV2(row.request)
    return {
      user_id,
      kind: row.kind,
      request,
      result:
        row.result === null
          ? null
          : parseDictionaryImportReceiptV2(row.result, request),
    }
  }
  if (row.kind === 'recover') {
    const request = parseDictionaryImportRecoveryV2(row.request)
    return {
      user_id,
      kind: row.kind,
      request,
      result:
        row.result === null
          ? null
          : parseDictionaryImportRecoveryResultV2(row.result, request),
    }
  }
  if (row.kind === 'cancel') {
    const request = parseDictionaryImportCancellationV2(row.request)
    return {
      user_id,
      kind: row.kind,
      request,
      result:
        row.result === null
          ? null
          : parseDictionaryImportCancellationReceiptV2(row.result, request),
    }
  }
  throw new Error('Invalid following import journal kind')
}

export function parseFollowingImportRows(
  value: unknown,
  userId: string
): FollowingImportOperation[] {
  requireFollowingImportOwner(userId)
  if (!Array.isArray(value) || value.length > FOLLOWING_IMPORT_JOURNAL_LIMIT)
    throw new Error('Following import journal exceeds its limit')
  const rows = value.map(parseFollowingImportOperation)
  if (
    rows.some(row => row.user_id !== userId) ||
    new Set(rows.map(row => row.request.operation_id)).size !== rows.length
  )
    throw new Error('Following import journal identity mismatch')
  const roots = new Map<string, FollowingImportOperation>()
  for (const row of rows) {
    const root = followingImportRoot(row)
    if (row.kind === 'import') {
      if (roots.has(root.word_id))
        throw new Error('Following import word ID is already reserved')
      roots.set(root.word_id, row)
    } else {
      const saved = roots.get(root.word_id)
      if (!saved || JSON.stringify(saved.request) !== JSON.stringify(root))
        throw new Error('Following import original intent changed')
    }
  }
  return rows
}

export function prepareFollowingImportRows(
  rows: FollowingImportOperation[],
  value: FollowingImportOperation
): FollowingImportOperation[] {
  const next = parseFollowingImportOperation(value)
  if (next.result !== null)
    throw new Error('Expected a fresh following import operation')
  const old = rows.find(
    row => row.request.operation_id === next.request.operation_id
  )
  if (old) {
    if (
      old.kind !== next.kind ||
      old.user_id !== next.user_id ||
      JSON.stringify(old.request) !== JSON.stringify(next.request)
    )
      throw new Error('Following import operation ID is already reserved')
    return rows
  }
  const root = followingImportRoot(next)
  const actions = rows.filter(
    row =>
      followingImportRoot(row).word_id === root.word_id && row.kind !== 'import'
  )
  if (actions.some(row => row.result === null || row.kind === 'cancel'))
    throw new Error('Following import recovery is pending or cancelled')
  if (
    next.kind === 'import' &&
    rows.some(row => followingImportRoot(row).word_id === root.word_id)
  )
    throw new Error('Following import word ID is already reserved')
  return parseFollowingImportRows([...rows, next], next.user_id)
}

export function saveFollowingImportRows(
  rows: FollowingImportOperation[],
  expected: FollowingImportOperation,
  value: unknown
): FollowingImportOperation[] {
  const old = rows.find(
    row => row.request.operation_id === expected.request.operation_id
  )
  if (
    !old ||
    old.kind !== expected.kind ||
    old.user_id !== expected.user_id ||
    JSON.stringify(old.request) !== JSON.stringify(expected.request)
  )
    throw new Error('Following import intent changed before acknowledgement')
  if (value === null) throw new Error('Following import receipt is required')
  const saved = parseFollowingImportOperation({ ...old, result: value })
  const durable = (row: FollowingImportOperation) =>
    JSON.stringify(
      row.result && 'idempotent' in row.result
        ? { ...row.result, idempotent: false }
        : row.result
    )
  if (old.result !== null && durable(old) !== durable(saved))
    throw new Error('Following import receipt is immutable')
  return rows.map(row =>
    row === old ? (old.result === null ? saved : old) : row
  )
}
