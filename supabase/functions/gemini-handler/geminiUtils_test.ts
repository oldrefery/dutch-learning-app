/**
 * Tests for geminiUtils - pure utility functions
 *
 * Tests validateWordInput, parseWordInput, cleanExamples,
 * formatTranslations, and parseGeminiResponse.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  validateWordInput,
  parseWordInput,
  cleanExamples,
  formatTranslations,
  parseGeminiResponse,
} from './geminiUtils.ts'

// =========================================
// validateWordInput
// =========================================

Deno.test('validateWordInput - accepts valid Dutch word', () => {
  assertEquals(validateWordInput('huis'), true)
})

Deno.test('validateWordInput - accepts word with article', () => {
  assertEquals(validateWordInput('het huis'), true)
})

Deno.test('validateWordInput - accepts word with diacritics', () => {
  assertEquals(validateWordInput('café'), true)
})

Deno.test('validateWordInput - accepts interjection with punctuation', () => {
  assertEquals(validateWordInput('Jeetje!'), true)
})

Deno.test('validateWordInput - accepts hyphenated word', () => {
  assertEquals(validateWordInput('op-staan'), true)
})

Deno.test('validateWordInput - rejects empty string', () => {
  assertEquals(validateWordInput(''), false)
})

Deno.test('validateWordInput - rejects whitespace only', () => {
  assertEquals(validateWordInput('   '), false)
})

Deno.test('validateWordInput - rejects string with numbers', () => {
  assertEquals(validateWordInput('huis123'), false)
})

Deno.test('validateWordInput - rejects string with special characters', () => {
  assertEquals(validateWordInput('huis@#$'), false)
})

// =========================================
// parseWordInput
// =========================================

Deno.test('parseWordInput - parses bare lemma', () => {
  const result = parseWordInput('huis')
  assertEquals(result.dutch_lemma, 'huis')
  assertEquals(result.article, undefined)
  assertEquals(result.part_of_speech, undefined)
})

Deno.test('parseWordInput - parses "de" article', () => {
  const result = parseWordInput('de kat')
  assertEquals(result.dutch_lemma, 'kat')
  assertEquals(result.article, 'de')
  assertEquals(result.part_of_speech, 'noun')
})

Deno.test('parseWordInput - parses "het" article', () => {
  const result = parseWordInput('het huis')
  assertEquals(result.dutch_lemma, 'huis')
  assertEquals(result.article, 'het')
  assertEquals(result.part_of_speech, 'noun')
})

Deno.test('parseWordInput - normalizes to lowercase', () => {
  const result = parseWordInput('De Kat')
  assertEquals(result.dutch_lemma, 'kat')
  assertEquals(result.article, 'de')
})

Deno.test('parseWordInput - trims whitespace', () => {
  const result = parseWordInput('  huis  ')
  assertEquals(result.dutch_lemma, 'huis')
})

Deno.test('parseWordInput - removes periods', () => {
  const result = parseWordInput('a.u.b.')
  assertEquals(result.dutch_lemma, 'aub')
})

Deno.test('parseWordInput - collapses multiple spaces', () => {
  const result = parseWordInput('de   kat')
  assertEquals(result.dutch_lemma, 'kat')
  assertEquals(result.article, 'de')
})

// =========================================
// cleanExamples
// =========================================

Deno.test('cleanExamples - cleans valid examples', () => {
  const examples = [
    {
      nl: ' Het huis is groot. ',
      en: ' The house is big. ',
      ru: ' Дом большой. ',
    },
  ]
  const result = cleanExamples(examples)
  assertEquals(result.length, 1)
  assertEquals(result[0].nl, 'Het huis is groot.')
  assertEquals(result[0].en, 'The house is big.')
  assertEquals(result[0].ru, 'Дом большой.')
})

Deno.test('cleanExamples - filters out invalid examples', () => {
  const examples = [
    { nl: 'Valid', en: 'Valid' },
    { nl: '', en: 'Missing nl' },
    { nl: 'Missing en', en: '' },
    null,
    undefined,
    'not an object',
  ]
  // deno-lint-ignore no-explicit-any
  const result = cleanExamples(examples as any[])
  assertEquals(result.length, 1)
})

Deno.test('cleanExamples - limits to 6 examples', () => {
  const examples = Array.from({ length: 10 }, (_, i) => ({
    nl: `Example ${i}`,
    en: `Example ${i}`,
  }))
  const result = cleanExamples(examples)
  assertEquals(result.length, 6)
})

Deno.test('cleanExamples - returns empty array for non-array input', () => {
  // deno-lint-ignore no-explicit-any
  const result = cleanExamples(null as any)
  assertEquals(result, [])
})

Deno.test('cleanExamples - handles examples without ru field', () => {
  const examples = [{ nl: 'Hallo', en: 'Hello' }]
  const result = cleanExamples(examples)
  assertEquals(result[0].ru, undefined)
})

// =========================================
// formatTranslations
// =========================================

Deno.test('formatTranslations - formats valid translations', () => {
  const result = formatTranslations({ en: ['house', 'home'], ru: ['дом'] })
  assertEquals(result.en, ['house', 'home'])
  assertEquals(result.ru, ['дом'])
})

Deno.test('formatTranslations - trims whitespace', () => {
  const result = formatTranslations({ en: [' house '], ru: [' дом '] })
  assertEquals(result.en, ['house'])
  assertEquals(result.ru, ['дом'])
})

Deno.test('formatTranslations - returns empty arrays for null input', () => {
  const result = formatTranslations(null)
  assertEquals(result, { en: [], ru: [] })
})

Deno.test(
  'formatTranslations - returns empty arrays for non-object input',
  () => {
    const result = formatTranslations('invalid')
    assertEquals(result, { en: [], ru: [] })
  }
)

Deno.test('formatTranslations - filters non-string values', () => {
  const result = formatTranslations({
    en: ['house', null, 123, 'home'],
    ru: [],
  })
  assertEquals(result.en, ['house', 'home'])
})

Deno.test('formatTranslations - handles missing ru field', () => {
  const result = formatTranslations({ en: ['house'] })
  assertEquals(result.ru, [])
})

// =========================================
// parseGeminiResponse
// =========================================

Deno.test('parseGeminiResponse - parses valid JSON response', () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: '{"dutch_lemma": "huis", "part_of_speech": "noun"}',
            },
          ],
        },
      },
    ],
  }
  const result = parseGeminiResponse(response)
  assertEquals(result.dutch_lemma, 'huis')
  assertEquals(result.part_of_speech, 'noun')
})

Deno.test(
  'parseGeminiResponse - extracts JSON from markdown code block',
  () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Here is the analysis:\n```json\n{"dutch_lemma": "kat"}\n```',
              },
            ],
          },
        },
      ],
    }
    const result = parseGeminiResponse(response)
    assertEquals(result.dutch_lemma, 'kat')
  }
)

Deno.test('parseGeminiResponse - returns fallback for empty candidates', () => {
  const result = parseGeminiResponse({ candidates: [] })
  assertEquals(result.content, 'No content available')
})

Deno.test('parseGeminiResponse - returns fallback for null response', () => {
  const result = parseGeminiResponse({})
  assertEquals(result.content, 'No content available')
})

Deno.test('parseGeminiResponse - handles invalid JSON gracefully', () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [{ text: 'This is not JSON at all' }],
        },
      },
    ],
  }
  const result = parseGeminiResponse(response)
  assertEquals(result.content, 'This is not JSON at all')
})
