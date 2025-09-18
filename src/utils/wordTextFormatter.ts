import type { Word } from '@/types/database'
import type { AnalysisResult } from '@/components/AddWordScreen/types/AddWordTypes'

export function formatWordForCopying(word: Word): string {
  const sections: string[] = []

  // Word and type
  sections.push(`Word: ${word.dutch_lemma}`)

  if (word.part_of_speech) {
    let typeInfo = word.part_of_speech
    if (word.is_irregular) typeInfo += ' (irregular)'
    if (word.article) typeInfo += ` (${word.article})`
    if (word.is_reflexive) typeInfo += ' (reflexive)'
    if (word.is_expression)
      typeInfo += ` (${word.expression_type || 'expression'})`
    if (word.is_separable) typeInfo += ' (separable)'
    sections.push(`Type: ${typeInfo}`)
  }

  // Separable verb parts
  if (word.is_separable && word.prefix_part && word.root_verb) {
    sections.push(`Parts: ${word.prefix_part} + ${word.root_verb}`)
  }

  // Translations
  if (word.translations) {
    if (word.translations.en && word.translations.en.length > 0) {
      sections.push(`English: ${word.translations.en.join(', ')}`)
    }
    if (word.translations.ru && word.translations.ru.length > 0) {
      sections.push(`Russian: ${word.translations.ru.join(', ')}`)
    }
  }

  // Examples
  if (word.examples && word.examples.length > 0) {
    sections.push('Examples:')
    word.examples.forEach(example => {
      sections.push(
        `• ${example.nl} - ${example.en}${example.ru ? ` - ${example.ru}` : ''}`
      )
    })
  }

  // Synonyms
  if ('synonyms' in word && word.synonyms && word.synonyms.length > 0) {
    sections.push(`Synonyms: ${word.synonyms.join(', ')}`)
  }

  // Antonyms
  if ('antonyms' in word && word.antonyms && word.antonyms.length > 0) {
    sections.push(`Antonyms: ${word.antonyms.join(', ')}`)
  }

  return sections.join('\n\n')
}

export function formatAnalysisResultForCopying(result: AnalysisResult): string {
  const sections: string[] = []

  // Word and type
  sections.push(`Word: ${result.dutch_lemma}`)

  let typeInfo = result.part_of_speech
  if (result.is_irregular) typeInfo += ' (irregular)'
  if (result.article) typeInfo += ` (${result.article})`
  if (result.is_reflexive) typeInfo += ' (reflexive)'
  if (result.is_expression)
    typeInfo += ` (${result.expression_type || 'expression'})`
  if (result.is_separable) typeInfo += ' (separable)'
  sections.push(`Type: ${typeInfo}`)

  // Separable verb parts
  if (result.is_separable && result.prefix_part && result.root_verb) {
    sections.push(`Parts: ${result.prefix_part} + ${result.root_verb}`)
  }

  // Translations
  if (result.translations.en && result.translations.en.length > 0) {
    sections.push(`English: ${result.translations.en.join(', ')}`)
  }
  if (result.translations.ru && result.translations.ru.length > 0) {
    sections.push(`Russian: ${result.translations.ru.join(', ')}`)
  }

  // Examples
  if (result.examples && result.examples.length > 0) {
    sections.push('Examples:')
    result.examples.forEach(example => {
      sections.push(
        `• ${example.nl} - ${example.en}${example.ru ? ` - ${example.ru}` : ''}`
      )
    })
  }

  return sections.join('\n\n')
}
