// Edge Function for secure Gemini AI integration
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import {
  IMAGE_CONFIG,
  SEARCH_CONFIG,
  API_CONFIG,
  createPicsumUrl,
  getPreferredUnsplashUrl,
  generateImageHash,
} from '../_shared/constants.ts'

// Separable verb prefixes for fallback detection
const SEPARABLE_PREFIXES = [
  'aan',
  'af',
  'bij',
  'door',
  'in',
  'mee',
  'na',
  'om',
  'onder',
  'op',
  'over',
  'toe',
  'uit',
  'vast',
  'weg',
  'voorbij',
  'terug',
  'voor',
  'na',
]

// Helper function to detect separable verbs if Gemini missed them
function analyzeSeparableVerb(lemma: string, partOfSpeech: string) {
  if (partOfSpeech !== 'verb') {
    return { is_separable: false, prefix_part: null, root_verb: null }
  }

  for (const prefix of SEPARABLE_PREFIXES) {
    if (lemma.startsWith(prefix)) {
      const rootVerb = lemma.substring(prefix.length)
      // Check if root verb is reasonable (at least 3 chars, common verb patterns)
      if (rootVerb.length >= 3) {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface WordAnalysisRequest {
  word: string
}

interface WordAnalysisResponse {
  lemma: string
  part_of_speech: string
  is_irregular?: boolean
  is_separable?: boolean
  prefix_part?: string
  root_verb?: string
  article?: 'de' | 'het' // For nouns only
  translations: {
    en: string[]
    ru?: string[]
  }
  examples: Array<{
    nl: string
    en: string
    ru?: string
  }>
  tts_url: string
  image_url?: string // Associated image for visual learning
}

// Helper function to create smart search queries
function createSmartSearchQuery(
  englishTranslation: string,
  partOfSpeech: string,
  examples?: Array<{ nl: string; en: string; ru?: string }>
): string[] {
  const queries = []
  const baseTranslation = englishTranslation.toLowerCase()

  // Base query
  queries.push(baseTranslation)

  // Smart queries based on part of speech
  switch (partOfSpeech) {
    case 'verb':
      // For verbs, add action context
      if (
        baseTranslation.includes('leave') ||
        baseTranslation.includes('depart')
      ) {
        queries.push(
          'departure train station',
          'leaving journey',
          'travel departure'
        )
      } else if (baseTranslation.includes('walk')) {
        queries.push('person walking', 'walking path', 'pedestrian walking')
      } else if (
        baseTranslation.includes('buy') ||
        baseTranslation.includes('purchase')
      ) {
        queries.push('shopping buying', 'purchase store', 'buying goods')
      } else if (baseTranslation.includes('eat')) {
        queries.push('eating food', 'person eating', 'dining meal')
      } else {
        queries.push(`${baseTranslation} action`, `person ${baseTranslation}`)
      }
      break

    case 'noun':
      // For nouns, be more specific
      if (
        baseTranslation.includes('house') ||
        baseTranslation.includes('home')
      ) {
        queries.push('house building', 'residential home', 'house exterior')
      } else if (baseTranslation.includes('cat')) {
        queries.push('domestic cat', 'house cat', 'cat animal')
      } else if (baseTranslation.includes('book')) {
        queries.push('book reading', 'open book', 'books library')
      } else {
        queries.push(`${baseTranslation} object`, `${baseTranslation} thing`)
      }
      break

    case 'adjective':
      // For adjectives, show the quality
      queries.push(`${baseTranslation} concept`, `${baseTranslation} feeling`)
      break

    default:
      queries.push(`${baseTranslation} concept`)
  }

  // Add context from examples if available
  if (examples && examples.length > 0) {
    const firstExample = examples[0].en.toLowerCase()
    // Extract key words from example
    const contextWords = firstExample
      .split(' ')
      .filter(
        word =>
          word.length > SEARCH_CONFIG.MIN_CONTEXT_WORD_LENGTH &&
          !SEARCH_CONFIG.STOP_WORDS.includes(word)
      )

    if (contextWords.length > 0) {
      const contextWord = contextWords[0]
      queries.push(`${baseTranslation} ${contextWord}`)
    }
  }

  return queries
}

// Helper function to get multiple image options for word
async function getMultipleImagesForWord(
  englishTranslation: string,
  partOfSpeech: string,
  examples?: Array<{ nl: string; en: string; ru?: string }>,
  count: number = IMAGE_CONFIG.DEFAULT_QUERY_COUNT
): Promise<Array<{ url: string; alt: string }>> {
  try {
    const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY')

    if (!unsplashKey) {
      // Fallback to Lorem Picsum with different seeds
      const images = []
      for (let i = 0; i < count; i++) {
        const imageId = generateImageHash(
          englishTranslation.toLowerCase(),
          i * 100
        )
        images.push({
          url: createPicsumUrl(imageId),
          alt: `${englishTranslation} (option ${i + 1})`,
        })
      }
      return images
    }

    // Get smart search queries
    const searchQueries = createSmartSearchQuery(
      englishTranslation,
      partOfSpeech,
      examples
    )
    const images = []

    // Try different search queries until we have enough images
    for (const query of searchQueries) {
      if (images.length >= count) break

      try {
        const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&per_page=${count}&orientation=${IMAGE_CONFIG.UNSPLASH.ORIENTATION}`

        const response = await fetch(apiUrl)
        if (!response.ok) continue

        const data = await response.json()

        if (data.results && data.results.length > 0) {
          for (const photo of data.results) {
            if (images.length >= count) break

            // Avoid duplicates and use mobile-optimized sizes
            const url = getPreferredUnsplashUrl(photo)
            if (!images.some(img => img.url === url)) {
              images.push({
                url,
                alt:
                  photo.alt_description || `${englishTranslation} (${query})`,
              })
            }
          }
        }
      } catch (queryError) {
        console.warn(`Query "${query}" failed:`, queryError)
        continue
      }
    }

    // Fill remaining slots with Lorem Picsum if needed
    while (images.length < count) {
      const imageId = generateImageHash(englishTranslation, images.length * 50)
      images.push({
        url: createPicsumUrl(imageId),
        alt: `${englishTranslation} (fallback ${images.length + 1})`,
      })
    }

    return images
  } catch (error) {
    console.warn('Failed to fetch multiple images:', error)
    // Return fallback images
    const images = []
    for (let i = 0; i < count; i++) {
      const imageId = generateImageHash(englishTranslation, i * 25)
      images.push({
        url: createPicsumUrl(imageId),
        alt: `${englishTranslation} (fallback ${i + 1})`,
      })
    }
    return images
  }
}

// Helper function to get relevant image from Unsplash API (improved version)
async function getImageForWord(
  englishTranslation: string,
  partOfSpeech: string,
  examples?: Array<{ nl: string; en: string; ru?: string }>
): Promise<string | null> {
  try {
    const images = await getMultipleImagesForWord(
      englishTranslation,
      partOfSpeech,
      examples,
      1
    )
    return images.length > 0 ? images[0].url : null
  } catch (error) {
    console.warn('Failed to fetch image:', error)
    // Fallback
    const imageId = generateImageHash(englishTranslation)
    return createPicsumUrl(imageId)
  }
}

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { word }: WordAnalysisRequest = await req.json()

    if (!word) {
      return new Response(JSON.stringify({ error: 'Word is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Prepare prompt for Gemini
    const prompt = `
Analyze the Dutch word "${word}" and provide a JSON response with the following structure:
{
  "lemma": "base form of the word (infinitive for verbs, singular for nouns)",
  "part_of_speech": "verb|noun|adjective|adverb|preposition|conjunction|interjection",
  "is_irregular": true/false (only for verbs),
  "is_separable": true/false (only for verbs with separable prefixes),
  "prefix_part": "separable prefix (if applicable, e.g., 'op' from 'opgeven')",
  "root_verb": "root verb part (if applicable, e.g., 'geven' from 'opgeven')",
  "article": "de|het" (MANDATORY for nouns, omit for other parts of speech),
  "translations": {
    "en": ["primary English translation", "alternative translation"],
    "ru": ["primary Russian translation", "alternative translation"] 
  },
  "examples": [
    {
      "nl": "Dutch example sentence",
      "en": "English translation", 
      "ru": "Russian translation"
    }
  ]
}

IMPORTANT INSTRUCTIONS:
- For VERBS, provide examples with different verb forms and tenses:
  1. Present tense (ik [verb], we [verb]en) 
  2. Past perfect/perfectum (ik heb/ben [ge-verb]) - MANDATORY for verbs
  3. Future tense (ik ga [verb])
  4. Past simple (if commonly used)
- For SEPARABLE VERBS (scheidbare werkwoorden), CRITICAL ANALYSIS:
  1. CAREFULLY check if the verb begins with a separable prefix
  2. Common separable prefixes: aan, af, bij, door, in, mee, na, om, onder, op, over, toe, uit, vast, weg, voorbij, terug
  3. EXAMPLES: uitgaan=uit+gaan, meenemen=mee+nemen, opgeven=op+geven, aankomen=aan+komen, toegeven=toe+geven
  4. If the verb starts with any of these prefixes, set is_separable=true
  5. prefix_part: the separable part (e.g., "uit" from "uitgaan", "mee" from "meenemen")
  6. root_verb: the base verb (e.g., "gaan" from "uitgaan", "nemen" from "meenemen")  
  7. Show examples with separated forms: "Ik ga uit" (present), "Ik ben uitgegaan" (past perfect)
- For NOUNS, MANDATORY requirements:
  1. ALWAYS specify the correct article: "de" or "het" 
  2. Provide examples with definite article: "de/het [noun]"
  3. Include plural form if applicable: "de [nouns]" 
  4. Show indefinite usage: "een [noun]"
- Provide 2-3 most common English translations and 1-2 Russian translations
- Include 4-5 practical example sentences showing different forms
- Respond only with valid JSON, no additional text.

Example for regular verb "wandelen":
- "Ik wandel graag in het park" (present)
- "Ik heb gisteren lang gewandeld" (past perfect - REQUIRED)
- "We gaan morgen wandelen" (future)  
- "Hij wandelde elke dag" (past simple)

Example for separable verb "uitgaan" (uit + gaan):
- "Ik ga uit" (present - prefix separated)
- "Ik ben uitgegaan" (past perfect - prefix attached) 
- "We gaan uitgaan" (future - prefix attached)
- "Hij ging uit gisteren" (past simple - prefix separated)

Example for separable verb "meenemen" (mee + nemen):
- "Ik neem het mee" (present - prefix separated)
- "Ik heb het meegenomen" (past perfect - prefix attached)
- "We gaan het meenemen" (future - prefix attached)

Example for noun "huis":
- "Het huis is groot" (definite article + noun)
- "Ik woon in een huis" (indefinite article)
- "De huizen zijn duur" (plural form)
- "Het mooie huis staat te koop" (with adjective)
`

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
            temperature: 0.1,
            maxOutputTokens: 1000,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!aiText) {
      throw new Error('No response from Gemini AI')
    }

    // Parse AI response
    let analysisResult
    try {
      // Clean the response text - remove any markdown formatting
      const cleanText = aiText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^{]*/, '') // Remove any text before first {
        .replace(/[^}]*$/, '') // Remove any text after last }
        .trim()

      analysisResult = JSON.parse(cleanText)
    } catch (e) {
      console.error('JSON parsing error:', e.message)
      console.error('Raw AI text:', aiText)
      throw new Error(`Invalid JSON response from AI: ${e.message}`)
    }

    // Generate TTS URL using Google TTS (public API)
    // This is safe to expose as it's a public Google service
    const ttsText = encodeURIComponent(analysisResult.lemma)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=${ttsText}`

    // Get associated image for visual learning
    // Use the primary English translation and part of speech for smart image search
    let imageUrl: string | null = null
    if (analysisResult.translations?.en?.[0]) {
      imageUrl = await getImageForWord(
        analysisResult.translations.en[0],
        analysisResult.part_of_speech,
        analysisResult.examples
      )
    }

    // Apply fallback separable verb detection if Gemini missed it
    const separableInfo = analysisResult.is_separable
      ? {
          is_separable: analysisResult.is_separable,
          prefix_part: analysisResult.prefix_part,
          root_verb: analysisResult.root_verb,
        }
      : analyzeSeparableVerb(
          analysisResult.lemma,
          analysisResult.part_of_speech
        )

    // Prepare final response
    const response: WordAnalysisResponse = {
      lemma: analysisResult.lemma,
      part_of_speech: analysisResult.part_of_speech,
      is_irregular: analysisResult.is_irregular || false,
      is_separable: separableInfo.is_separable,
      prefix_part: separableInfo.prefix_part,
      root_verb: separableInfo.root_verb,
      article: analysisResult.article, // Include article for nouns
      translations: analysisResult.translations,
      examples: analysisResult.examples || [],
      tts_url: ttsUrl,
      image_url: imageUrl, // Include associated image
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in gemini-handler:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
