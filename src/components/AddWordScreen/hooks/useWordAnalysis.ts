import { useState } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { wordService } from '@/lib/supabase'
import type { AnalysisResult, AnalysisMetadata } from '../types/AddWordTypes'
import type { AppError } from '@/types/ErrorTypes'
import { ErrorCategory } from '@/types/ErrorTypes'
import { useHistoryStore } from '@/stores/useHistoryStore'

const isAppError = (error: unknown): error is AppError =>
  typeof error === 'object' &&
  error !== null &&
  'category' in error &&
  'userMessage' in error

const showAppErrorToast = (appError: AppError) => {
  switch (appError.category) {
    case ErrorCategory.NETWORK:
      ToastService.show('🌐 ' + appError.userMessage, ToastType.ERROR)
      return
    case ErrorCategory.SERVER:
      ToastService.show('⚠️ ' + appError.userMessage, ToastType.ERROR)
      return
    case ErrorCategory.CLIENT:
    case ErrorCategory.VALIDATION:
      ToastService.show('ℹ️ ' + appError.userMessage, ToastType.INFO)
      return
    default:
      ToastService.show(appError.userMessage, ToastType.ERROR)
  }
}

const handleWordAnalysisError = (error: unknown) => {
  if (isAppError(error)) {
    showAppErrorToast(error)
    return
  }

  if (error instanceof Error) {
    ToastService.show(
      error.message || 'Could not analyze word. Please try again.',
      ToastType.ERROR
    )
    return
  }

  ToastService.show(
    'An unexpected error occurred. Please try again.',
    ToastType.ERROR
  )
}

const applyAnalysisMetadata = (
  metadata: AnalysisMetadata | undefined,
  setAnalysisMetadata: (value: AnalysisMetadata | null) => void
) => {
  if (!metadata) {
    setAnalysisMetadata({ source: 'gemini' })
    ToastService.show('Word analyzed successfully', ToastType.SUCCESS)
    return
  }

  setAnalysisMetadata(metadata)

  if (metadata.cache_hit) {
    ToastService.show(
      `Word loaded from cache (used ${metadata.usage_count} times)`,
      ToastType.INFO
    )
    return
  }

  ToastService.show('Word analyzed with fresh AI', ToastType.SUCCESS)
}

export const useWordAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const [analysisMetadata, setAnalysisMetadata] =
    useState<AnalysisMetadata | null>(null)
  const analyzeWord = async (
    inputWord: string,
    forceRefresh: boolean = false
  ) => {
    if (!inputWord.trim()) {
      ToastService.show('Please enter a Dutch word', ToastType.ERROR)
      return
    }

    const normalizedWord = inputWord.trim().toLowerCase()

    // Clear previous results before starting new analysis
    // This prevents useEffect from triggering duplicate check prematurely
    setAnalysisResult(null)
    setAnalysisMetadata(null)

    setIsAnalyzing(true)

    try {
      // Analyze the word - now with retry logic and proper error handling
      const response = await wordService.analyzeWord(normalizedWord, {
        forceRefresh,
      })

      // Validate response structure
      if (!response || !response.data) {
        throw new Error('Invalid response from word analysis')
      }

      const analysis = response.data

      // Convert to display format
      const result: AnalysisResult = {
        dutch_lemma: analysis.dutch_lemma,
        part_of_speech:
          analysis.part_of_speech ||
          (analysis.is_separable ? 'verb' : 'unknown'),
        is_irregular: analysis.is_irregular,
        article: analysis.article || undefined,
        is_reflexive: analysis.is_reflexive || false,
        is_expression: analysis.is_expression || false,
        expression_type: analysis.expression_type || undefined,
        is_separable: analysis.is_separable || false,
        prefix_part: analysis.prefix_part || undefined,
        root_verb: analysis.root_verb || undefined,
        translations: analysis.translations,
        examples: analysis.examples || [],
        tts_url: analysis.tts_url || undefined,
        image_url: analysis.image_url || undefined,
        // Enhanced fields from the new Gemini prompt
        synonyms: analysis.synonyms || [],
        antonyms: analysis.antonyms || [],
        plural: analysis.plural || undefined,
        conjugation: analysis.conjugation || null,
        preposition: analysis.preposition || undefined,
        analysis_notes: analysis.analysis_notes || '',
      }

      setAnalysisResult(result)

      // Add to word analysis history (not added yet)
      useHistoryStore.getState().addAnalyzedWord(
        normalizedWord,
        result.dutch_lemma
        // No collection name - word was only analyzed, not added
      )

      applyAnalysisMetadata(response.meta, setAnalysisMetadata)
    } catch (error: unknown) {
      handleWordAnalysisError(error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearAnalysis = () => {
    setAnalysisResult(null)
    setAnalysisMetadata(null)
  }

  const forceRefreshAnalysis = async (inputWord: string) => {
    await analyzeWord(inputWord, true)
  }

  const updateImageUrl = (newImageUrl: string) => {
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        image_url: newImageUrl,
      })
    }
  }

  return {
    isAnalyzing,
    analysisResult,
    analysisMetadata,
    analyzeWord,
    clearAnalysis,
    forceRefreshAnalysis,
    updateImageUrl,
  }
}
