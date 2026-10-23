import {
  followingImportRoot,
  parseFollowingImportOperation,
  parseFollowingImportRows,
  type FollowingImportOperation,
} from './dictionary-following-import-journal'
import {
  compareDictionarySequences,
  type DictionaryEffectiveCardV2,
} from './dictionary-following'
import type { DictionaryImportRecoveryStateV2 } from './dictionary-following-import-recovery.types'

export type FollowingImportHydrationKind = 'imported' | 'existing'

/** Receipts select an identity only. Personal rows and content must be read again. */
export function requireFollowingImportHydration(
  value: FollowingImportOperation,
  rows: readonly FollowingImportOperation[],
  kind: FollowingImportHydrationKind = 'imported'
): FollowingImportOperation {
  const expected = parseFollowingImportOperation(value)
  const root = followingImportRoot(expected)
  const related = parseFollowingImportRows(rows, expected.user_id).filter(
    row => followingImportRoot(row).operation_id === root.operation_id
  )
  const latest = related.at(-1)
  if (
    !latest ||
    latest.kind === 'cancel' ||
    !latest.result ||
    (kind === 'existing'
      ? latest.result.outcome !== 'identity-conflict'
      : latest.result.outcome !== 'inserted' &&
        latest.result.outcome !== 'applied') ||
    !related.some(
      row =>
        row.request.operation_id === expected.request.operation_id &&
        JSON.stringify(row.request) === JSON.stringify(expected.request)
    )
  )
    throw new Error('A confirmed import or recovery is required before loading')
  return latest
}

/** The existing ID comes only from the selected immutable conflict receipt. */
export function followingImportHydrationWordId(
  value: FollowingImportOperation,
  kind: FollowingImportHydrationKind = 'imported'
): string {
  const operation = parseFollowingImportOperation(value)
  if (kind === 'existing' && operation.result?.outcome === 'identity-conflict')
    return operation.result.existing_word_id
  if (
    kind === 'imported' &&
    (operation.result?.outcome === 'inserted' ||
      operation.result?.outcome === 'applied')
  )
    return followingImportRoot(operation).word_id
  throw new Error('A confirmed matching receipt is required before loading')
}

export function requireFollowingImportHydrationState(
  operation: FollowingImportOperation,
  state: DictionaryImportRecoveryStateV2,
  kind: FollowingImportHydrationKind = 'imported'
): void {
  if (kind === 'imported') {
    if (state.state !== 'active')
      throw new Error('Imported card is unavailable')
    return
  }
  const version =
    operation.kind === 'recover' &&
    operation.result?.outcome === 'identity-conflict'
      ? operation.result.recovery_version
      : 0
  if (
    state.state !== 'uncreated' ||
    state.inserted_once ||
    state.recovery_version !== version
  )
    throw new Error('Import recovery changed; check the saved import status')
}

export function requireFollowingImportCard(
  operation: FollowingImportOperation,
  card: DictionaryEffectiveCardV2 | undefined,
  kind: FollowingImportHydrationKind = 'imported'
): void {
  const root = followingImportRoot(operation)
  if (
    !card ||
    card.word_id !== followingImportHydrationWordId(operation, kind) ||
    card.mode !== 'follow' ||
    card.reference.entry_id !== root.source.reference.entry_id
  )
    throw new Error('Imported shared content is unavailable')
  if (operation.kind === 'import' && operation.result?.outcome === 'inserted') {
    const receipt = operation.result
    if (
      compareDictionarySequences(
        card.head_sequence,
        receipt.applied_head_sequence
      ) < 0 ||
      (card.head_sequence === receipt.applied_head_sequence &&
        card.reference.revision_id !== receipt.applied_reference.revision_id)
    )
      throw new Error('Imported shared content predates its receipt')
  }
}
