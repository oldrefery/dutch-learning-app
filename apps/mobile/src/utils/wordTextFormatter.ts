import type { Word } from '@/types/database'
import type { WordAnalysisResponse } from '@/types/GeminiTypes'
import type { AnalysisResult } from '@/components/AddWordScreen/types/AddWordTypes'
import type { WordCardData } from '@/components/UniversalWordCard/types'

// Type guards for identifying different word data types
function isWord(data: WordCardData): data is Word {
  return 'word_id' in data && 'user_id' in data && 'collection_id' in data
}

function isWordAnalysisResponse(
  data: WordCardData
): data is WordAnalysisResponse {
  return 'dutch_lemma' in data && !('word_id' in data) && 'synonyms' in data
}

function isAnalysisResult(data: WordCardData): data is AnalysisResult {
  return 'dutch_lemma' in data && !('word_id' in data) && !('synonyms' in data)
}

// Constants for repeated strings
const TYPE_MODIFIERS = {
  IRREGULAR: ' (irregular)',
  REFLEXIVE: ' (reflexive)',
  SEPARABLE: ' (separable)',
} as const

// Helper functions for building sections
function buildTypeInfo(word: WordCardData): string {
  if (!word.part_of_speech) return ''

  let typeInfo = word.part_of_speech
  if (word.is_irregular) typeInfo += TYPE_MODIFIERS.IRREGULAR
  if (word.article) typeInfo += ` (${word.article})`
  if (word.is_reflexive) typeInfo += TYPE_MODIFIERS.REFLEXIVE
  if (word.is_expression)
    typeInfo += ` (${word.expression_type || 'expression'})`
  if (word.is_separable) typeInfo += TYPE_MODIFIERS.SEPARABLE

  return `Type: ${typeInfo}`
}

function buildSeparableParts(word: WordCardData): string | null {
  if (word.is_separable && word.prefix_part && word.root_verb) {
    return `Parts: ${word.prefix_part} + ${word.root_verb}`
  }
  return null
}

function buildTranslations(word: WordCardData): string[] {
  const translations: string[] = []

  if (word.translations) {
    if (word.translations.en && word.translations.en.length > 0) {
      translations.push(`English: ${word.translations.en.join(', ')}`)
    }
    if (word.translations.ru && word.translations.ru.length > 0) {
      translations.push(`Russian: ${word.translations.ru.join(', ')}`)
    }
  }

  return translations
}

function buildExamples(word: WordCardData): string[] {
  if (!word.examples || word.examples.length === 0) return []

  const examples = ['Examples:']
  word.examples.forEach(example => {
    examples.push(
      `• ${example.nl} - ${example.en}${example.ru ? ` - ${example.ru}` : ''}`
    )
  })

  return examples
}

function buildSynonymsAntonyms(word: WordCardData): string[] {
  const result: string[] = []

  // Synonyms - different logic for different types
  if ('synonyms' in word && word.synonyms && word.synonyms.length > 0) {
    result.push(`Synonyms: ${word.synonyms.join(', ')}`)
  }

  // Antonyms - different logic for different types
  if ('antonyms' in word && word.antonyms && word.antonyms.length > 0) {
    result.push(`Antonyms: ${word.antonyms.join(', ')}`)
  }

  return result
}

// Unified formatting function
function formatWordDataUnified(word: WordCardData): string {
  const sections: string[] = []

  // Word title
  sections.push(`Word: ${word.dutch_lemma}`)

  // Type information
  const typeInfo = buildTypeInfo(word)
  if (typeInfo) sections.push(typeInfo)

  // Separable parts
  const separableParts = buildSeparableParts(word)
  if (separableParts) sections.push(separableParts)

  // Translations
  sections.push(...buildTranslations(word))

  // Examples
  sections.push(...buildExamples(word))

  // Synonyms and antonyms
  sections.push(...buildSynonymsAntonyms(word))

  return sections.join('\n\n')
}

// Type-specific formatters (for backward compatibility)
function formatWordData(word: Word): string {
  return formatWordDataUnified(word)
}

function formatWordAnalysisResponseData(word: WordAnalysisResponse): string {
  return formatWordDataUnified(word)
}

// Main function that works with all WordCardData types
export function formatWordForCopying(word: WordCardData): string {
  if (isWord(word)) {
    return formatWordData(word)
  } else if (isWordAnalysisResponse(word)) {
    return formatWordAnalysisResponseData(word)
  } else if (isAnalysisResult(word)) {
    return formatAnalysisResultForCopying(word)
  }

  // Fallback for unexpected types (should never happen with proper types)
  const fallbackWord = word as { dutch_lemma?: string }
  return `Word: ${fallbackWord.dutch_lemma || 'Unknown'}`
}

export function formatAnalysisResultForCopying(result: AnalysisResult): string {
  return formatWordDataUnified(result)
}
