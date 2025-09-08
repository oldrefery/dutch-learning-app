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
import {
  analyzeSeparableVerb,
  createSmartSearchQuery,
  validateWordInput,
  cleanExamples,
  formatTranslations,
} from '../_shared/geminiUtils.ts'
import type {
  WordAnalysisRequest,
  WordAnalysisResponse,
  GeminiAnalysisResult,
} from '../_shared/types.ts'
import {
  GEMINI_PROMPTS,
  formatWordAnalysisPrompt,
} from '../_shared/geminiPrompts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Types are now imported from ./types.ts

// Helper functions are now imported from ./utils.ts

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
    const prompt = formatWordAnalysisPrompt(word)

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
