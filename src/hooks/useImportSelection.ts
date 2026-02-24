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
import { Sentry } from '@/lib/sentry'

interface ImportHandledError {
  message?: string
  userMessage?: string
  sentryHandled?: boolean
}

const isSentryHandledError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === 'object' &&
    (error as ImportHandledError).sentryHandled
  )

const getImportErrorMessage = (
  fallbackMessage: string,
  error?: unknown
): string => {
  if (error && typeof error === 'object') {
    const importError = error as ImportHandledError
    if (
      typeof importError.userMessage === 'string' &&
      importError.userMessage.trim() !== ''
    ) {
      return importError.userMessage
    }

    if (typeof importError.message === 'string' && importError.message !== '') {
      return importError.message
    }
  }

  return fallbackMessage
}

const normalizeLemma = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim().toLowerCase() : ''

const normalizePartOfSpeech = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim() : 'unknown'

const normalizeArticle = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim() : ''

const getSemanticWordKey = (
  dutchLemma?: string | null,
  partOfSpeech?: string | null,
  article?: string | null
): string =>
  `${normalizeLemma(dutchLemma)}|${normalizePartOfSpeech(partOfSpeech)}|${normalizeArticle(article)}`

const getWordLabel = (count: number): string => `word${count !== 1 ? 's' : ''}`

const getDuplicateLabel = (count: number): string =>
  `duplicate${count !== 1 ? 's' : ''}`

const getImportSuccessMessage = (
  selectedCount: number,
  importedCount: number
): string => {
  const skippedCount = Math.max(selectedCount - importedCount, 0)

  if (importedCount === 0) {
    return 'No new words were imported. Selected words already exist in your collection.'
  }

  if (skippedCount > 0) {
    return `Successfully imported ${importedCount} ${getWordLabel(importedCount)}. Skipped ${skippedCount} ${getDuplicateLabel(skippedCount)}.`
  }

  return `Successfully imported ${importedCount} ${getWordLabel(importedCount)}`
}

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
      Sentry.captureException(err, {
        tags: { operation: 'loadCollections' },
        extra: { message: 'Failed to load collections' },
      })
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

        const collectionNameById = new Map(
          storeCollections.map(collection => [
            collection.collection_id,
            collection.name,
          ])
        )
        const existingWordKeys = new Set<string>()
        const existingWordCollectionByKey = new Map<
          string,
          string | undefined
        >()

        existingWords.forEach(existingWord => {
          const key = getSemanticWordKey(
            existingWord.dutch_lemma,
            existingWord.part_of_speech,
            existingWord.article
          )
          existingWordKeys.add(key)
          if (!existingWordCollectionByKey.has(key)) {
            existingWordCollectionByKey.set(
              key,
              existingWord.collection_id
                ? collectionNameById.get(existingWord.collection_id)
                : undefined
            )
          }
        })

        const selections: WordSelectionItem[] = words.map(word => {
          const semanticKey = getSemanticWordKey(
            word.dutch_lemma,
            word.part_of_speech,
            word.article
          )
          const existingInCollectionName =
            existingWordCollectionByKey.get(semanticKey)
          const isDuplicate = existingWordKeys.has(semanticKey)

          return {
            word,
            selected: !isDuplicate,
            isDuplicate,
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
      Sentry.captureException(err, {
        tags: { operation: 'loadSharedCollection' },
        extra: { message: 'Failed to load shared collection', token },
      })
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
      Sentry.captureException(err, {
        tags: { operation: 'checkAuthAndLoad' },
        extra: { message: 'Auth check failed', token },
      })
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
      const wordsBeforeImport = useApplicationStore.getState().words.length
      const success = await addWordsToCollection(
        targetCollectionId,
        selectedWords,
        true // isImportFromShared - use RPC to bypass RLS
      )

      if (success) {
        const wordsAfterImport = useApplicationStore.getState().words.length
        const importedCount = Math.max(wordsAfterImport - wordsBeforeImport, 0)
        ToastService.show(
          getImportSuccessMessage(selectedWords.length, importedCount),
          ToastType.SUCCESS
        )
        if (importedCount > 0) {
          router.replace(ROUTES.TABS.ROOT)
        }
      } else {
        const storeError = useApplicationStore.getState().error
        const importErrorMessage =
          typeof storeError?.details === 'string'
            ? storeError.details
            : 'Some words could not be imported'

        ToastService.show(importErrorMessage, ToastType.ERROR)
      }
    } catch (error) {
      if (!isSentryHandledError(error)) {
        Sentry.captureException(
          error instanceof Error ? error : new Error('Import failed'),
          {
            tags: { operation: 'handleImport' },
            extra: {
              message: 'Import failed',
              targetCollectionId,
              selectedWordsCount: selectedWords.length,
            },
          }
        )
      }

      ToastService.show(
        getImportErrorMessage(
          'Failed to import words. Please try again.',
          error
        ),
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
