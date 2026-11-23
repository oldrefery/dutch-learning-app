import {
  exactPhraseInput,
  matchesWordVariant,
  parseWordVariantInput,
  readWordVariant,
  type WordVariant,
} from '../../../packages/domain/src/word-variant.ts'
import {
  discoverWordVariants,
  isPluralOfAnalyzedNoun,
  wordVariantInstruction,
} from './wordVariants.ts'
import { additionalPreposition } from '../../../packages/domain/src/dutch-headword.ts'
import { assertRussianScript } from '../_shared/russianText.ts'
// Edge Function for secure Gemini AI integration
import { CORS_HEADERS } from './constants.ts'
import { getMultipleImagesForWord } from './imageUtils.ts'
import {
  assertEnglishTranslation,
  callGeminiAPI,
  parseGeminiResponse,
  validateWordInput,
  cleanExamples,
  formatTranslations,
  parseWordInput,
  normalizeUsageNotes,
} from './geminiUtils.ts'
import { formatWordAnalysisPrompt } from '../_shared/geminiPrompts.ts'
import {
  ANALYSIS_CEFR_PROMPT,
  createGeminiCefrEstimate,
  readAnalysisCefrEstimate,
} from './cefr.ts'
import { authorizeFullAccessRequest } from '../_shared/authorizeFullAccess.ts'
import { EDGE_QUOTA_CONFIG } from '../_shared/constants.ts'
import { consumeRequestQuotaWithServiceRole } from '../_shared/requestQuota.ts'
import {
  CURRENT_ANALYSIS_CACHE_VERSION,
  PHRASE_ANALYSIS_CACHE_VERSION,
  getCachedAnalysis,
  getCachedVariants,
  getCachedWordChoices,
  saveWordChoices,
  getCacheDictionaryReference,
  saveToCache,
  normalizeWord,
} from './cacheUtils.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const authorization = await authorizeFullAccessRequest(req)
  if (!authorization.ok) {
    return new Response(
      JSON.stringify({
        success: false,
        error: authorization.message,
        code: authorization.code,
      }),
      {
        status: authorization.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  }

  const meta: { source?: 'gemini' | 'cache'; model?: string } = {}

  try {
    const parsedBody: unknown = await req.json()
    if (typeof parsedBody !== 'object' || parsedBody === null) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request body must be a JSON object.',
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    const requestBody = parsedBody as {
      word?: unknown
      forceRefresh?: unknown
      resolveVariants?: unknown
      selectedVariant?: unknown
    }
    const { word: input } = requestBody
    const resolveVariants = requestBody.resolveVariants === true
    const forceRefresh = requestBody.forceRefresh === true
    const cefrEnabled = Deno.env.get('CEFR_ANALYSIS_ENABLED') === 'true'

    // This function only analyzes strings - objects should use save-word endpoint
    if (typeof input !== 'string') {
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

    const variantInput = resolveVariants ? parseWordVariantInput(input) : null
    const word = variantInput?.word ?? input
    const selected = readWordVariant(requestBody.selectedVariant)
    let requested: Partial<WordVariant> = variantInput ?? {}
    const inputError =
      variantInput?.error ??
      (requestBody.selectedVariant != null &&
      (!resolveVariants ||
        !selected ||
        !validateWordInput(selected.lemma) ||
        !matchesWordVariant(selected, requested))
        ? 'The selected variant does not match the word hint.'
        : null)
    if (
      inputError ||
      (resolveVariants && input.length > 120) ||
      !validateWordInput(word)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            inputError ??
            'Invalid word input. Please provide a valid Dutch word.',
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    requested = selected ?? {
      partOfSpeech: variantInput?.partOfSpeech,
      article: variantInput?.article,
    }
    const phrase =
      resolveVariants && (!selected || selected.lemma === normalizeWord(word))
        ? exactPhraseInput(input)
        : null
    if (phrase) {
      requested = { ...requested, lemma: normalizeWord(phrase) }
    }
    const parsedInput = variantInput
      ? {
          dutch_lemma: word,
          article: variantInput.article,
          part_of_speech: variantInput.partOfSpeech,
        }
      : parseWordInput(word)
    const originalWord =
      parsedInput.article && resolveVariants
        ? `${parsedInput.article} ${word}`
        : word
    const normalizedLemma = normalizeWord(parsedInput.dutch_lemma)
    const deNounForm =
      resolveVariants &&
      requested.article === 'de' &&
      requested.partOfSpeech === 'noun' &&
      (!selected || selected.lemma === normalizedLemma)
        ? normalizedLemma
        : undefined
    const findChoices =
      resolveVariants &&
      !selected &&
      !requested.article &&
      (!requested.partOfSpeech || requested.partOfSpeech === 'noun') &&
      !normalizedLemma.includes(' ')
    const findVariantCache = async (target: Partial<WordVariant>) => {
      const match = (entries: Awaited<ReturnType<typeof getCachedVariants>>) =>
        entries.find(
          entry =>
            (!deNounForm || !isPluralOfAnalyzedNoun(deNounForm, entry)) &&
            matchesWordVariant(
              {
                lemma: entry.dutch_lemma,
                partOfSpeech: entry.part_of_speech,
                article:
                  entry.article === 'de' || entry.article === 'het'
                    ? entry.article
                    : undefined,
              },
              target
            )
        )
      const exact = match(
        await getCachedVariants(
          target.lemma ?? normalizedLemma,
          true,
          false,
          phrase
            ? PHRASE_ANALYSIS_CACHE_VERSION
            : CURRENT_ANALYSIS_CACHE_VERSION
        )
      )
      return (
        exact ??
        (phrase
          ? undefined
          : match(await getCachedVariants(normalizedLemma, true, true)))
      )
    }

    console.log('📋 Cache lookup:', {
      originalWord: word,
      normalizedLemma,
      article: parsedInput.article,
      partOfSpeech: parsedInput.part_of_speech,
    })

    // Smart cache lookup strategy
    let cachedAnalysis = null
    let cacheStrategy = 'miss'

    if (!forceRefresh && !findChoices) {
      if (resolveVariants) {
        cachedAnalysis = await findVariantCache(requested)
        cacheStrategy = cachedAnalysis
          ? 'selected_variant_hit'
          : 'selected_variant_miss'
      } else if (parsedInput.article && parsedInput.part_of_speech) {
        // User provided article (e.g., "het haar") - exact semantic search
        cachedAnalysis = await getCachedAnalysis(
          normalizedLemma,
          parsedInput.part_of_speech,
          parsedInput.article
        )
        cacheStrategy = cachedAnalysis ? 'exact_hit' : 'exact_miss'
        console.log('🔍 Exact cache lookup:', cacheStrategy)
      } else {
        // User provided only lemma (e.g., "haar") - check for variants
        const variants = await getCachedVariants(normalizedLemma)
        console.log('🔍 Variants found:', variants.length)

        if (variants.length > 0) {
          // For now, return the most used variant
          // TODO: In future, we could return all variants and let user choose
          cachedAnalysis = variants[0]
          cacheStrategy = 'variant_hit'
        } else {
          cacheStrategy = 'variant_miss'
        }
      }
    }

    const useAnalysisQuota = async () => {
      const quota = await consumeRequestQuotaWithServiceRole(
        authorization.userId,
        'gemini-analysis',
        EDGE_QUOTA_CONFIG.GEMINI_ANALYSIS_LIMIT,
        EDGE_QUOTA_CONFIG.WINDOW_SECONDS
      )
      if (quota.ok) return null
      const headers: Record<string, string> = {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      }
      if (quota.retryAfterSeconds)
        headers['Retry-After'] = String(quota.retryAfterSeconds)
      return new Response(
        JSON.stringify({
          success: false,
          error: quota.message,
          code: quota.code,
        }),
        { status: quota.status, headers }
      )
    }

    if (findChoices) {
      let candidates = await getCachedWordChoices(normalizedLemma)
      if (candidates === null) {
        const denied = await useAnalysisQuota()
        if (denied) return denied
        candidates = await discoverWordVariants(word)
        await saveWordChoices(normalizedLemma, candidates)
      }
      const choices = candidates.filter(choice =>
        matchesWordVariant(choice, requested)
      )
      if (choices.length > 1) {
        return new Response(JSON.stringify({ success: true, choices }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
      if (choices.length === 1) {
        requested = choices[0]
        if (!forceRefresh) {
          cachedAnalysis = await findVariantCache(requested)
          cacheStrategy = cachedAnalysis
            ? 'selected_variant_hit'
            : 'selected_variant_miss'
        }
      }
    }

    if (cachedAnalysis) {
      meta.source = 'cache'
      // Build result from the cache
      const result = {
        dutch_original: originalWord,
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
        register: cachedAnalysis.register,
        expression_type: cachedAnalysis.expression_type,
        tts_url: cachedAnalysis.tts_url,
        synonyms: cachedAnalysis.synonyms || [],
        antonyms: cachedAnalysis.antonyms || [],
        plural: cachedAnalysis.plural,
        conjugation: cachedAnalysis.conjugation,
        preposition: additionalPreposition(
          cachedAnalysis.dutch_lemma,
          cachedAnalysis.preposition
        ),
        analysis_notes: cachedAnalysis.analysis_notes || '',
        usage_notes: cachedAnalysis.usage_notes || null,
        ...(cefrEnabled
          ? {
              cefr: await readAnalysisCefrEstimate(
                cachedAnalysis.cefr_estimate,
                cachedAnalysis
              ),
            }
          : {}),
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
            canonical_reference: getCacheDictionaryReference(cachedAnalysis),
          },
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    const denied = await useAnalysisQuota()
    if (denied) return denied

    const prompt =
      formatWordAnalysisPrompt(word) +
      wordVariantInstruction(
        {
          lemma: requested.lemma,
          article: requested.article,
          partOfSpeech: requested.partOfSpeech,
        },
        deNounForm
      ) +
      (phrase
        ? '\nAnalyze the whole supplied phrase exactly as entered. Keep every word in dutch_lemma. Translate the complete utterance into natural English and Russian, preserving its person, tense, negation and mood. Do not replace it with an infinitive construction.\n'
        : '') +
      (cefrEnabled ? ANALYSIS_CEFR_PROMPT : '')
    meta.source = 'gemini'
    const geminiResponse = await callGeminiAPI(prompt, cefrEnabled)
    if (typeof geminiResponse?.modelVersion === 'string')
      meta.model = geminiResponse.modelVersion
    const analysis = parseGeminiResponse(geminiResponse)
    analysis.preposition = additionalPreposition(
      analysis.dutch_lemma || word,
      analysis.preposition
    )
    if (deNounForm && isPluralOfAnalyzedNoun(deNounForm, analysis)) {
      analysis.dutch_lemma = deNounForm
      analysis.article = 'de'
      analysis.plural = null
    }
    if (
      resolveVariants &&
      (typeof analysis.dutch_lemma !== 'string' ||
        !analysis.dutch_lemma.trim() ||
        !matchesWordVariant(
          {
            lemma: analysis.dutch_lemma,
            partOfSpeech: analysis.part_of_speech,
            article: analysis.article,
          },
          requested
        ))
    )
      throw new Error(
        'Could not analyze the requested word variant. Please try again.'
      )
    assertEnglishTranslation(analysis?.translations)
    assertRussianScript(analysis)

    // Clean and format data
    const cleanedExamples = cleanExamples(analysis.examples)
    const formattedTranslations = formatTranslations(analysis.translations)
    if (!formattedTranslations.ru.some(Boolean)) {
      throw new Error(
        'The analysis did not include a Russian translation. Please try again.'
      )
    }
    const usageNotes = normalizeUsageNotes(analysis.usage_notes)

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
      dutch_original: originalWord,
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
      register: analysis.register || null,
      expression_type: analysis.expression_type,
      tts_url: ttsUrl,
      // New fields from enhanced Gemini prompt
      synonyms: analysis.synonyms || [],
      antonyms: analysis.antonyms || [],
      plural: analysis.plural || null,
      conjugation: analysis.conjugation || null,
      preposition: analysis.preposition || null,
      analysis_notes: analysis.analysis_notes || '',
      usage_notes: usageNotes,
    }
    const cefr = cefrEnabled
      ? await createGeminiCefrEstimate(analysis.cefr, result)
      : null

    // Save the analysis under its canonical lemma for variant-aware requests.
    const cacheData = {
      ...(cefrEnabled ? { cefr_estimate: cefr } : {}),
      dutch_original: resolveVariants ? normalizedLemma : word,
      dutch_lemma: resolveVariants
        ? normalizeWord(result.dutch_lemma)
        : normalizedLemma,
      ...(resolveVariants
        ? {
            cache_version: phrase
              ? PHRASE_ANALYSIS_CACHE_VERSION
              : CURRENT_ANALYSIS_CACHE_VERSION,
          }
        : {}),
      part_of_speech:
        analysis.part_of_speech || (analysis.is_separable ? 'verb' : null),
      is_irregular: analysis.is_irregular || false,
      article: analysis.article,
      register: analysis.register || null,
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
      usage_notes: usageNotes,
    }

    console.log('💾 Saving to cache:', {
      dutch_lemma: cacheData.dutch_lemma,
      part_of_speech: cacheData.part_of_speech,
      article: cacheData.article,
    })

    await saveToCache(cacheData).catch(err => {
      console.error('❌ Cache save failed:', err)
    })

    console.log(`✅ Analysis completed for: "${word}"`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { ...result, ...(cefrEnabled ? { cefr } : {}) },
        meta: {
          ...meta,
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
      error instanceof Error ? error.message : 'Unknown error',
      'Stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    )

    return new Response(
      JSON.stringify({
        success: false,
        meta,
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
