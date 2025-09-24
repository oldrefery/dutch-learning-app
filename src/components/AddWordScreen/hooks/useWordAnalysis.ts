import { useState } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { wordService } from '@/lib/supabase'
import type { AnalysisResult, AnalysisMetadata } from '../types/AddWordTypes'

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
    setIsAnalyzing(true)

    try {
      // Only analyze the word, don't add it yet
      // Convert to lowercase before sending to analysis
      const response = await wordService.analyzeWord(normalizedWord, {
        forceRefresh,
      })
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Could not analyze word. Please try again.'
      ToastService.show(errorMessage, ToastType.ERROR)
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
