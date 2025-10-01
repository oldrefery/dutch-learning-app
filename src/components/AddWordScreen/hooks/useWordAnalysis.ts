import { useState } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { wordService } from '@/lib/supabase'
import type { AnalysisResult, AnalysisMetadata } from '../types/AddWordTypes'
import type { AppError } from '@/types/ErrorTypes'
import { ErrorCategory } from '@/types/ErrorTypes'

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

      // Extract metadata from response
      if (response.meta) {
        setAnalysisMetadata(response.meta)

        // Show cache-specific toast messages
        if (response.meta.cache_hit) {
          ToastService.show(
            `Word loaded from cache (used ${response.meta.usage_count} times)`,
            ToastType.INFO
          )
        } else {
          ToastService.show('Word analyzed with fresh AI', ToastType.SUCCESS)
        }
      } else {
        // Fallback for responses without metadata
        setAnalysisMetadata({ source: 'gemini' })
        ToastService.show('Word analyzed successfully', ToastType.SUCCESS)
      }
    } catch (error: unknown) {
      // Handle categorized errors with user-friendly messages
      if (
        typeof error === 'object' &&
        error !== null &&
        'category' in error &&
        'userMessage' in error
      ) {
        const appError = error as AppError

        // Show user-friendly message based on error category
        let toastType: ToastType
        switch (appError.category) {
          case ErrorCategory.NETWORK:
            toastType = ToastType.ERROR
            ToastService.show('🌐 ' + appError.userMessage, toastType)
            break
          case ErrorCategory.SERVER:
            toastType = ToastType.ERROR
            ToastService.show('⚠️ ' + appError.userMessage, toastType)
            break
          case ErrorCategory.CLIENT:
          case ErrorCategory.VALIDATION:
            toastType = ToastType.INFO
            ToastService.show('ℹ️ ' + appError.userMessage, toastType)
            break
          default:
            toastType = ToastType.ERROR
            ToastService.show(appError.userMessage, toastType)
        }
      } else if (error instanceof Error) {
        // Fallback for non-categorized errors
        ToastService.show(
          error.message || 'Could not analyze word. Please try again.',
          ToastType.ERROR
        )
      } else {
        // Unknown error type
        ToastService.show(
          'An unexpected error occurred. Please try again.',
          ToastType.ERROR
        )
      }
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
