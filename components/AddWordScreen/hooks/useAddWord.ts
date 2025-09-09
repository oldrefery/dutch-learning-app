import { useState, useEffect } from 'react'
import Toast from 'react-native-toast-message'
import { useAppStore } from '@/stores/useAppStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection } from '@/types/database'

export const useAddWord = () => {
  const [isAdding, setIsAdding] = useState(false)
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null)
  const [showImageSelector, setShowImageSelector] = useState(false)

  const { addNewWord, clearError } = useAppStore()
  const { collections } = useCollections()

  // Auto-select first collection if available and none selected
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0])
    }
  }, [collections, selectedCollection])

  const addWord = async (analysisResult: any) => {
    if (!selectedCollection) {
      Toast.show({
        type: 'error',
        text1: 'No Collection Selected',
        text2: 'Please select a collection to add the word to',
      })
      return
    }

    setIsAdding(true)
    clearError()

    try {
      await addNewWord(analysisResult, selectedCollection.collection_id)
      Toast.show({
        type: 'success',
        text1: 'Word Added!',
        text2: `"${analysisResult.dutch_lemma}" has been added to "${selectedCollection.name}"`,
      })
      return true
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error Adding Word',
        text2: error.message || 'Could not add word. Please try again.',
      })
      return false
    } finally {
      setIsAdding(false)
    }
  }

  const handleImageChange = (newImageUrl: string) => {
    // This will be handled by the parent component
    return newImageUrl
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
