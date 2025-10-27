/**
 * Unit tests for wordTextFormatter
 * Tests word formatting for sharing and display
 */

import {
  formatWordForCopying,
  formatAnalysisResultForCopying,
} from '../wordTextFormatter'
import type { Word } from '@/types/database'
import type { WordAnalysisResponse } from '@/types/GeminiTypes'
import type { AnalysisResult } from '@/components/AddWordScreen/types/AddWordTypes'

describe('wordTextFormatter', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const WORD_LABEL = 'Word: lopen'
  const TYPE_LABEL = 'Type: verb'

  // Helper to create mock Word objects
  const createMockWord = (overrides: Partial<Word> = {}): Word => ({
    word_id: generateId('word'),
    user_id: generateId('user'),
    collection_id: generateId('collection'),
    dutch_lemma: 'lopen',
    dutch_original: 'loopt',
    part_of_speech: 'verb',
    article: null,
    translations: { en: ['walk', 'run'], ru: ['ходить', 'бегать'] },
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: '2025-11-02',
    created_at: '2025-10-27T00:00:00Z',
    updated_at: '2025-10-27T00:00:00Z',
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    synonyms: [],
    antonyms: [],
    last_reviewed_at: null,
    ...overrides,
  })

  // Helper to create mock WordAnalysisResponse
  const createMockAnalysisResponse = (
    overrides: Partial<WordAnalysisResponse> = {}
  ): WordAnalysisResponse => ({
    dutch_lemma: 'kijken',
    dutch_original: 'kijken',
    part_of_speech: 'verb',
    article: null,
    translations: { en: ['look', 'watch'], ru: ['смотреть', 'глядеть'] },
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    synonyms: ['aanschouwen', 'toekijken'],
    antonyms: [],
    examples: [
      {
        nl: 'Ik kijk naar de film',
        en: 'I watch the movie',
        ru: 'Я смотрю фильм',
      },
    ],
    expression_type: null,
    prefix_part: null,
    root_verb: null,
    ...overrides,
  })

  // Helper to create mock AnalysisResult
  const createMockAnalysisResult = (
    overrides: Partial<AnalysisResult> = {}
  ): AnalysisResult => ({
    dutch_lemma: 'schrijven',
    dutch_original: 'schrijven',
    part_of_speech: 'verb',
    article: null,
    translations: { en: ['write'], ru: ['писать'] },
    is_irregular: true,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    examples: [],
    expression_type: null,
    prefix_part: null,
    root_verb: null,
    ...overrides,
  })

  describe('formatWordForCopying with Word type', () => {
    it('should format basic word with translations', () => {
      const word = createMockWord()
      const result = formatWordForCopying(word)

      expect(result).toContain(WORD_LABEL)
      expect(result).toContain(TYPE_LABEL)
      expect(result).toContain('English: walk, run')
      expect(result).toContain('Russian: ходить, бегать')
    })

    it('should handle word with article', () => {
      const word = createMockWord({
        part_of_speech: 'noun',
        article: 'de',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain(WORD_LABEL)
      expect(result).toContain('Type: noun (de)')
    })

    it('should include irregular modifier when present', () => {
      const word = createMockWord({
        is_irregular: true,
        part_of_speech: 'verb',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('(irregular)')
    })

    it('should include reflexive modifier when present', () => {
      const word = createMockWord({
        is_reflexive: true,
        part_of_speech: 'verb',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('(reflexive)')
    })

    it('should include separable modifier when present', () => {
      const word = createMockWord({
        is_separable: true,
        prefix_part: 'uit',
        root_verb: 'spreken',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('(separable)')
      expect(result).toContain('Parts: uit + spreken')
    })

    it('should include expression type when marked as expression', () => {
      const word = createMockWord({
        is_expression: true,
        part_of_speech: 'phrase',
        expression_type: 'idiom',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('(idiom)')
    })

    it('should include synonyms when present', () => {
      const word = createMockWord({
        synonyms: ['rennen', 'joggen'],
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Synonyms: rennen, joggen')
    })

    it('should include antonyms when present', () => {
      const word = createMockWord({
        antonyms: ['staan', 'zitten'],
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Antonyms: staan, zitten')
    })

    it('should handle word without translations', () => {
      const word = createMockWord({
        translations: {},
      })
      const result = formatWordForCopying(word)

      expect(result).toContain(WORD_LABEL)
      // Should not crash, translation lines should be absent
    })

    it('should handle word with only english translations', () => {
      const word = createMockWord({
        translations: { en: ['walk'] },
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('English: walk')
      expect(result).not.toContain('Russian:')
    })

    it('should handle word with only russian translations', () => {
      const word = createMockWord({
        translations: { ru: ['ходить'] },
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Russian: ходить')
      expect(result).not.toContain('English:')
    })

    it('should format multiple modifiers correctly', () => {
      const word = createMockWord({
        part_of_speech: 'verb',
        is_irregular: true,
        is_reflexive: true,
        article: 'zich',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Type: verb (irregular) (zich) (reflexive)')
    })
  })

  describe('formatWordForCopying with WordAnalysisResponse type', () => {
    it('should format analysis response with synonyms', () => {
      const response = createMockAnalysisResponse()
      const result = formatWordForCopying(response)

      expect(result).toContain('Word: kijken')
      expect(result).toContain('Type: verb')
      expect(result).toContain('Synonyms: aanschouwen, toekijken')
      expect(result).toContain('English: look, watch')
    })

    it('should include examples in analysis response', () => {
      const response = createMockAnalysisResponse({
        examples: [
          {
            nl: 'Kijk naar mij',
            en: 'Look at me',
            ru: 'Посмотри на меня',
          },
        ],
      })
      const result = formatWordForCopying(response)

      expect(result).toContain('Examples:')
      expect(result).toContain(
        '• Kijk naar mij - Look at me - Посмотри на меня'
      )
    })

    it('should handle examples without russian translation', () => {
      const response = createMockAnalysisResponse({
        examples: [
          {
            nl: 'Kijk naar mij',
            en: 'Look at me',
          },
        ],
      })
      const result = formatWordForCopying(response)

      expect(result).toContain('• Kijk naar mij - Look at me')
    })

    it('should handle multiple examples', () => {
      const response = createMockAnalysisResponse({
        examples: [
          { nl: 'Ex 1', en: 'Example 1', ru: 'Пример 1' },
          { nl: 'Ex 2', en: 'Example 2', ru: 'Пример 2' },
        ],
      })
      const result = formatWordForCopying(response)

      expect(result).toContain('• Ex 1 - Example 1 - Пример 1')
      expect(result).toContain('• Ex 2 - Example 2 - Пример 2')
    })
  })

  describe('formatWordForCopying with AnalysisResult type', () => {
    it('should format analysis result', () => {
      const result = createMockAnalysisResult()
      const formatted = formatWordForCopying(result)

      expect(formatted).toContain('Word: schrijven')
      expect(formatted).toContain('Type: verb (irregular)')
      expect(formatted).toContain('English: write')
      expect(formatted).toContain('Russian: писать')
    })

    it('should handle analysis result with examples', () => {
      const result = createMockAnalysisResult({
        examples: [
          {
            nl: 'Ik schrijf een brief',
            en: 'I write a letter',
            ru: 'Я пишу письмо',
          },
        ],
      })
      const formatted = formatWordForCopying(result)

      expect(formatted).toContain('Examples:')
      expect(formatted).toContain(
        '• Ik schrijf een brief - I write a letter - Я пишу письмо'
      )
    })
  })

  describe('formatAnalysisResultForCopying', () => {
    it('should format analysis result for copying', () => {
      const result = createMockAnalysisResult({
        dutch_lemma: 'maken',
        translations: { en: ['make', 'do'], ru: ['делать', 'создавать'] },
      })
      const formatted = formatAnalysisResultForCopying(result)

      expect(formatted).toContain('Word: maken')
      expect(formatted).toContain('English: make, do')
      expect(formatted).toContain('Russian: делать, создавать')
    })

    it('should not include synonyms or antonyms in analysis result', () => {
      const result = createMockAnalysisResult()
      const formatted = formatAnalysisResultForCopying(result)

      // AnalysisResult doesn't have synonyms/antonyms properties
      expect(formatted).not.toContain('Synonyms:')
      expect(formatted).not.toContain('Antonyms:')
    })
  })

  describe('edge cases', () => {
    it('should handle word with empty arrays gracefully', () => {
      const word = createMockWord({
        synonyms: [],
        antonyms: [],
        examples: [],
      })
      const result = formatWordForCopying(word)

      expect(result).toBeTruthy()
      expect(result).toContain(WORD_LABEL)
    })

    it('should handle word with missing part of speech', () => {
      const word = createMockWord({
        part_of_speech: null,
      })
      const result = formatWordForCopying(word)

      expect(result).toContain(WORD_LABEL)
      // Type line should not appear if part_of_speech is null
      expect(result).not.toContain('Type: null')
    })

    it('should handle word with special characters in translations', () => {
      const word = createMockWord({
        translations: {
          en: ["to move's place"],
          ru: ['переместить "место"'],
        },
      })
      const result = formatWordForCopying(word)

      expect(result).toContain("to move's place")
      expect(result).toContain('переместить "место"')
    })

    it('should preserve line breaks with multiple sections', () => {
      const word = createMockWord({
        synonyms: ['rennen', 'sprinten'],
        antonyms: ['staan'],
      })
      const result = formatWordForCopying(word)

      // Should have double line breaks between sections
      const sections = result.split('\n\n')
      expect(sections.length).toBeGreaterThan(1)
    })

    it('should handle separable verb with both parts', () => {
      const word = createMockWord({
        is_separable: true,
        prefix_part: 'op',
        root_verb: 'staan',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Parts: op + staan')
      expect(result).toContain('(separable)')
    })

    it('should handle separable verb without parts defined', () => {
      const word = createMockWord({
        is_separable: true,
        prefix_part: null,
        root_verb: null,
      })
      const result = formatWordForCopying(word)

      expect(result).toContain(WORD_LABEL)
      // Should not show parts if they're not defined
      expect(result).not.toContain('Parts:')
    })
  })

  describe('formatting consistency', () => {
    it('should always start with word name', () => {
      const word = createMockWord()
      const result = formatWordForCopying(word)

      expect(result).toMatch(/^Word: /)
    })

    it('should use consistent section formatting', () => {
      const response = createMockAnalysisResponse({
        examples: [{ nl: 'Test', en: 'Test', ru: 'Тест' }],
      })
      const result = formatWordForCopying(response)

      // Check for bullet points in examples
      expect(result).toContain('• ')
    })

    it('should handle different types without crashing', () => {
      const word = createMockWord()
      const response = createMockAnalysisResponse()
      const analysisResult = createMockAnalysisResult()

      const formatted1 = formatWordForCopying(word)
      const formatted2 = formatWordForCopying(response)
      const formatted3 = formatWordForCopying(analysisResult)

      expect(formatted1).toBeTruthy()
      expect(formatted2).toBeTruthy()
      expect(formatted3).toBeTruthy()
    })

    it('should format all translation languages', () => {
      const word = createMockWord({
        translations: {
          en: ['walk', 'run'],
          ru: ['ходить', 'бегать'],
        },
      })
      const result = formatWordForCopying(word)

      // Both languages should appear
      expect(result).toContain('English:')
      expect(result).toContain('Russian:')
    })
  })

  describe('special word types', () => {
    it('should format irregular verbs correctly', () => {
      const word = createMockWord({
        part_of_speech: 'verb',
        is_irregular: true,
        dutch_lemma: 'zijn',
      })
      const result = formatWordForCopying(word)

      expect(result).toMatch(/Type:.*irregular/)
    })

    it('should format reflexive verbs correctly', () => {
      const word = createMockWord({
        part_of_speech: 'verb',
        is_reflexive: true,
        dutch_lemma: 'zich amuseren',
      })
      const result = formatWordForCopying(word)

      expect(result).toMatch(/Type:.*reflexive/)
    })

    it('should format separable verbs with both parts', () => {
      const word = createMockWord({
        part_of_speech: 'verb',
        is_separable: true,
        dutch_lemma: 'ophalen',
        prefix_part: 'op',
        root_verb: 'halen',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Parts: op + halen')
      expect(result).toMatch(/Type:.*separable/)
    })

    it('should format nouns with articles', () => {
      const word = createMockWord({
        part_of_speech: 'noun',
        article: 'de',
        dutch_lemma: 'tafel',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('Type: noun (de)')
    })

    it('should format expressions with type', () => {
      const word = createMockWord({
        is_expression: true,
        expression_type: 'idiom',
        dutch_lemma: 'het regent pijpenstelen',
      })
      const result = formatWordForCopying(word)

      expect(result).toContain('(idiom)')
    })
  })
})
