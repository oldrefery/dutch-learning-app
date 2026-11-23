import { useRef, useState } from 'react'
import {
  parseWordVariantInput,
  readWordVariant,
  readWordVariantChoices,
  type WordVariant,
  type WordVariantChoice,
} from '@woordenaar/domain'
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

const handleWordAnalysisError = (error: unknown): string => {
  if (isAppError(error)) {
    showAppErrorToast(error)
    return error.userMessage
  }

  if (error instanceof Error) {
    const message = error.message || 'Could not analyze word. Please try again.'
    ToastService.show(message, ToastType.ERROR)
    return message
  }

  const message = 'An unexpected error occurred. Please try again.'
  ToastService.show(message, ToastType.ERROR)
  return message
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
  const requestId = useRef(0)
  const [choices, setChoices] = useState<WordVariantChoice[]>([])
  const [selectedVariant, setSelectedVariant] = useState<WordVariant>()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const [analysisMetadata, setAnalysisMetadata] =
    useState<AnalysisMetadata | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const analyzeWord = async (
    inputWord: string,
    forceRefresh = false,
    choice?: WordVariant
  ) => {
    if (!inputWord.trim()) {
      ToastService.show('Please enter a Dutch word', ToastType.ERROR)
      return
    }

    const normalizedWord = inputWord.trim().toLowerCase()
    const requested = parseWordVariantInput(normalizedWord)
    if (requested.error) {
      setAnalysisError(handleWordAnalysisError(new Error(requested.error)))
      return
    }

    const selected = choice ?? (forceRefresh ? selectedVariant : undefined)
    if (choice) setSelectedVariant(choice)
    const currentRequest = ++requestId.current

    // Clear previous results before starting new analysis
    // This prevents useEffect from triggering duplicate check prematurely
    setAnalysisResult(null)
    setAnalysisMetadata(null)
    setAnalysisError(null)

    setIsAnalyzing(true)

    try {
      // Analyze the word - now with retry logic and proper error handling
      const response = await wordService.analyzeWord(normalizedWord, {
        forceRefresh,
        resolveVariants: true,
        selectedVariant: selected,
      })
      if (currentRequest !== requestId.current) return
      if (response?.choices !== undefined) {
        const nextChoices = readWordVariantChoices(response.choices)
        if (nextChoices.length < 2)
          throw new Error('The word choices were incomplete. Please try again.')
        setChoices(nextChoices)
        return
      }

      // Validate response structure
      if (!response || !response.data) {
        setAnalysisError(
          handleWordAnalysisError(
            new Error('Invalid response from word analysis')
          )
        )
        return
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
        register: analysis.register || undefined,
        analysis_notes: analysis.analysis_notes || '',
        usage_notes: analysis.usage_notes || null,
      }

      setChoices([])
      setSelectedVariant(
        readWordVariant({
          lemma: result.dutch_lemma,
          partOfSpeech: result.part_of_speech,
          article: result.article,
        }) ?? selected
      )
      setAnalysisResult(result)

      // Add to word analysis history (not added yet)
      useHistoryStore.getState().addAnalyzedWord(
        requested.word,
        result.dutch_lemma
        // No collection name - word was only analyzed, not added
      )

      applyAnalysisMetadata(response.meta, setAnalysisMetadata)
    } catch (error: unknown) {
      if (currentRequest === requestId.current)
        setAnalysisError(handleWordAnalysisError(error))
    } finally {
      if (currentRequest === requestId.current) setIsAnalyzing(false)
    }
  }

  const clearAnalysis = () => {
    requestId.current += 1
    setIsAnalyzing(false)
    setChoices([])
    setSelectedVariant(undefined)
    setAnalysisResult(null)
    setAnalysisMetadata(null)
    setAnalysisError(null)
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
    choices,
    analysisResult,
    analysisMetadata,
    analysisError,
    analyzeWord,
    clearAnalysis,
    forceRefreshAnalysis,
    updateImageUrl,
  }
}
