import { useState, useEffect } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection, GeminiWordAnalysis } from '@/types/database'

export const useAddWord = (preselectedCollectionId?: string) => {
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null)
  const [showImageSelector, setShowImageSelector] = useState(false)

  const { saveAnalyzedWord, clearError } = useApplicationStore()
  const { collections } = useCollections()

  // Auto-select a preselected collection or first collection if available and none selected
  // Also re-select if current selection is no longer valid (e.g., collection was deleted)
  useEffect(() => {
    if (collections.length === 0) {
      // No collections available - clear selection
      if (selectedCollection) {
        setSelectedCollection(null)
      }
      return
    }

    // Check if currently selected collection is still valid
    const isCurrentCollectionValid =
      selectedCollection &&
      collections.some(
        c => c.collection_id === selectedCollection.collection_id
      )

    // If no collection selected OR current selection is invalid
    if (!selectedCollection || !isCurrentCollectionValid) {
      // Try to select preselected collection first
      if (preselectedCollectionId) {
        const preselectedCollection = collections.find(
          c => c.collection_id === preselectedCollectionId
        )
        if (preselectedCollection) {
          setSelectedCollection(preselectedCollection)
          return
        }
      }
      // Otherwise select first available collection
      setSelectedCollection(collections[0])
    }
  }, [collections, selectedCollection, preselectedCollectionId])

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
          ToastService.show(
            'Failed to create collection. Please try again.',
            ToastType.ERROR
          )
          return false
        }
      }

      if (!targetCollection) {
        ToastService.show(
          'Please select a collection to add the word to',
          ToastType.ERROR
        )
        return false
      }

      await saveAnalyzedWord(analysisResult, targetCollection.collection_id)
      ToastService.show(
        `"${analysisResult.dutch_lemma}" added to "${targetCollection.name}"`,
        ToastType.SUCCESS
      )
      return true
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Could not add word. Please try again.'
      ToastService.show(errorMessage, ToastType.ERROR)
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
