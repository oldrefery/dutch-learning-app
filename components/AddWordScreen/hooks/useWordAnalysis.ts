import { useState } from 'react'
import Toast from 'react-native-toast-message'
import { wordService } from '@/lib/supabase'
import { useAppStore } from '@/stores/useAppStore'
import type { AnalysisResult } from '../types/AddWordTypes'

export const useWordAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const { currentUserId } = useAppStore()

  const analyzeWord = async (inputWord: string) => {
    if (!inputWord.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a Dutch word',
      })
      return
    }

    const normalizedWord = inputWord.trim().toLowerCase()

    // Check if word already exists before analysis
    if (currentUserId) {
      try {
        const existingWord = await wordService.checkWordExists(
          currentUserId,
          normalizedWord
        )
        if (existingWord) {
          Toast.show({
            type: 'info',
            text1: 'Word Already Exists',
            text2: `"${existingWord.dutch_lemma}" is already in your collection`,
          })
          return
        }
      } catch (error) {
        console.error('Error checking word existence:', error)
        // Continue with analysis if check fails
      }
    }

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
      }

      setAnalysisResult(result)
      Toast.show({
        type: 'success',
        text1: 'Analysis Complete',
        text2: 'Word has been analyzed successfully',
      })
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Analysis Failed',
        text2: error.message || 'Could not analyze word. Please try again.',
      })
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
