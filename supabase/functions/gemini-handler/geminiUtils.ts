import { API_CONFIG } from './constants.ts'

// Helper function to call Gemini API
export async function callGeminiAPI(prompt: string): Promise<any> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required')
  }

  const response = await fetch(API_CONFIG.GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return data
}

// Helper function to parse Gemini response
export function parseGeminiResponse(response: any): any {
  try {
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      throw new Error('No content in Gemini response')
    }

    // Try to parse as JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    // Fallback: return raw content
    return { content }
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    throw new Error('Failed to parse Gemini response')
  }
}

// Helper function to validate word input
export function validateWordInput(word: string): boolean {
  if (!word || typeof word !== 'string') {
    return false
  }

  const trimmedWord = word.trim()
  if (trimmedWord.length === 0) {
    return false
  }

  // Check for valid Dutch characters
  const dutchPattern =
    /^[a-zA-ZàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s\-']+$/
  return dutchPattern.test(trimmedWord)
}

// Helper function to clean examples
export function cleanExamples(
  examples: any[]
): Array<{ nl: string; en: string; ru?: string }> {
  if (!Array.isArray(examples)) {
    return []
  }

  return examples
    .filter(ex => ex && typeof ex === 'object' && ex.nl && ex.en)
    .map(ex => ({
      nl: ex.nl.trim(),
      en: ex.en.trim(),
      ru: ex.ru ? ex.ru.trim() : undefined,
    }))
    .slice(0, 6) // Limit to 6 examples
}

// Helper function to format translations
export function formatTranslations(translations: any): {
  en: string[]
  ru: string[]
} {
  if (!translations || typeof translations !== 'object') {
    return { en: [], ru: [] }
  }

  const en = Array.isArray(translations.en) ? translations.en : []
  const ru = Array.isArray(translations.ru) ? translations.ru : []

  return {
    en: en.filter(t => t && typeof t === 'string').map(t => t.trim()),
    ru: ru.filter(t => t && typeof t === 'string').map(t => t.trim()),
  }
}

// Helper function to analyze separable verb
export function analyzeSeparableVerb(word: string): {
  isSeparable: boolean
  prefix?: string
  root?: string
} {
  const separablePrefixes = [
    'aan',
    'af',
    'bij',
    'door',
    'in',
    'mee',
    'naar',
    'om',
    'op',
    'over',
    'rond',
    'terug',
    'uit',
    'voor',
    'weg',
    'zonder',
  ]

  for (const prefix of separablePrefixes) {
    if (word.toLowerCase().startsWith(prefix)) {
      return {
        isSeparable: true,
        prefix: prefix,
        root: word.substring(prefix.length),
      }
    }
  }

  return { isSeparable: false }
}
