import {
  parseDictionaryContent,
  parseDictionaryReadContent,
  parseDictionarySequence,
  type DictionaryReadContent,
} from '@woordenaar/domain'
import {
  canonicalDictionaryJson as canonical,
  type CachedDictionaryEffectiveCard,
} from './dictionaryFollowingHydration'
import type {
  DictionaryModeLocalSnapshot,
  DictionaryReviewedModeDecision,
} from './dictionaryModeReconciliationRepository'

export interface ManagedRecovery {
  run_id: string
  operation_id: string
  user_id: string
  word_id: string
  entry_id: string
  revision_id: string
  from_version: string
  to_version: string
  original_content: DictionaryReadContent
  published_content: DictionaryReadContent
  restored_content: DictionaryReadContent
}
export interface ManagedRecoveryDecision extends DictionaryReviewedModeDecision {
  managedRecovery: ManagedRecovery
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value)
const invalid = (): never => {
  throw new Error('Invalid managed recovery receipt')
}

export function parseManagedRecoveries(
  value: unknown,
  owner: string,
  requested: readonly string[]
): ManagedRecovery[] {
  if (
    !object(value) ||
    value.protocol_version !== 1 ||
    !Array.isArray(value.recoveries)
  )
    return invalid()
  const ids = new Set(requested)
  const seen = new Set<string>()
  return value.recoveries.map((item: unknown) => {
    if (!object(item)) return invalid()
    for (const key of [
      'run_id',
      'operation_id',
      'user_id',
      'word_id',
      'entry_id',
      'revision_id',
    ])
      if (!uuid(item[key])) return invalid()
    if (
      item.user_id !== owner ||
      !ids.has(String(item.word_id)) ||
      seen.has(String(item.word_id))
    )
      return invalid()
    seen.add(String(item.word_id))
    const from = parseDictionarySequence(item.from_version)
    const to = parseDictionarySequence(item.to_version)
    const original = parseDictionaryReadContent(item.original_content)
    const published = parseDictionaryContent(item.published_content)
    const restored = parseDictionaryReadContent(item.restored_content)
    if (
      !from.success ||
      !to.success ||
      !original.success ||
      !published.success ||
      !restored.success ||
      BigInt(to.data) !== BigInt(from.data) + 1n
    )
      return invalid()
    return {
      ...item,
      original_content: original.data,
      published_content: published.data,
      restored_content: restored.data,
    } as unknown as ManagedRecovery
  })
}

/** Compare storage encodings, never overwrite a local lexical edit to fit a receipt. */
const storageContent = (row: Record<string, unknown>): unknown => {
  const copy = { ...row }
  for (const key of [
    'translations',
    'examples',
    'synonyms',
    'antonyms',
    'conjugation',
    'usage_notes',
  ]) {
    if (typeof copy[key] === 'string') copy[key] = JSON.parse(copy[key])
  }
  for (const key of [
    'is_irregular',
    'is_reflexive',
    'is_expression',
    'is_separable',
  ]) {
    if (copy[key] === 0 || copy[key] === 1) copy[key] = Boolean(copy[key])
  }
  return copy
}
const comparable = (content: unknown): string => {
  if (!object(content)) return canonical(content)
  const result = { ...content }
  for (const key of ['synonyms', 'antonyms']) result[key] ??= []
  for (const key of [
    'dutch_original',
    'analysis_notes',
    'image_url',
    'tts_url',
  ])
    if (result[key] === '') result[key] = null
  return canonical(result)
}

export function managedRecoveryDecision(
  receipt: ManagedRecovery,
  local: DictionaryModeLocalSnapshot,
  remote: CachedDictionaryEffectiveCard
): ManagedRecoveryDecision {
  const cached = local.cachedState
  if (
    local.word.user_id !== receipt.user_id ||
    local.word.word_id !== receipt.word_id ||
    cached?.mode !== 'follow' ||
    cached.entry_id !== receipt.entry_id ||
    cached.revision_id !== receipt.revision_id ||
    cached.content_version !== receipt.from_version ||
    remote.card.word_id !== receipt.word_id ||
    remote.card.mode !== 'legacy' ||
    remote.card.content_version !== receipt.to_version ||
    remote.card.reference !== null ||
    remote.card.adopted_revision_id !== null ||
    canonical(remote.card.legacy_content) !==
      canonical(receipt.restored_content) ||
    local.commands.length !== 0 ||
    (local.privateState && local.privateState.overrides_json !== '{}')
  )
    throw new Error(
      'Managed recovery requires unchanged content and an exact receipt'
    )
  const stored = comparable(storageContent(local.wordContent))
  if (
    ![receipt.original_content, receipt.published_content].some(
      content => comparable(content) === stored
    )
  )
    throw new Error('Managed recovery preserves a newer local analysis')
  return {
    disposition: 'load-server-preserve-local',
    operationId: receipt.operation_id,
    userId: receipt.user_id,
    wordId: receipt.word_id,
    local,
    remote,
    managedRecovery: receipt,
  }
}
