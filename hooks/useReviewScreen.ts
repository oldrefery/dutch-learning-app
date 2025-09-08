import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { createAudioPlayer, AudioPlayer } from 'expo-audio'
import { Toast } from 'react-native-toast-message/lib/src/Toast'

export const useReviewScreen = () => {
  const {
    reviewSession,
    currentWord,
    flipCard,
    markCorrect,
    markIncorrect,
    endReviewSession,
    deleteWord,
    startReviewSession,
    reviewLoading,
  } = useAppStore()

  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastTouchTime, setLastTouchTime] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)

  // Initialize audio player
  useEffect(() => {
    const initAudio = async () => {
      try {
        const player = await createAudioPlayer()
        setAudioPlayer(player)
      } catch (error) {
        console.error('Failed to initialize audio player:', error)
      }
    }

    initAudio()

    return () => {
      if (audioPlayer) {
        audioPlayer.unloadAsync()
      }
    }
  }, [])

  // Start review session when component mounts
  useEffect(() => {
    if (!reviewSession && !reviewLoading && hasWordsForReview) {
      startReviewSession()
    }
  }, [reviewSession, reviewLoading, hasWordsForReview, startReviewSession])

  // Check if there are words available for review
  const { words } = useAppStore()
  const hasWordsForReview = words.some(word => {
    if (!word.next_review_date) return true
    const today = new Date().toISOString().split('T')[0]
    return word.next_review_date <= today
  })

  // Reset card state when word changes
  useEffect(() => {
    setIsFlipped(false)
    setIsScrolling(false)
  }, [currentWord?.word_id])

  const playAudio = useCallback(async () => {
    if (!audioPlayer || !currentWord?.dutch_lemma) return

    try {
      await audioPlayer.unloadAsync()
      await audioPlayer.loadAsync({
        uri: `https://api.dictionaryapi.dev/api/v2/entries/en/${currentWord.dutch_lemma}`,
      })
      await audioPlayer.playAsync()
    } catch (error) {
      console.error('Failed to play audio:', error)
      Toast.show({
        type: 'error',
        text1: 'Audio Error',
        text2: 'Could not play pronunciation',
      })
    }
  }, [audioPlayer, currentWord?.dutch_lemma])

  const handleCardPress = useCallback(() => {
    if (isScrolling) return

    const now = Date.now()
    if (now - lastTouchTime < 300) return // Prevent double tap

    setLastTouchTime(now)
    flipCard()
    setIsFlipped(!isFlipped)
  }, [isScrolling, lastTouchTime, flipCard, isFlipped])

  const handleTouchStart = useCallback((event: any) => {
    setTouchStartY(event.nativeEvent.pageY)
    setIsScrolling(false)
  }, [])

  const handleTouchMove = useCallback(
    (event: any) => {
      const currentY = event.nativeEvent.pageY
      const deltaY = Math.abs(currentY - touchStartY)

      if (deltaY > 10) {
        setIsScrolling(true)
      }
    },
    [touchStartY]
  )

  const handleCorrect = useCallback(async () => {
    if (!currentWord) return

    setIsLoading(true)
    try {
      await markCorrect(currentWord.word_id)
      Toast.show({
        type: 'success',
        text1: 'Correct!',
        text2: 'Well done!',
      })
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark as correct',
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentWord, markCorrect])

  const handleIncorrect = useCallback(async () => {
    if (!currentWord) return

    setIsLoading(true)
    try {
      await markIncorrect(currentWord.word_id)
      Toast.show({
        type: 'info',
        text1: 'Incorrect',
        text2: 'Keep practicing!',
      })
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to mark as incorrect',
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentWord, markIncorrect])

  const handleDeleteWord = useCallback(async () => {
    if (!currentWord) return

    try {
      await deleteWord(currentWord.word_id)
      Toast.show({
        type: 'success',
        text1: 'Word Deleted',
        text2: 'Word has been removed from collection',
      })
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete word',
      })
    }
  }, [currentWord, deleteWord])

  const handleEndSession = useCallback(() => {
    endReviewSession()
    Toast.show({
      type: 'success',
      text1: 'Session Complete',
      text2: 'Great job! Review session finished.',
    })
  }, [endReviewSession])

  const handleImageChange = useCallback(
    async (imageUrl: string) => {
      if (!currentWord) return

      try {
        // This would need to be implemented in the store
        // await updateWordImage(currentWord.word_id, imageUrl)
        Toast.show({
          type: 'success',
          text1: 'Image Updated',
          text2: 'Word image has been changed',
        })
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to update image',
        })
      }
    },
    [currentWord]
  )

  const restartSession = useCallback(() => {
    // This would need to be implemented in the store
    // For now, just show a message
    Toast.show({
      type: 'info',
      text1: 'Restart',
      text2: 'Session restart functionality coming soon',
    })
  }, [])

  return {
    // State
    reviewSession,
    currentWord,
    isFlipped,
    isLoading: isLoading || (reviewLoading && hasWordsForReview),
    audioPlayer,
    hasWordsForReview,

    // Actions
    playAudio,
    handleCardPress,
    handleTouchStart,
    handleTouchMove,
    handleCorrect,
    handleIncorrect,
    handleDeleteWord,
    handleEndSession,
    handleImageChange,
    restartSession,
  }
}
