// Edge Function for secure Gemini AI integration
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

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

// Helper function to get relevant image from Unsplash API
async function getImageForWord(
  englishTranslation: string,
  partOfSpeech: string
): Promise<string | null> {
  try {
    // Get Unsplash API key from environment (if configured)
    const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY')

    if (!unsplashKey) {
      // Fallback to Lorem Picsum if no Unsplash key
      const searchTerm = englishTranslation.toLowerCase()
      let hash = 0
      for (let i = 0; i < searchTerm.length; i++) {
        const char = searchTerm.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
      }
      const imageId = (Math.abs(hash) % 1000) + 1
      return `https://picsum.photos/600/400?random=${imageId}`
    }

    // Use official Unsplash API
    const searchTerm = englishTranslation.toLowerCase()
    const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&client_id=${unsplashKey}&per_page=1&orientation=landscape`

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const photo = data.results[0]
      // Return the regular size image URL
      return photo.urls.regular || photo.urls.small
    }

    // Fallback to Lorem Picsum if no results
    const hash = englishTranslation.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
    const imageId = (Math.abs(hash) % 1000) + 1
    return `https://picsum.photos/600/400?random=${imageId}`
  } catch (error) {
    console.warn('Failed to fetch image:', error)
    // Always return a fallback image
    const hash = englishTranslation.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0)
      return a & a
    }, 0)
    const imageId = (Math.abs(hash) % 1000) + 1
    return `https://picsum.photos/600/400?random=${imageId}`
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
- For NOUNS, MANDATORY requirements:
  1. ALWAYS specify the correct article: "de" or "het" 
  2. Provide examples with definite article: "de/het [noun]"
  3. Include plural form if applicable: "de [nouns]" 
  4. Show indefinite usage: "een [noun]"
- Provide 2-3 most common English translations and 1-2 Russian translations
- Include 4-5 practical example sentences showing different forms
- Respond only with valid JSON, no additional text.

Example for verb "wandelen":
- "Ik wandel graag in het park" (present)
- "Ik heb gisteren lang gewandeld" (past perfect - REQUIRED)
- "We gaan morgen wandelen" (future)  
- "Hij wandelde elke dag" (past simple)

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
        analysisResult.part_of_speech
      )
    }

    // Prepare final response
    const response: WordAnalysisResponse = {
      lemma: analysisResult.lemma,
      part_of_speech: analysisResult.part_of_speech,
      is_irregular: analysisResult.is_irregular || false,
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
