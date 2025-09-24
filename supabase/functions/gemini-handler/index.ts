// Edge Function for secure Gemini AI integration
import { CORS_HEADERS } from './constants.ts'
import { getMultipleImagesForWord } from './imageUtils.ts'
import {
  callGeminiAPI,
  parseGeminiResponse,
  validateWordInput,
  cleanExamples,
  formatTranslations,
} from './geminiUtils.ts'
import { formatWordAnalysisPrompt } from '../_shared/geminiPrompts.ts'
import { getCachedAnalysis, saveToCache, normalizeWord } from './cacheUtils.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const requestBody = await req.json()
    const { word, forceRefresh } = requestBody

    console.log(
      `📝 Analyzing word: "${word}", forceRefresh: ${forceRefresh || false}`
    )

    // This function only analyzes strings - objects should use save-word endpoint
    if (typeof word !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'gemini-handler only analyzes strings. Use save-word endpoint for saving objects.',
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate input
    if (!validateWordInput(word)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid word input. Please provide a valid Dutch word.',
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    // Normalize word for cache operations
    const normalizedWord = normalizeWord(word)

    // Check the cache first (unless force refresh is requested)
    if (!forceRefresh) {
      const cachedAnalysis = await getCachedAnalysis(normalizedWord)

      if (cachedAnalysis) {
        console.log(
          `✅ Cache hit: "${normalizedWord}" (usage: ${cachedAnalysis.usage_count})`
        )

        // Build result from a cache
        const result = {
          dutch_original: word,
          dutch_lemma: cachedAnalysis.dutch_lemma,
          part_of_speech: cachedAnalysis.part_of_speech,
          translations: cachedAnalysis.translations,
          examples: cachedAnalysis.examples || [],
          image_url: cachedAnalysis.image_url || '',
          is_expression: cachedAnalysis.is_expression,
          is_irregular: cachedAnalysis.is_irregular,
          is_reflexive: cachedAnalysis.is_reflexive,
          is_separable: cachedAnalysis.is_separable,
          prefix_part: cachedAnalysis.prefix_part,
          root_verb: cachedAnalysis.root_verb,
          article: cachedAnalysis.article,
          expression_type: cachedAnalysis.expression_type,
          tts_url: cachedAnalysis.tts_url,
          synonyms: cachedAnalysis.synonyms || [],
          antonyms: cachedAnalysis.antonyms || [],
          plural: cachedAnalysis.plural,
          conjugation: cachedAnalysis.conjugation,
          preposition: cachedAnalysis.preposition,
          analysis_notes: cachedAnalysis.analysis_notes || '',
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: result,
            meta: {
              source: 'cache',
              cached_at: cachedAnalysis.created_at,
              usage_count: cachedAnalysis.usage_count,
              cache_hit: true,
            },
          }),
          {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Cache miss or force refresh - call Gemini API
    const source = forceRefresh ? 'force refresh' : 'cache miss'
    console.log(`🤖 ${source} - calling Gemini API for: "${word}"`)

    const prompt = formatWordAnalysisPrompt(word)
    const geminiResponse = await callGeminiAPI(prompt)
    const analysis = parseGeminiResponse(geminiResponse)

    // Get multiple image options
    const imageOptions = await getMultipleImagesForWord(
      analysis.translations.en[0] || word,
      analysis.part_of_speech,
      analysis.examples
    )

    // Clean and format data
    const cleanedExamples = cleanExamples(analysis.examples)
    const formattedTranslations = formatTranslations(analysis.translations)

    // Create TTS URL
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=${encodeURIComponent(analysis.dutch_lemma)}`

    // Build final result
    const result = {
      dutch_original: word,
      dutch_lemma: analysis.dutch_lemma || word,
      part_of_speech:
        analysis.part_of_speech || (analysis.is_separable ? 'verb' : null),
      translations: formattedTranslations,
      examples: cleanedExamples,
      image_url: imageOptions[0]?.url || '',
      is_expression: analysis.is_expression || false,
      is_irregular: analysis.is_irregular || false,
      is_reflexive: analysis.is_reflexive || false,
      is_separable: analysis.is_separable || false,
      prefix_part: analysis.prefix_part || null,
      root_verb: analysis.root_verb || null,
      article: analysis.article,
      expression_type: analysis.expression_type,
      tts_url: ttsUrl,
      // New fields from enhanced Gemini prompt
      synonyms: analysis.synonyms || [],
      antonyms: analysis.antonyms || [],
      plural: analysis.plural || null,
      conjugation: analysis.conjugation || null,
      preposition: analysis.preposition || null,
      analysis_notes: analysis.analysis_notes || '',
    }

    // Save to cache for future use (async, don't wait for completion)
    saveToCache({
      dutch_original: word,
      dutch_lemma: normalizedWord, // Use a normalized version as a cache key
      part_of_speech:
        analysis.part_of_speech || (analysis.is_separable ? 'verb' : null),
      is_irregular: analysis.is_irregular || false,
      article: analysis.article,
      is_reflexive: analysis.is_reflexive || false,
      is_expression: analysis.is_expression || false,
      expression_type: analysis.expression_type,
      is_separable: analysis.is_separable || false,
      prefix_part: analysis.prefix_part,
      root_verb: analysis.root_verb,
      translations: formattedTranslations,
      examples: cleanedExamples,
      tts_url: ttsUrl,
      image_url: imageOptions[0]?.url || '',
      synonyms: analysis.synonyms || [],
      antonyms: analysis.antonyms || [],
      plural: analysis.plural,
      conjugation: analysis.conjugation,
      preposition: analysis.preposition,
      analysis_notes: analysis.analysis_notes || '',
    }).catch(error => {
      console.error('❌ Cache save error:', error)
      // Don't fail the request if cache save fails
    })

    console.log(`✅ Fresh analysis completed for: "${word}"`)

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        meta: {
          source: 'gemini',
          cache_hit: false,
          force_refresh: forceRefresh || false,
          processed_at: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error(
      '❌ Gemini handler error:',
      error instanceof Error ? error.message : 'Unknown error'
    )

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  }
})
