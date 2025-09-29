import { useState, useEffect, useCallback } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { collectionSharingService } from '@/services/collectionSharingService'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { ROUTES, RouteHelpers } from '@/constants/Routes'
import type { Word } from '@/types/database'
import type { SharedCollectionWords } from '@/services/collectionSharingService'
import { Sentry } from '@/lib/sentry.ts'

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
  const [hideDuplicates, setHideDuplicates] = useState(true) // Hide duplicates by default

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
      Sentry.captureException('Failed to load collections:', err)
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
        // Get existing words and collections from the store to check duplicates
        const { words: existingWords, collections: storeCollections } =
          useApplicationStore.getState()

        const selections: WordSelectionItem[] = words.map(word => {
          const existingWord = existingWords.find(
            existing =>
              existing.dutch_lemma.toLowerCase() ===
                word.dutch_lemma.toLowerCase() &&
              (existing.part_of_speech || 'unknown') ===
                (word.part_of_speech || 'unknown') &&
              (existing.article || '') === (word.article || '')
          )

          // Find collection name by ID
          let existingInCollectionName: string | undefined
          if (existingWord?.collection_id) {
            const collection = storeCollections.find(
              c => c.collection_id === existingWord.collection_id
            )
            existingInCollectionName = collection?.name
          }

          return {
            word,
            selected: !existingWord,
            isDuplicate: !!existingWord,
            existingInCollection: existingInCollectionName,
          }
        })

        setWordSelections(selections)
      } catch {
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
      setError('Failed to load shared collection. Please try again.')
      Sentry.captureException('Failed to load shared collection:', err)
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
        const currentUrl = ROUTES.IMPORT_COLLECTION(token)
        router.replace(RouteHelpers.createAuthRedirect(currentUrl))
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
      Sentry.captureException('Auth check failed:', err)
      const currentUrl = ROUTES.IMPORT_COLLECTION(token)
      router.replace(RouteHelpers.createAuthRedirect(currentUrl))
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
      const { addWordsToCollection } = useApplicationStore.getState()
      const success = await addWordsToCollection(
        targetCollectionId,
        selectedWords
      )

      if (success) {
        ToastService.show(
          `Successfully imported ${selectedWords.length} word${selectedWords.length !== 1 ? 's' : ''}`,
          ToastType.SUCCESS
        )
        router.replace(ROUTES.TABS.ROOT)
      } else {
        ToastService.show('Some words could not be imported', ToastType.ERROR)
      }
    } catch (error) {
      Sentry.captureException('Import failed:', error)
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

  const toggleHideDuplicates = () => {
    setHideDuplicates(prev => !prev)
  }

  useEffect(() => {
    void checkAuthAndLoad()
  }, [checkAuthAndLoad])

  const selectedCount = wordSelections.filter(item => item.selected).length
  const duplicateCount = wordSelections.filter(item => item.isDuplicate).length
  const availableWords = wordSelections.filter(item => !item.isDuplicate)
  const allAvailableSelected = availableWords.every(item => item.selected)

  // Filter words based on the hideDuplicates setting
  const filteredWordSelections = hideDuplicates
    ? wordSelections.filter(item => !item.isDuplicate)
    : wordSelections

  return {
    loading,
    sharedData,
    error,
    wordSelections: filteredWordSelections,
    collections,
    targetCollectionId,
    importing,
    selectedCount,
    duplicateCount,
    allAvailableSelected,
    hideDuplicates,
    setTargetCollectionId,
    toggleWordSelection,
    toggleSelectAll,
    toggleHideDuplicates,
    handleImport,
    handleGoBack,
  }
}
