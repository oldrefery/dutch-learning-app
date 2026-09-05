import { useState, useEffect, useCallback, useRef } from 'react'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection, GeminiWordAnalysis } from '@/types/database'

/**
 * Resolves which collection to select based on priority:
 * preselected (route param) > last used (persisted) > first available.
 * Returns null if no valid collection found.
 */
function resolveCollection(
  collections: Collection[],
  lastId: string | null,
  preselectedId?: string
): Collection | null {
  if (preselectedId) {
    const preselected = collections.find(c => c.collection_id === preselectedId)
    if (preselected) return preselected
  }

  if (lastId) {
    const lastUsed = collections.find(c => c.collection_id === lastId)
    if (lastUsed) return lastUsed
  }

  return collections[0] ?? null
}

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

  const lastSelectedCollectionId = useSettingsStore(
    state => state.lastSelectedCollectionId
  )
  const isCurrentValid =
    selectedCollection &&
    collections.some(
      collection =>
        collection.collection_id === selectedCollection.collection_id
    )
  if (isSettingsHydrated && !isCurrentValid) {
    const resolved = resolveCollection(
      collections,
      lastSelectedCollectionId,
      preselectedCollectionId
    )
    const nextCollection = resolved
    if (selectedCollection !== nextCollection)
      setSelectedCollection(nextCollection)
  }

  const hadSelectionRef = useRef(false)

  // Persist the resolved selection to the external settings store.
  useEffect(() => {
    if (!isSettingsHydrated) return
    if (selectedCollection) hadSelectionRef.current = true
    if (!hadSelectionRef.current) return
    const selectedId = selectedCollection?.collection_id ?? null
    if (selectedId !== lastSelectedCollectionId) {
      useSettingsStore.getState().setLastSelectedCollectionId(selectedId)
    }
  }, [isSettingsHydrated, selectedCollection, lastSelectedCollectionId])

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

      const savedWord = await saveAnalyzedWord(
        analysisResult,
        targetCollection.collection_id
      )
      ToastService.show(
        `"${savedWord.dutch_lemma}" added to "${targetCollection.name}"`,
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
