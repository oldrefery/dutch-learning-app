import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { createAudioPlayer, AudioPlayer } from 'expo-audio'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import {
  Gesture,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

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
    goToNextWord,
    goToPreviousWord,
  } = useAppStore()

  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastTouchTime, setLastTouchTime] = useState(0)
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
      // Cleanup handled by component unmount
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

  const handleCorrect = useCallback(async () => {
    if (!currentWord) return

    setIsLoading(true)
    try {
      await markCorrect()
      // Success feedback handled by SRS system
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
        // TODO: Implement updateWordImage in store
        // await updateWordImage(currentWord.word_id, imageUrl)
        ToastService.showSuccess(ToastMessageType.IMAGE_UPDATED)
      } catch {
        ToastService.showError(ToastMessageType.UPDATE_IMAGE_FAILED)
      }
    },
    [currentWord]
  )

  const restartSession = useCallback(() => {
    // TODO: Implement restartSession in store
    // For now, just show a message
    ToastService.showInfo(ToastMessageType.RESTART_SESSION)
  }, [])

  // Create tap gesture for card flip
  const tapGesture = useCallback(() => {
    return Gesture.Tap()
      .maxDuration(200) // Very short tap duration
      .maxDistance(5) // Very small movement allowed
      .onEnd(() => {
        'worklet'
        if (!isScrolling) {
          const now = Date.now()
          if (now - lastTouchTime < 300) return // Prevent double tap

          runOnJS(setLastTouchTime)(now)
          runOnJS(flipCard)()
          runOnJS(setIsFlipped)(!isFlipped)
        }
      })
  }, [isScrolling, lastTouchTime, flipCard, isFlipped])

  // Create double tap gesture for word detail
  const doubleTapGesture = useCallback(() => {
    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(400)
      .maxDistance(10)
      .onEnd(() => {
        'worklet'
        if (!isScrolling) {
          // This will be handled by the parent component
          // We'll pass a callback function
        }
      })
  }, [isScrolling])

  // Create pan gesture for swipe navigation
  const panGesture = useCallback(() => {
    return Gesture.Pan()
      .minDistance(20) // Minimum distance to start pan (higher than tap maxDistance)
      .onEnd((event: PanGestureHandlerEventPayload) => {
        'worklet'
        const swipeThreshold = 50

        // Only handle navigation if it's a significant swipe
        if (Math.abs(event.translationX) > swipeThreshold) {
          if (event.translationX < -swipeThreshold) {
            // Swipe left - go to next word
            runOnJS(goToNextWord)()
          } else if (event.translationX > swipeThreshold) {
            // Swipe right - go to previous word
            runOnJS(goToPreviousWord)()
          }
        }
      })
      .enabled(!isFlipped) // Only enable swiping on front side
  }, [isFlipped, goToNextWord, goToPreviousWord])

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
    handleCorrect,
    handleIncorrect,
    handleDeleteWord,
    handleEndSession,
    handleImageChange,
    restartSession,
    tapGesture,
    doubleTapGesture,
    panGesture,
  }
}
