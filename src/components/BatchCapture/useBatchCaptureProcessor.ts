import { useCallback, useRef } from 'react'
import { useRouter } from 'expo-router'
import { ROUTES } from '@/constants/Routes'
import { wordService } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useBatchCaptureStore } from '@/stores/useBatchCaptureStore'
import { ErrorCategory, type AppError } from '@/types/ErrorTypes'
import type { BatchCaptureItem } from '@/types/BatchCaptureTypes'
import type { Collection } from '@/types/database'

const OFFLINE_MESSAGE = 'Waiting for an internet connection.'

const isNetworkError = (error: unknown): error is AppError =>
  typeof error === 'object' &&
  error !== null &&
  'category' in error &&
  (error as { category?: unknown }).category === ErrorCategory.NETWORK

const getErrorMessage = (error: unknown): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'userMessage' in error &&
    typeof (error as { userMessage?: unknown }).userMessage === 'string'
  ) {
    return (error as { userMessage: string }).userMessage
  }
  return error instanceof Error
    ? error.message
    : 'Could not prepare this item for analysis.'
}

interface UseBatchCaptureProcessorOptions {
  currentUserId: string | null
  isConnected: boolean | null
  collections: Collection[]
  targetCollectionId: string | null
}

export const useBatchCaptureProcessor = ({
  currentUserId,
  isConnected,
  collections,
  targetCollectionId,
}: UseBatchCaptureProcessorOptions) => {
  const router = useRouter()
  const processingRef = useRef(false)

  const openReview = useCallback(
    (item: BatchCaptureItem) => {
      useBatchCaptureStore.getState().setItemStatus(item.id, 'analyzing')
      router.replace({
        pathname: ROUTES.TABS.ADD_WORD,
        params: {
          batchItemId: item.id,
          initialWord: item.dutchText,
          ...(item.translationHint
            ? { translationHint: item.translationHint }
            : {}),
          ...(targetCollectionId ? { collectionId: targetCollectionId } : {}),
        },
      })
    },
    [router, targetCollectionId]
  )

  const setDuplicate = useCallback(
    (
      item: BatchCaptureItem,
      duplicate: {
        word_id: string
        collection_id: string | null
      }
    ) => {
      const collectionName =
        collections.find(
          collection => collection.collection_id === duplicate.collection_id
        )?.name ?? null
      useBatchCaptureStore.getState().setPossibleDuplicate(item.id, {
        wordId: duplicate.word_id,
        collectionId: duplicate.collection_id,
        collectionName,
      })
    },
    [collections]
  )

  const processItem = useCallback(
    async (item: BatchCaptureItem) => {
      if (!currentUserId || processingRef.current) return

      const batchStore = useBatchCaptureStore.getState()
      if (isConnected !== true) {
        batchStore.setItemStatus(item.id, 'queued', OFFLINE_MESSAGE)
        return
      }

      processingRef.current = true
      batchStore.setItemStatus(item.id, 'checking_duplicate')

      try {
        const normalizedLemma = item.dutchText.trim().toLowerCase()
        const localMatch = useApplicationStore
          .getState()
          .words.find(
            word => word.dutch_lemma.trim().toLowerCase() === normalizedLemma
          )

        if (localMatch) {
          setDuplicate(item, localMatch)
          return
        }

        const remoteMatch = await wordService.findWordByLemma(
          currentUserId,
          item.dutchText
        )
        if (remoteMatch) {
          setDuplicate(item, remoteMatch)
          return
        }

        openReview(item)
      } catch (error: unknown) {
        if (isNetworkError(error)) {
          batchStore.setItemStatus(item.id, 'queued', OFFLINE_MESSAGE)
          return
        }
        batchStore.setItemStatus(item.id, 'failed', getErrorMessage(error))
        batchStore.pause()
      } finally {
        processingRef.current = false
      }
    },
    [currentUserId, isConnected, openReview, setDuplicate]
  )

  return { openReview, processItem }
}
