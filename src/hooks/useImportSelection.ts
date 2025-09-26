import { useState, useEffect, useCallback } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { collectionSharingService } from '@/services/collectionSharingService'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import type { Word } from '@/types/database'
import type { SharedCollectionWords } from '@/services/collectionSharingService'

interface WordSelectionItem {
  word: Omit<
    Word,
    | 'user_id'
    | 'easiness_factor'
    | 'interval_days'
    | 'repetition_count'
    | 'next_review_date'
    | 'last_reviewed_at'
  >
  selected: boolean
  isDuplicate: boolean
  existingInCollection?: string
}

interface Collection {
  collection_id: string
  name: string
}

export function useImportSelection(token: string) {
  const [loading, setLoading] = useState(true)
  const [sharedData, setSharedData] = useState<SharedCollectionWords | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [wordSelections, setWordSelections] = useState<WordSelectionItem[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(
    null
  )
  const [importing, setImporting] = useState(false)

  const loadCollections = useCallback(async () => {
    try {
      const { fetchCollections, collections: storeCollections } =
        useApplicationStore.getState()
      await fetchCollections()
      const collectionsData = storeCollections.map(c => ({
        collection_id: c.collection_id,
        name: c.name,
      }))
      setCollections(collectionsData)
      if (collectionsData.length > 0) {
        setTargetCollectionId(collectionsData[0].collection_id)
      }
    } catch (err) {
      console.error('Failed to load collections:', err)
    }
  }, [])

  const checkForDuplicates = useCallback(
    async (
      words: Omit<
        Word,
        | 'user_id'
        | 'easiness_factor'
        | 'interval_days'
        | 'repetition_count'
        | 'next_review_date'
        | 'last_reviewed_at'
      >[]
    ) => {
      try {
        // Get existing words from the store to check duplicates
        const { words: existingWords } = useApplicationStore.getState()

        const selections: WordSelectionItem[] = words.map(word => {
          const existingWord = existingWords.find(
            existing =>
              existing.dutch_lemma.toLowerCase() ===
                word.dutch_lemma.toLowerCase() &&
              (existing.part_of_speech || 'unknown') ===
                (word.part_of_speech || 'unknown') &&
              (existing.article || '') === (word.article || '')
          )

          return {
            word,
            selected: !existingWord,
            isDuplicate: !!existingWord,
            existingInCollection: existingWord?.collection_id || undefined,
          }
        })

        setWordSelections(selections)
      } catch (err) {
        const selections: WordSelectionItem[] = words.map(word => ({
          word,
          selected: true,
          isDuplicate: false,
        }))
        setWordSelections(selections)
      }
    },
    []
  )

  const loadSharedCollection = useCallback(async () => {
    try {
      const result =
        await collectionSharingService.getSharedCollectionWords(token)

      if (!result.success) {
        setError(getErrorMessage(result.error))
        setLoading(false)
        return
      }

      setSharedData(result.data)
      await checkForDuplicates(result.data.words)
      setError(null)
    } catch (err) {
      console.error('Failed to load shared collection:', err)
      setError('Failed to load shared collection. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [token, checkForDuplicates])

  const checkAuthAndLoad = useCallback(async () => {
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      if (authError || !session) {
        const currentUrl = `/import/${token}`
        router.replace(
          `/(auth)/login?redirect=${encodeURIComponent(currentUrl)}`
        )
        return
      }

      if (!token) {
        setError('Invalid import link')
        setLoading(false)
        return
      }

      await loadSharedCollection()
      await loadCollections()
    } catch (err) {
      console.error('Auth check failed:', err)
      const currentUrl = `/import/${token}`
      router.replace(`/(auth)/login?redirect=${encodeURIComponent(currentUrl)}`)
    }
  }, [token, loadSharedCollection, loadCollections])

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'COLLECTION_NOT_FOUND':
        return 'This collection no longer exists or the share link has expired.'
      case 'COLLECTION_NOT_SHARED':
        return 'This collection is no longer being shared publicly.'
      case 'DATABASE_ERROR':
        return 'Server error occurred while loading the collection. Please try again.'
      case 'UNAUTHORIZED':
        return 'Access denied. You may need to sign in or the share link might be invalid.'
      default:
        return 'Unable to load the shared collection. Please check your internet connection.'
    }
  }

  const toggleWordSelection = (wordId: string) => {
    setWordSelections(prev =>
      prev.map(item =>
        item.word.word_id === wordId && !item.isDuplicate
          ? { ...item, selected: !item.selected }
          : item
      )
    )
  }

  const toggleSelectAll = () => {
    const availableWords = wordSelections.filter(item => !item.isDuplicate)
    const allAvailableSelected = availableWords.every(item => item.selected)

    setWordSelections(prev =>
      prev.map(item =>
        item.isDuplicate ? item : { ...item, selected: !allAvailableSelected }
      )
    )
  }

  const handleImport = async () => {
    if (!sharedData || !targetCollectionId) {
      ToastService.show('Please select a collection first', ToastType.ERROR)
      return
    }

    const selectedWords = wordSelections
      .filter(item => item.selected && !item.isDuplicate)
      .map(item => item.word)

    if (selectedWords.length === 0) {
      ToastService.show(
        'Please select at least one word to import',
        ToastType.ERROR
      )
      return
    }

    setImporting(true)

    try {
      const { addNewWord } = useApplicationStore.getState()
      const results = await Promise.all(
        selectedWords.map(word => addNewWord(word, targetCollectionId))
      )

      const successCount = results.filter(result => result.success).length

      if (successCount === selectedWords.length) {
        ToastService.show(
          `Successfully imported ${successCount} word${successCount !== 1 ? 's' : ''}`,
          ToastType.SUCCESS
        )
        router.replace('/(tabs)/')
      } else {
        ToastService.show('Some words could not be imported', ToastType.ERROR)
      }
    } catch (error) {
      console.error('Import failed:', error)
      ToastService.show(
        'Failed to import words. Please try again.',
        ToastType.ERROR
      )
    } finally {
      setImporting(false)
    }
  }

  const handleGoBack = () => {
    router.back()
  }

  useEffect(() => {
    void checkAuthAndLoad()
  }, [checkAuthAndLoad])

  const selectedCount = wordSelections.filter(item => item.selected).length
  const duplicateCount = wordSelections.filter(item => item.isDuplicate).length
  const availableWords = wordSelections.filter(item => !item.isDuplicate)
  const allAvailableSelected = availableWords.every(item => item.selected)

  return {
    loading,
    sharedData,
    error,
    wordSelections,
    collections,
    targetCollectionId,
    importing,
    selectedCount,
    duplicateCount,
    allAvailableSelected,
    setTargetCollectionId,
    toggleWordSelection,
    toggleSelectAll,
    handleImport,
    handleGoBack,
  }
}
