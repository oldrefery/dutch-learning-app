import { API_CONFIG } from './constants.ts'

// Helper function to call Gemini API
export async function callGeminiAPI(prompt: string): Promise<any> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')!

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
        maxOutputTokens: 8192,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  return await response.json()
}

// Helper function to parse Gemini response
export function parseGeminiResponse(response: any): any {
  try {
    console.log('🔍 [parseGeminiResponse] Raw response structure:', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length,
      firstCandidate: response.candidates?.[0] ? 'exists' : 'missing',
    })

    const content = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      console.error(
        '❌ [parseGeminiResponse] No content in response:',
        response
      )
      return { content: 'No content available' }
    }

    console.log(
      '📝 [parseGeminiResponse] Raw content from Gemini:',
      content.substring(0, 200) + '...'
    )

    // Try to parse as JSON
    const jsonMatch = content.match(/{[\s\S]*}/)
    if (jsonMatch) {
      console.log('✅ [parseGeminiResponse] Found JSON match, parsing...')
      const parsed = JSON.parse(jsonMatch[0])
      console.log('📊 [parseGeminiResponse] Successfully parsed JSON:', {
        dutch_lemma: parsed.dutch_lemma,
        part_of_speech: parsed.part_of_speech,
        expression_type: parsed.expression_type,
      })
      return parsed
    }

    console.log('⚠️ [parseGeminiResponse] No JSON found, returning raw content')
    // Fallback: return raw content
    return { content }
  } catch (error) {
    console.error(
      '❌ [parseGeminiResponse] Error parsing Gemini response:',
      error
    )
    console.error('❌ [parseGeminiResponse] Raw response:', response)
    return { content: response }
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

  // Check for valid Dutch characters, including punctuation for interjections
  const dutchPattern =
    /^[a-zA-ZàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s\-'!?.,;:]+$/
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
    en: en
      .filter((t: any) => t && typeof t === 'string')
      .map((t: string) => t.trim()),
    ru: ru
      .filter((t: any) => t && typeof t === 'string')
      .map((t: string) => t.trim()),
  }
}

// Helper function to parse input word and detect article/lemma
export function parseWordInput(input: string): {
  dutch_lemma: string
  article?: string
  part_of_speech?: string
} {
  // Normalize: trim, remove periods, replace multiple spaces with single space
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')

  // Check for definite articles (de/het)
  if (normalized.startsWith('de ')) {
    return {
      dutch_lemma: normalized.substring(3).trim(),
      article: 'de',
      part_of_speech: 'noun',
    }
  }

  if (normalized.startsWith('het ')) {
    return {
      dutch_lemma: normalized.substring(4).trim(),
      article: 'het',
      part_of_speech: 'noun',
    }
  }

  // No article detected - just return the lemma
  return {
    dutch_lemma: normalized,
  }
}
