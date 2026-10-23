import {
  isDictionaryAnalysisTerminal,
  parseDictionaryAnalysisClientOperation,
  requireSameAnalysisOperation,
  type DictionaryAnalysisClientOperation,
  type DictionaryAnalysisClientJournal,
} from './dictionary-analysis-client'
import { canonicalizeJson } from './shared-dictionary'
import { compareDictionarySequences } from './dictionary-following'

export const DICTIONARY_ANALYSIS_HISTORY_LIMIT = 100
export interface DictionaryAnalysisAttemptJournal extends DictionaryAnalysisClientJournal {
  history(
    userId: string,
    wordId: string
  ): Promise<DictionaryAnalysisClientOperation[]>
  replace(
    expected: DictionaryAnalysisClientOperation,
    candidate: DictionaryAnalysisClientOperation,
    assertOwner: () => void
  ): Promise<DictionaryAnalysisClientOperation>
}

/** Only an authoritative finished receipt can free a submitted local slot. */
export function requireDictionaryAnalysisNextAttempt(
  current: DictionaryAnalysisClientOperation | null,
  expected: DictionaryAnalysisClientOperation,
  value: DictionaryAnalysisClientOperation
) {
  const previous = requireSameAnalysisOperation(current, expected)
  const candidate = parseDictionaryAnalysisClientOperation(value)
  if (!previous.submitted || !isDictionaryAnalysisTerminal(previous.response))
    throw new Error('Shared analysis outcome is unresolved')
  if (canonicalizeJson(previous) !== canonicalizeJson(expected))
    throw new Error('Shared analysis receipt changed before archiving')
  if (
    candidate.submitted ||
    candidate.response !== null ||
    candidate.user_id !== previous.user_id ||
    candidate.word_id !== previous.word_id ||
    candidate.command.entry_id !== previous.command.entry_id ||
    candidate.command.operation_id === previous.command.operation_id
  )
    throw new Error('Invalid next shared analysis intent')
  if (previous.response.published_head_sequence !== null) {
    const comparison = compareDictionarySequences(
      candidate.command.expected_head_sequence,
      previous.response.published_head_sequence
    )
    if (
      comparison < 0 ||
      (comparison === 0 &&
        candidate.command.expected_revision_id !==
          previous.response.published_revision_id)
    )
      throw new Error('Refresh shared content before a new analysis attempt')
  }
  return candidate
}

export function dictionaryAnalysisResolutionMessage(
  operation: DictionaryAnalysisClientOperation | null
) {
  if (!operation?.submitted) return null
  if (!operation.response)
    return 'The result is unconfirmed. Check status; a new attempt stays blocked.'
  if ('outcome' in operation.response)
    return 'Another analysis is in progress. Check status before a new attempt.'
  if (operation.response.status === 'provider-outcome-unknown')
    return 'The provider result is uncertain. A new attempt stays blocked until server reconciliation.'
  return null
}
