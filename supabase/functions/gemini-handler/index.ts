// Edge Function for secure Gemini AI integration
import { CORS_HEADERS } from './constants.ts'
import { getMultipleImagesForWord } from './imageUtils.ts'
import {
  callGeminiAPI,
  parseGeminiResponse,
  validateWordInput,
  cleanExamples,
  formatTranslations,
  parseWordInput,
} from './geminiUtils.ts'
import { formatWordAnalysisPrompt } from '../_shared/geminiPrompts.ts'
import {
  getCachedAnalysis,
  getCachedVariants,
  saveToCache,
  normalizeWord,
} from './cacheUtils.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const requestBody = await req.json()
    const { word, forceRefresh } = requestBody

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

    // Parse input to detect article and determine search strategy
    const parsedInput = parseWordInput(word)
    const normalizedLemma = normalizeWord(parsedInput.dutch_lemma)

    // Smart cache lookup strategy
    let cachedAnalysis = null
    let cacheStrategy = 'miss'

    if (!forceRefresh) {
      if (parsedInput.article && parsedInput.part_of_speech) {
        // User provided article (e.g., "het haar") - exact semantic search
        cachedAnalysis = await getCachedAnalysis(
          normalizedLemma,
          parsedInput.part_of_speech,
          parsedInput.article
        )
        cacheStrategy = cachedAnalysis ? 'exact_hit' : 'exact_miss'
      } else {
        // User provided only lemma (e.g., "haar") - check for variants
        const variants = await getCachedVariants(normalizedLemma)

        if (variants.length > 0) {
          // For now, return the most used variant
          // TODO: In future, we could return all variants and let user choose
          cachedAnalysis = variants[0]
          cacheStrategy = 'variant_hit'
        } else {
          cacheStrategy = 'variant_miss'
        }
      }

      if (cachedAnalysis) {
        // Build result from cache
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
              cache_strategy: cacheStrategy,
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

    const prompt = formatWordAnalysisPrompt(word)
    const geminiResponse = await callGeminiAPI(prompt)
    const analysis = parseGeminiResponse(geminiResponse)

    // Clean and format data
    const cleanedExamples = cleanExamples(analysis.examples)
    const formattedTranslations = formatTranslations(analysis.translations)

    // Get multiple image options
    const imageOptions = await getMultipleImagesForWord(
      formattedTranslations.en?.[0] || analysis.translations?.en?.[0] || word,
      analysis.part_of_speech,
      cleanedExamples
    )

    // Data already cleaned above

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
      dutch_lemma: normalizedLemma, // Use parsed and normalized lemma as cache key
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
    }).catch(() => {
      // Don't fail the request if cache save fails
    })

    console.log(`✅ Analysis completed for: "${word}"`)

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

    // Send to Sentry
    try {
      const sentryDsn = Deno.env.get('SENTRY_DSN')
      if (sentryDsn) {
        await fetch('https://sentry.io/api/0/envelope/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
          },
          body: JSON.stringify({
            event_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            platform: 'javascript',
            sdk: { name: 'custom', version: '1.0.0' },
            exception: {
              values: [
                {
                  type: error instanceof Error ? error.name : 'Error',
                  value:
                    error instanceof Error ? error.message : 'Unknown error',
                  stacktrace:
                    error instanceof Error ? { frames: [] } : undefined,
                },
              ],
            },
            extra: {
              context: 'gemini-handler',
              word: requestBody?.word,
              forceRefresh: requestBody?.forceRefresh,
            },
          }),
        }).catch(() => {}) // Silent fail for Sentry
      }
    } catch (sentryError) {
      // Silent fail for Sentry reporting
    }

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
