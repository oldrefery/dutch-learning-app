import type { WordAnalysis } from './analysis-contract'

export interface SemanticWordCandidate {
  article: string | null
  dutch_lemma: string
  part_of_speech: string | null
}

const normalizeSemanticValue = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase('nl-NL') ?? ''

export const isSemanticWordMatch = (
  candidate: SemanticWordCandidate,
  analysis: WordAnalysis
) =>
  normalizeSemanticValue(candidate.dutch_lemma) ===
    normalizeSemanticValue(analysis.dutchLemma) &&
  normalizeSemanticValue(candidate.part_of_speech ?? 'unknown') ===
    normalizeSemanticValue(analysis.partOfSpeech || 'unknown') &&
  normalizeSemanticValue(candidate.article) ===
    normalizeSemanticValue(analysis.article)
