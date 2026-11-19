'use client'

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

export const analyzeWordWithAi = async (
  userId: string,
  word: string,
  forceRefresh = false,
  mode: AnalysisMode = 'single'
): Promise<WordAnalysisResult> => {
  await requireWordAnalysisAccess(userId)
  const supabase = createClient()
  let data: unknown
  try {
    const response = await supabase.functions.invoke<unknown>(
      'gemini-handler',
      {
        body: { word, forceRefresh },
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
