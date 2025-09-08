// Edge Function for secure Gemini AI integration
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { CORS_HEADERS } from './constants.ts'
import { getMultipleImagesForWord } from './imageUtils.ts'
import {
  callGeminiAPI,
  parseGeminiResponse,
  validateWordInput,
  cleanExamples,
  formatTranslations,
  analyzeSeparableVerb,
} from './geminiUtils.ts'
import {
  GEMINI_PROMPTS,
  formatWordAnalysisPrompt,
} from '../_shared/geminiPrompts.ts'
import type {
  WordAnalysisRequest,
  WordAnalysisResponse,
  WordAnalysisResult,
  GeminiAnalysisResult,
} from './types.ts'

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Parse request body
    const { word, collectionId, userId }: WordAnalysisRequest = await req.json()

    // Validate input
    if (!validateWordInput(word)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid word input. Please provide a valid Dutch word.',
        } as WordAnalysisResponse),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    // Call Gemini API for word analysis
    const prompt = formatWordAnalysisPrompt(word)
    const geminiResponse = await callGeminiAPI(prompt)
    const analysis: GeminiAnalysisResult = parseGeminiResponse(geminiResponse)

    // Analyze separable verb
    const separableAnalysis = analyzeSeparableVerb(word)

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
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=${encodeURIComponent(word)}`

    // Build final result
    const result: WordAnalysisResult = {
      dutch_original: word,
      dutch_lemma: analysis.dutch_lemma || word,
      part_of_speech: analysis.part_of_speech,
      translations: formattedTranslations,
      examples: cleanedExamples,
      image_url: imageOptions[0]?.url || '',
      image_options: imageOptions,
      is_expression: analysis.is_expression || false,
      is_irregular: analysis.is_irregular || false,
      is_reflexive: analysis.is_reflexive || false,
      is_separable: separableAnalysis.isSeparable,
      prefix_part: separableAnalysis.prefix,
      root_verb: separableAnalysis.root,
      article: analysis.article,
      expression_type: analysis.expression_type,
      tts_url: ttsUrl,
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      } as WordAnalysisResponse),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in gemini-handler:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as WordAnalysisResponse),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  }
})
