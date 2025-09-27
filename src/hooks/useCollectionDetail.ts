import { useState } from 'react'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { ROUTES } from '@/constants/Routes'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'

export function useCollectionDetail(collectionId: string) {
  const [refreshing, setRefreshing] = useState(false)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const {
    words,
    collections,
    fetchWords,
    fetchCollections,
    deleteWord,
    updateWordImage,
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
      console.log('❌ [handleCopyCode] No collection or collection_id')
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
      console.error('❌ [handleCopyCode] Failed to copy code:', error)
      ToastService.show('Failed to copy collection code', ToastType.ERROR)
    } finally {
      setIsSharing(false)
    }
  }

  const handleShareCollection = async () => {
    if (!collection?.collection_id) {
      console.log('❌ [handleShareCollection] No collection or collection_id')
      return
    }

    setIsSharing(true)
    try {
      const shareToken = await shareCollection(collection.collection_id)
      console.log('📥 [handleShareCollection] shareCollection result', {
        shareToken,
      })

      if (!shareToken) {
        console.log('❌ [handleShareCollection] No share token returned')
        ToastService.show('Failed to share collection', ToastType.ERROR)
        return
      }

      ToastService.show('Collection shared successfully', ToastType.SUCCESS)
    } catch (error) {
      console.error('❌ [handleShareCollection] Unexpected error:', error)
      ToastService.show('Failed to share collection', ToastType.ERROR)
    } finally {
      console.log(
        '🔄 [handleShareCollection] Finishing action, setting isSharing to false'
      )
      setIsSharing(false)
    }
  }

  const handleStopSharing = async () => {
    if (!collection?.collection_id) {
      console.log('❌ [handleStopSharing] No collection or collection_id')
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
      console.error('❌ [handleStopSharing] Failed to stop sharing:', error)
      ToastService.show('Failed to stop sharing collection', ToastType.ERROR)
    } finally {
      setIsSharing(false)
    }
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

    // Setters for external use
    setSelectedWord,
  }
}
