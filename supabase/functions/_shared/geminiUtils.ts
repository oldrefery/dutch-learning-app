// Utility functions for Gemini AI word analysis

import { SEPARABLE_PREFIXES, MIN_ROOT_VERB_LENGTH } from './constants.ts'
import type { SeparableVerbAnalysis } from './types.ts'

// Helper function to detect separable verbs if Gemini missed them
export function analyzeSeparableVerb(
  lemma: string,
  partOfSpeech: string
): SeparableVerbAnalysis {
  if (partOfSpeech !== 'verb') {
    return { is_separable: false, prefix_part: null, root_verb: null }
  }

  for (const prefix of SEPARABLE_PREFIXES) {
    if (lemma.startsWith(prefix)) {
      const rootVerb = lemma.substring(prefix.length)
      // Check if root verb is reasonable (at least 3 chars, common verb patterns)
      if (rootVerb.length >= MIN_ROOT_VERB_LENGTH) {
        return {
          is_separable: true,
          prefix_part: prefix,
          root_verb: rootVerb,
        }
      }
    }
  }

  return { is_separable: false, prefix_part: null, root_verb: null }
}

// Helper function to create smart search queries for images
export function createSmartSearchQuery(
  dutchLemma: string,
  englishTranslation: string,
  partOfSpeech: string,
  examples: string[]
): string {
  const baseTranslation = englishTranslation.toLowerCase()

  // Specific queries for common verbs
  const verbQueries: { [key: string]: string } = {
    iron: 'ironing clothes',
    wash: 'washing clothes',
    cook: 'cooking food',
    read: 'reading book',
    write: 'writing paper',
    sleep: 'sleeping bed',
    eat: 'eating food',
    drink: 'drinking water',
    walk: 'walking person',
    run: 'running person',
  }

  // Check for specific verb meanings
  if (partOfSpeech === 'verb' && verbQueries[baseTranslation]) {
    return verbQueries[baseTranslation]
  }

  // Extract context from examples for verbs
  if (partOfSpeech === 'verb' && examples.length > 0) {
    const exampleText = examples.join(' ').toLowerCase()

    // Look for context clues in examples
    if (exampleText.includes('clothes') || exampleText.includes('shirt')) {
      return 'ironing clothes'
    }
    if (exampleText.includes('book') || exampleText.includes('reading')) {
      return 'reading book'
    }
    if (exampleText.includes('food') || exampleText.includes('eating')) {
      return 'cooking food'
    }
  }

  // Default to base translation
  return baseTranslation
}

// Helper function to validate word input
export function validateWordInput(word: string): boolean {
  if (!word || typeof word !== 'string') {
    return false
  }

  // Remove whitespace and check if empty
  const trimmedWord = word.trim()
  if (trimmedWord.length === 0) {
    return false
  }

  // Check for reasonable length (Dutch words are typically 2-20 characters)
  if (trimmedWord.length < 2 || trimmedWord.length > 50) {
    return false
  }

  return true
}

// Helper function to clean and format examples
export function cleanExamples(examples: string[]): string[] {
  return examples
    .filter(example => example && example.trim().length > 0)
    .map(example => example.trim())
    .slice(0, 6) // Limit to 6 examples
}

// Helper function to format translations
export function formatTranslations(translations: {
  en: string[]
  ru: string[]
}): { en: string[]; ru: string[] } {
  return {
    en: translations.en
      .filter(t => t && t.trim().length > 0)
      .map(t => t.trim())
      .slice(0, 3), // Limit to 3 English translations
    ru: translations.ru
      .filter(t => t && t.trim().length > 0)
      .map(t => t.trim())
      .slice(0, 2), // Limit to 2 Russian translations
  }
}
