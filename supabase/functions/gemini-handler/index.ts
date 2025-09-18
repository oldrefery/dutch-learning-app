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
} from './geminiUtils.ts'
import { formatWordAnalysisPrompt } from '../_shared/geminiPrompts.ts'

serve(async req => {
  console.log('=== GEMINI HANDLER START ===')
  console.log('Request method:', req.method)
  console.log('Request URL:', req.url)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    console.log('Parsing request body...')
    const requestBody = await req.json()
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    console.log('Request body type:', typeof requestBody)
    console.log('Request body keys:', Object.keys(requestBody))

    const { word, collectionId, userId } = requestBody
    console.log('Extracted word:', word)
    console.log('Word type:', typeof word)

    // This function only analyzes strings - objects should use save-word endpoint
    if (typeof word !== 'string') {
      console.log('Error: gemini-handler expects string, got:', typeof word)
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

    console.log('Analyzing word string:', word)

    // Validate input
    if (!validateWordInput(word)) {
      console.log('Word validation failed for:', word)
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
    console.log('Word validation passed')

    // Call Gemini API for word analysis
    console.log('Creating prompt for word:', word)
    const prompt = formatWordAnalysisPrompt(word)
    console.log('Prompt created, calling Gemini API...')

    const geminiResponse = await callGeminiAPI(prompt)
    console.log('Gemini API response received, parsing...')

    const analysis = parseGeminiResponse(geminiResponse)
    console.log('Analysis parsed:', JSON.stringify(analysis, null, 2))

    // Get multiple image options
    console.log('Getting image options...')
    const imageOptions = await getMultipleImagesForWord(
      analysis.translations.en[0] || word,
      analysis.part_of_speech,
      analysis.examples
    )
    console.log('Image options received:', imageOptions.length, 'images')

    // Clean and format data
    console.log('Cleaning and formatting data...')
    const cleanedExamples = cleanExamples(analysis.examples)
    const formattedTranslations = formatTranslations(analysis.translations)
    console.log('Data cleaned and formatted')

    // Create TTS URL
    console.log('Creating TTS URL...')
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=${encodeURIComponent(analysis.dutch_lemma)}`

    // Build final result
    console.log('Building final result...')
    const result = {
      dutch_original: word,
      dutch_lemma: analysis.dutch_lemma || word,
      part_of_speech: analysis.part_of_speech,
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
    }

    console.log('Sending successful response...')
    console.log('Final result:', JSON.stringify(result, null, 2))

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('=== ERROR IN GEMINI HANDLER ===')
    console.error('Error type:', typeof error)
    console.error(
      'Error message:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    console.error(
      'Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    )
    console.error('Full error object:', error)

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
