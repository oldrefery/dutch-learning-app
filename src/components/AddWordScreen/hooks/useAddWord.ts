import { useState, useEffect } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import { useAppStore } from '@/stores/useAppStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection, GeminiWordAnalysis } from '@/types/database'

export const useAddWord = () => {
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null)
  const [showImageSelector, setShowImageSelector] = useState(false)

  const { saveAnalyzedWord, clearError } = useAppStore()
  const { collections } = useCollections()

  // Auto-select the first collection if available and none selected
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0])
    }
  }, [collections, selectedCollection])

  const addWord = async (analysisResult: GeminiWordAnalysis) => {
    if (!selectedCollection) {
      ToastService.showError(ToastMessageType.NO_COLLECTION_SELECTED)
      return
    }

    setIsAdding(true)
    clearError()

    try {
      await saveAnalyzedWord(analysisResult, selectedCollection.collection_id)
      ToastService.showWordAdded(
        analysisResult.dutch_lemma,
        selectedCollection.name
      )
      return true
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add word'
      ToastService.showWordError(errorMessage)
      return false
    } finally {
      setIsAdding(false)
    }
  }

  const openImageSelector = () => {
    setShowImageSelector(true)
  }

  const closeImageSelector = () => {
    setShowImageSelector(false)
  }

  return {
    isAdding,
    selectedCollection,
    setSelectedCollection,
    showImageSelector,
    addWord,
    openImageSelector,
    closeImageSelector,
  }
}
