'use client'

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
import { getEdgeFunctionErrorMessage } from './edge-errors'

const IMAGE_PAGE_SIZE = 6

export const analyzeWordWithAi = async (
  word: string,
  forceRefresh = false
): Promise<WordAnalysisResult> => {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'gemini-handler',
    {
      body: { word, forceRefresh },
    }
  )

  if (error) {
    throw new Error(
      await getEdgeFunctionErrorMessage(
        error,
        'Could not analyze this word. Please try again.'
      )
    )
  }

  return parseAnalysisFunctionResponse(data)
}

export const findWordImages = async (
  analysis: WordAnalysis,
  offset = 0
): Promise<WordImageOption[]> => {
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
