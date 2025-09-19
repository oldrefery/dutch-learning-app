import { useState, useEffect } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection, GeminiWordAnalysis } from '@/types/database'

export const useAddWord = () => {
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null)
  const [showImageSelector, setShowImageSelector] = useState(false)

  const { saveAnalyzedWord, clearError } = useApplicationStore()
  const { collections } = useCollections()

  // Auto-select the first collection if available and none selected
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0])
    }
  }, [collections, selectedCollection])

  const addWord = async (analysisResult: GeminiWordAnalysis) => {
    setIsAdding(true)
    clearError()

    try {
      let targetCollection = selectedCollection

      if (!targetCollection && collections.length === 0) {
        try {
          targetCollection = await useApplicationStore
            .getState()
            .createNewCollection('My Dutch Words')
          setSelectedCollection(targetCollection)
        } catch {
          ToastService.showError(ToastMessageType.CREATE_COLLECTION_FAILED)
          return false
        }
      }

      if (!targetCollection) {
        ToastService.showError(ToastMessageType.NO_COLLECTION_SELECTED)
        return false
      }

      await saveAnalyzedWord(analysisResult, targetCollection.collection_id)
      ToastService.showWordAdded(
        analysisResult.dutch_lemma,
        targetCollection.name
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
