import { useState } from 'react'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { ROUTES } from '@/constants/Routes'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word, Collection } from '@/types/database'
import { Sentry } from '@/lib/sentry.ts'

export function useCollectionDetail(collectionId: string) {
  const [refreshing, setRefreshing] = useState(false)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [wordToMove, setWordToMove] = useState<string | null>(null)
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuWord, setContextMenuWord] = useState<Word | null>(null)

  const {
    words,
    collections,
    fetchWords,
    fetchCollections,
    deleteWord,
    updateWordImage,
    moveWordToCollection,
    resetWordProgress,
    shareCollection,
    getCollectionShareStatus,
    unshareCollection,
  } = useApplicationStore()

  const collection = collections.find(c => c.collection_id === collectionId)

  const collectionWords = words
    .filter(word => word.collection_id === collectionId)
    .sort((a, b) => {
      const wordA = a.dutch_lemma.toLowerCase()
      const wordB = b.dutch_lemma.toLowerCase()
      return wordA.localeCompare(wordB)
    })

  const stats = {
    totalWords: collectionWords.length,
    masteredWords: collectionWords.filter(w => w.repetition_count > 2).length,
    wordsForReview: collectionWords.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    newWords: collectionWords.filter(w => w.repetition_count === 0).length,
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchWords(), fetchCollections()])
    } catch {
      ToastService.show('Failed to refresh data', ToastType.ERROR)
    } finally {
      setRefreshing(false)
    }
  }

  const handleWordPress = (word: Word) => {
    setSelectedWord(word)
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setSelectedWord(null)
  }

  const handleStartReview = () => {
    if (stats.wordsForReview === 0) {
      ToastService.show(
        'No words are due for review in this collection',
        ToastType.INFO
      )
      return
    }
    router.push(ROUTES.TABS.REVIEW)
  }

  const handleDeleteWord = async (wordId: string) => {
    try {
      await deleteWord(wordId)
      ToastService.show('Word deleted', ToastType.SUCCESS)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not delete word'
      ToastService.show(errorMessage, ToastType.ERROR)
    }
  }

  const handleDeleteSelectedWord = async () => {
    if (selectedWord) {
      await handleDeleteWord(selectedWord.word_id)
      setModalVisible(false)
      setSelectedWord(null)
    }
  }

  const handleImageChange = async (imageUrl: string) => {
    if (!selectedWord) return
    try {
      await updateWordImage(selectedWord.word_id, imageUrl)
      setSelectedWord({ ...selectedWord, image_url: imageUrl })
      ToastService.show('Image updated', ToastType.SUCCESS)
    } catch {
      ToastService.show('Failed to update image', ToastType.ERROR)
    }
  }

  const handleCopyCode = async () => {
    if (!collection?.collection_id) {
      return
    }

    setIsSharing(true)
    try {
      const shareStatus = await getCollectionShareStatus(
        collection.collection_id
      )
      if (shareStatus?.share_token) {
        await Clipboard.setStringAsync(shareStatus.share_token)
        ToastService.show('Collection code copied!', ToastType.SUCCESS)
      } else {
        ToastService.show('No share code available', ToastType.ERROR)
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'handleCopyCode' },
        extra: {
          message: 'Failed to copy code',
          collectionId: collection?.collection_id,
        },
      })
      ToastService.show('Failed to copy collection code', ToastType.ERROR)
    } finally {
      setIsSharing(false)
    }
  }

  const handleShareCollection = async () => {
    if (!collection?.collection_id) {
      return
    }

    setIsSharing(true)
    try {
      const shareToken = await shareCollection(collection.collection_id)

      if (!shareToken) {
        ToastService.show('Failed to share collection', ToastType.ERROR)

        return
      }

      ToastService.show('Collection shared successfully', ToastType.SUCCESS)
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'handleShareCollection' },
        extra: {
          message: 'Unexpected error',
          collectionId: collection?.collection_id,
        },
      })
      ToastService.show('Failed to share collection', ToastType.ERROR)
    } finally {
      setIsSharing(false)
    }
  }

  const handleStopSharing = async () => {
    if (!collection?.collection_id) {
      return
    }

    setIsSharing(true)
    try {
      const success = await unshareCollection(collection.collection_id)
      if (success) {
        ToastService.show('Collection sharing stopped', ToastType.SUCCESS)
      } else {
        ToastService.show('Failed to stop sharing collection', ToastType.ERROR)
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'handleStopSharing' },
        extra: {
          message: 'Failed to stop sharing',
          collectionId: collection?.collection_id,
        },
      })
      ToastService.show('Failed to stop sharing collection', ToastType.ERROR)
    } finally {
      setIsSharing(false)
    }
  }

  const handleMoveToCollection = (wordId: string) => {
    setWordToMove(wordId)
    setMoveModalVisible(true)
  }

  const handleCloseMoveModal = () => {
    setMoveModalVisible(false)
    setWordToMove(null)
  }

  const handleSelectTargetCollection = async (targetCollection: Collection) => {
    if (!wordToMove) return

    try {
      await moveWordToCollection(wordToMove, targetCollection.collection_id)
      ToastService.show(
        `Word moved to "${targetCollection.name}"`,
        ToastType.SUCCESS
      )
      handleCloseMoveModal()
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Could not move word to collection'
      ToastService.show(errorMessage, ToastType.ERROR)
    }
  }

  const handleWordLongPress = (word: Word) => {
    setContextMenuWord(word)
    setContextMenuVisible(true)
  }

  const handleCloseContextMenu = () => {
    setContextMenuVisible(false)
    setContextMenuWord(null)
  }

  const handleResetWordFromContextMenu = async () => {
    if (!contextMenuWord) return

    try {
      await resetWordProgress(contextMenuWord.word_id)
      ToastService.show('Word progress reset', ToastType.SUCCESS)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not reset word progress'
      ToastService.show(errorMessage, ToastType.ERROR)
    }
  }

  const handleMoveFromContextMenu = () => {
    if (!contextMenuWord) return
    handleMoveToCollection(contextMenuWord.word_id)
  }

  const handleDeleteFromContextMenu = async () => {
    if (!contextMenuWord) return
    await handleDeleteWord(contextMenuWord.word_id)
  }

  return {
    // State
    collection,
    collectionWords,
    stats,
    refreshing,
    selectedWord,
    modalVisible,
    isSharing,
    moveModalVisible,
    wordToMove,
    contextMenuVisible,
    contextMenuWord,
    collections,
    words,

    // Actions
    handleRefresh,
    handleWordPress,
    handleCloseModal,
    handleStartReview,
    handleDeleteWord,
    handleDeleteSelectedWord,
    handleImageChange,
    handleCopyCode,
    handleShareCollection,
    handleStopSharing,
    handleMoveToCollection,
    handleCloseMoveModal,
    handleSelectTargetCollection,
    handleWordLongPress,
    handleCloseContextMenu,
    handleResetWordFromContextMenu,
    handleMoveFromContextMenu,
    handleDeleteFromContextMenu,

    // Setters for external use
    setSelectedWord,
  }
}
