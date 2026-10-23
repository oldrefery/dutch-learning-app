import { parseDictionaryAnalysisCommandV2 } from './dictionary-analysis'
import {
  parseDictionaryAnalysisClientOperation,
  type DictionaryAnalysisClientOperation,
} from './dictionary-analysis-client'
import {
  compareDictionarySequences,
  type DictionaryEffectiveCardV2,
} from './dictionary-following'

export interface DictionaryAnalysisActorV1 {
  protocol_version: 1
  actor_id: string
  may_analyze: boolean
}
export function parseDictionaryAnalysisActorV1(
  value: unknown
): DictionaryAnalysisActorV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid shared analysis actor')
  const row = value as Record<string, unknown>
  if (
    Object.keys(row).length !== 3 ||
    row.protocol_version !== 1 ||
    typeof row.actor_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      row.actor_id
    ) ||
    typeof row.may_analyze !== 'boolean'
  )
    throw new Error('Invalid shared analysis actor')
  return {
    protocol_version: 1,
    actor_id: row.actor_id.toLowerCase(),
    may_analyze: row.may_analyze,
  }
}

export function requireDictionaryAnalysisHead(
  operation: DictionaryAnalysisClientOperation,
  card: DictionaryEffectiveCardV2 | undefined
): void {
  const expected = parseDictionaryAnalysisClientOperation(operation)
  if (!card || card.word_id !== expected.word_id || card.mode !== 'follow')
    throw new Error('Shared dictionary analysis requires a following card')
  const parsed = parseDictionaryAnalysisCommandV2({
    ...expected.command,
    entry_id: card.reference.entry_id,
    expected_revision_id: card.reference.revision_id,
    expected_head_sequence: card.head_sequence,
  })
  if (
    !parsed.success ||
    parsed.data.entry_id !== expected.command.entry_id ||
    parsed.data.expected_revision_id !==
      expected.command.expected_revision_id ||
    parsed.data.expected_head_sequence !==
      expected.command.expected_head_sequence
  )
    throw new Error('Sync shared dictionary content before requesting analysis')
}

export function requireDictionaryAnalysisPublication(
  operation: DictionaryAnalysisClientOperation,
  card: DictionaryEffectiveCardV2 | undefined
): void {
  const expected = parseDictionaryAnalysisClientOperation(operation)
  const receipt = expected.response
  if (
    !receipt ||
    'outcome' in receipt ||
    !['published', 'no-change'].includes(receipt.status) ||
    !receipt.published_head_sequence ||
    !receipt.published_revision_id
  )
    throw new Error('Shared analysis publication receipt is required')
  if (
    !card ||
    card.word_id !== expected.word_id ||
    card.mode !== 'follow' ||
    card.reference.entry_id !== receipt.entry_id
  )
    throw new Error('Shared analysis publication reference is unavailable')
  const comparison = compareDictionarySequences(
    card.head_sequence,
    receipt.published_head_sequence
  )
  if (
    comparison < 0 ||
    (comparison === 0 &&
      card.reference.revision_id !== receipt.published_revision_id)
  )
    throw new Error('Shared analysis publication is not hydrated')
}
