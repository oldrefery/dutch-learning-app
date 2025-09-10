import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { createAudioPlayer, AudioPlayer } from 'expo-audio'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'

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

  // Check if there are words available for review
  const { words } = useAppStore()
  const hasWordsForReview = words.some(word => {
    if (!word.next_review_date) return true
    const today = new Date().toISOString().split('T')[0]
    return word.next_review_date <= today
  })

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
      // Cleanup will be handled by the component unmount
    }
  }, [])

  // Cleanup audio player when component unmounts
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.remove()
      }
    }
  }, [audioPlayer])

  // Start review session when component mounts
  useEffect(() => {
    if (!reviewSession && !reviewLoading && hasWordsForReview) {
      startReviewSession()
    }
  }, [reviewSession, reviewLoading, hasWordsForReview, startReviewSession])

  // Reset card state when word changes
  useEffect(() => {
    setIsFlipped(false)
    setIsScrolling(false)
  }, [currentWord?.word_id])

  const playAudio = useCallback(
    async (url?: string) => {
      if (!audioPlayer || !currentWord?.dutch_lemma) return

      try {
        const audioUrl =
          url ||
          currentWord.tts_url ||
          `https://api.dictionaryapi.dev/api/v2/entries/en/${currentWord.dutch_lemma}`
        audioPlayer.replace({
          uri: audioUrl,
        })
        audioPlayer.play()
      } catch (error) {
        console.error('Failed to play audio:', error)
        ToastService.showError(ToastMessageType.AUDIO_PLAYBACK_FAILED)
      }
    },
    [audioPlayer, currentWord?.dutch_lemma, currentWord?.tts_url]
  )

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
      await markCorrect()
      // Success feedback is handled by the SRS system
    } catch {
      ToastService.showError(ToastMessageType.MARK_INCORRECT_FAILED)
    } finally {
      setIsLoading(false)
    }
  }, [currentWord, markCorrect])

  const handleIncorrect = useCallback(async () => {
    if (!currentWord) return

    setIsLoading(true)
    try {
      await markIncorrect()
      ToastService.showReviewMessage('incorrect')
    } catch {
      ToastService.showError(ToastMessageType.MARK_INCORRECT_FAILED)
    } finally {
      setIsLoading(false)
    }
  }, [currentWord, markIncorrect])

  const handleDeleteWord = useCallback(async () => {
    if (!currentWord) return

    try {
      await deleteWord(currentWord.word_id)
      ToastService.showSuccess(ToastMessageType.WORD_DELETED)
    } catch {
      ToastService.showError(ToastMessageType.DELETE_WORD_FAILED)
    }
  }, [currentWord, deleteWord])

  const handleEndSession = useCallback(() => {
    endReviewSession()
    ToastService.showReviewMessage('complete')
  }, [endReviewSession])

  const handleImageChange = useCallback(
    async (imageUrl: string) => {
      if (!currentWord) return

      try {
        // This would need to be implemented in the store
        // await updateWordImage(currentWord.word_id, imageUrl)
        ToastService.showSuccess(ToastMessageType.IMAGE_UPDATED)
      } catch {
        ToastService.showError(ToastMessageType.UPDATE_IMAGE_FAILED)
      }
    },
    [currentWord]
  )

  const restartSession = useCallback(() => {
    // This would need to be implemented in the store
    // For now, just show a message
    ToastService.showInfo(ToastMessageType.RESTART_SESSION)
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
