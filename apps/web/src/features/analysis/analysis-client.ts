'use client'

import {
  readWordVariantChoices,
  type WordVariant,
  type WordVariantChoice,
} from '@woordenaar/domain'
import { requireWordAnalysisAccess, requireLegacyWordAnalysis } from './actions'
import { createClient } from '@/lib/supabase/client'
import {
  parseAnalysisFunctionResponse,
  parseImageFunctionResponse,
} from './analysis-contract'
import type {
  WordAnalysis,
  WordAnalysisResult,
  WordImageOption,
} from './analysis-contract'
import { reportAnalysisFailure, type AnalysisMode } from './analysis-telemetry'
import {
  getEdgeFunctionErrorMessage,
  readEdgeFunctionError,
} from './edge-errors'
import { recordAnalysisHistory } from '@/features/history/analysis-history'

const IMAGE_PAGE_SIZE = 6

const invokeWordAnalysis = async (
  userId: string,
  word: string,
  forceRefresh = false,
  mode: AnalysisMode = 'single',
  variantRequest?: { resolveVariants: true; selectedVariant?: WordVariant }
): Promise<unknown> => {
  await requireWordAnalysisAccess(userId)
  const supabase = createClient()
  let data: unknown
  try {
    const response = await supabase.functions.invoke<unknown>(
      'gemini-handler',
      {
        body: { word, forceRefresh, ...variantRequest },
      }
    )
    if (response.error) throw response.error
    data = response.data
  } catch (error) {
    const detail = await readEdgeFunctionError(
      error,
      'Could not analyze this word. Please try again.'
    )
    const failure = new Error(detail.message)
    reportAnalysisFailure(mode, 'invoke', failure, detail.meta, detail.status)
    throw failure
  }

  return data
}

const readAnalysis = (
  userId: string,
  word: string,
  mode: AnalysisMode,
  data: unknown
): WordAnalysisResult => {
  let result: WordAnalysisResult
  try {
    result = parseAnalysisFunctionResponse(data)
  } catch (error) {
    const meta =
      typeof data === 'object' && data !== null && 'meta' in data
        ? data.meta
        : undefined
    reportAnalysisFailure(mode, 'response', error, meta)
    throw error
  }
  recordAnalysisHistory(userId, word, result)
  return result
}

export const analyzeWordWithAi = async (
  userId: string,
  word: string,
  forceRefresh = false,
  mode: AnalysisMode = 'single'
): Promise<WordAnalysisResult> =>
  readAnalysis(
    userId,
    word,
    mode,
    await invokeWordAnalysis(userId, word, forceRefresh, mode)
  )

export const analyzeWordVariant = async (
  userId: string,
  word: string,
  forceRefresh: boolean,
  selectedVariant?: WordVariant
): Promise<
  | ({ kind: 'analysis' } & WordAnalysisResult)
  | { kind: 'choices'; choices: WordVariantChoice[] }
> => {
  const data = await invokeWordAnalysis(userId, word, forceRefresh, 'single', {
    resolveVariants: true,
    selectedVariant,
  })
  if (typeof data === 'object' && data !== null && 'choices' in data) {
    const choices = readWordVariantChoices(data.choices)
    if (choices.length < 2)
      throw new Error('The word choices were incomplete. Please try again.')
    return { kind: 'choices', choices }
  }
  return { kind: 'analysis', ...readAnalysis(userId, word, 'single', data) }
}

export const findWordImages = async (
  analysis: WordAnalysis,
  offset = 0,
  forNewWord = false
): Promise<WordImageOption[]> => {
  if (forNewWord) await requireWordAnalysisAccess()
  else await requireLegacyWordAnalysis()
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'get-multiple-images',
    {
      body: {
        englishTranslation: analysis.translations.en[0],
        partOfSpeech: analysis.partOfSpeech,
        examples: analysis.examples.map(example => ({
          nl: example.nl,
          en: example.en,
          ...(example.ru ? { ru: example.ru } : {}),
        })),
        count: IMAGE_PAGE_SIZE,
        offset,
      },
    }
  )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'Could not load image options. Please try again.'
      )
    )
  }

  return parseImageFunctionResponse(data)
}

export const getNextImageOffset = (currentOffset: number) =>
  currentOffset + IMAGE_PAGE_SIZE
