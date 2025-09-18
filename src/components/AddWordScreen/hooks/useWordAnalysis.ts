import { useState } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import { wordService } from '@/lib/supabase'
import type { AnalysisResult } from '../types/AddWordTypes'

export const useWordAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const analyzeWord = async (inputWord: string) => {
    if (!inputWord.trim()) {
      ToastService.showError(
        ToastMessageType.ANALYSIS_FAILED,
        'Please enter a Dutch word'
      )
      return
    }

    const normalizedWord = inputWord.trim().toLowerCase()
    setIsAnalyzing(true)

    try {
      // Only analyze the word, don't add it yet
      // Convert to lowercase before sending to analysis
      const analysis = await wordService.analyzeWord(normalizedWord)

      // Convert to display format
      const result: AnalysisResult = {
        dutch_lemma: analysis.dutch_lemma,
        part_of_speech: analysis.part_of_speech || 'unknown',
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
      }

      setAnalysisResult(result)
      ToastService.showSuccess(ToastMessageType.WORD_ANALYZED)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Analysis failed'
      ToastService.showError(ToastMessageType.ANALYSIS_FAILED, errorMessage)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearAnalysis = () => {
    setAnalysisResult(null)
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
    analyzeWord,
    clearAnalysis,
    updateImageUrl,
  }
}
