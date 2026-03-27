import { useState, useEffect, useCallback } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection, GeminiWordAnalysis } from '@/types/database'

export const useAddWord = (preselectedCollectionId?: string) => {
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null)
  const [showImageSelector, setShowImageSelector] = useState(false)
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(
    useSettingsStore.persist.hasHydrated()
  )

  const { saveAnalyzedWord, clearError } = useApplicationStore()
  const { collections } = useCollections()

  // Wait for settings store hydration from AsyncStorage
  useEffect(() => {
    if (isSettingsHydrated) return
    return useSettingsStore.persist.onFinishHydration(() => {
      setIsSettingsHydrated(true)
    })
  }, [isSettingsHydrated])

  const selectCollection = useCallback((collection: Collection | null) => {
    setSelectedCollection(collection)
    useSettingsStore
      .getState()
      .setLastSelectedCollectionId(collection?.collection_id ?? null)
  }, [])

  // Auto-select collection: preselected > last used > first available
  // Also re-select if the current selection is no longer valid (e.g., collection was deleted)
  useEffect(() => {
    if (!isSettingsHydrated) return

    if (collections.length === 0) {
      if (selectedCollection) {
        selectCollection(null)
      }
      return
    }

    const isCurrentCollectionValid =
      selectedCollection &&
      collections.some(
        c => c.collection_id === selectedCollection.collection_id
      )

    if (!selectedCollection || !isCurrentCollectionValid) {
      // Priority 1: preselected from route params
      if (preselectedCollectionId) {
        const preselected = collections.find(
          c => c.collection_id === preselectedCollectionId
        )
        if (preselected) {
          selectCollection(preselected)
          return
        }
      }
      // Priority 2: last used collection (persisted via AsyncStorage)
      const lastId = useSettingsStore.getState().lastSelectedCollectionId
      if (lastId) {
        const lastUsed = collections.find(c => c.collection_id === lastId)
        if (lastUsed) {
          setSelectedCollection(lastUsed)
          return
        }
        // Stale reference — collection was deleted, clear persisted ID
        useSettingsStore.getState().setLastSelectedCollectionId(null)
      }
      // Priority 3: first available
      selectCollection(collections[0])
    }
  }, [
    collections,
    selectedCollection,
    preselectedCollectionId,
    selectCollection,
    isSettingsHydrated,
  ])

  const addWord = async (analysisResult: GeminiWordAnalysis) => {
    setIsAdding(true)
    clearError()

    try {
      let targetCollection = selectedCollection

      if (!targetCollection && collections.length === 0) {
        try {
          targetCollection = await useApplicationStore
            .getState()
            .createNewCollection('My Words')
          selectCollection(targetCollection)
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
    selectCollection,
    showImageSelector,
    addWord,
    openImageSelector,
    closeImageSelector,
  }
}
