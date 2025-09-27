import { useState, useEffect, useCallback, useRef } from 'react'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'

export const useReviewScreen = () => {
  const {
    reviewSession,
    currentWord,
    endReviewSession,
    deleteWord,
    deleteWordFromReview,
    startReviewSession,
    reviewLoading,
    goToNextWord,
    goToPreviousWord,
    updateCurrentWordImage,
  } = useApplicationStore()

  const { playAudio, isPlaying: isPlayingAudio } = useAudioPlayer()
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastTouchTime, setLastTouchTime] = useState(0)
  const isMountedRef = useRef(true)

  // Start review session when component mounts - only once
  useEffect(() => {
    startReviewSession()
  }, [startReviewSession])

  // Cleanup on unmounting
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Reset card state when the word changes
  useEffect(() => {
    setIsFlipped(false)
  }, [currentWord?.word_id])

  const handlePlayAudio = useCallback(
    (url?: string) => {
      if (!currentWord?.dutch_lemma) return
      playAudio(url, currentWord.dutch_lemma, currentWord.tts_url)
    },
    [playAudio, currentWord?.dutch_lemma, currentWord?.tts_url]
  )

  const handleAssessment = useCallback(
    async (assessment: keyof typeof SRS_ASSESSMENT) => {
      if (!currentWord) return

      setIsLoading(true)
      try {
        // Get the store actions
        const store = useApplicationStore.getState()

        // Call submitReviewAssessment directly with the correct assessment
        await store.submitReviewAssessment({
          wordId: currentWord.word_id,
          assessment: SRS_ASSESSMENT[assessment],
          timestamp: new Date(),
        })

        // No toast for 'again' - it's a normal retry, not an error
      } catch (error) {
        console.error('Assessment error:', error)
        ToastService.show('Failed to submit assessment', ToastType.ERROR)
      } finally {
        // Check if the component is still mounted before updating the state
        try {
          setIsLoading(false)
        } catch (stateError) {
          console.warn('Component unmounted during assessment:', stateError)
        }
      }
    },
    [currentWord]
  )

  const handleAgain = useCallback(
    () => handleAssessment('AGAIN'),
    [handleAssessment]
  )
  const handleHard = useCallback(
    () => handleAssessment('HARD'),
    [handleAssessment]
  )
  const handleGood = useCallback(
    () => handleAssessment('GOOD'),
    [handleAssessment]
  )
  const handleEasy = useCallback(
    () => handleAssessment('EASY'),
    [handleAssessment]
  )

  // Keep old functions for compatibility
  const handleCorrect = handleGood
  const handleIncorrect = handleAgain

  const handleDeleteWord = useCallback(async () => {
    if (!currentWord) return

    try {
      // Delete word from the database and global state
      await deleteWord(currentWord.word_id)

      deleteWordFromReview(currentWord.word_id)

      setIsFlipped(false)

      ToastService.show('Word deleted', ToastType.SUCCESS)
    } catch {
      ToastService.show('Failed to delete word', ToastType.ERROR)
    }
  }, [currentWord, deleteWord, deleteWordFromReview])

  const handleEndSession = useCallback(() => {
    endReviewSession()
    ToastService.show('Great job! Review session finished.', ToastType.SUCCESS)
  }, [endReviewSession])

  const handleImageChange = useCallback(
    async (imageUrl: string) => {
      if (!currentWord) return

      try {
        const store = useApplicationStore.getState()
        // Update in database
        await store.updateWordImage(currentWord.word_id, imageUrl)
        // Update in the current review session
        updateCurrentWordImage(imageUrl)
        ToastService.show('Image updated', ToastType.SUCCESS)
      } catch {
        ToastService.show('Failed to update image', ToastType.ERROR)
      }
    },
    [currentWord, updateCurrentWordImage]
  )

  const restartSession = useCallback(() => {
    // TODO: Implement restartSession in store
    // For now, just show a message
    ToastService.show(
      'Session restart functionality coming soon',
      ToastType.INFO
    )
  }, [])

  // Simple flip function for external use
  const handleFlipCard = useCallback(() => {
    if (isMountedRef.current) {
      const now = Date.now()
      if (now - lastTouchTime < 300) {
        console.log('❌ Prevented double flip')
        return
      }
      setLastTouchTime(now)
      setIsFlipped(prev => !prev)
      console.log('✅ Card flipped')
    }
  }, [lastTouchTime])

  const reviewWords = reviewSession?.words || []
  const currentIndex = reviewSession?.currentIndex || 0
  const totalWords = reviewWords.length
  const currentWordNumber = currentIndex + 1
  const sessionComplete = currentIndex >= reviewWords.length && !currentWord

  return {
    // State from useReviewSession compatibility
    reviewSession,
    currentWord,
    currentIndex,
    sessionComplete,
    reviewWords,
    totalWords,
    currentWordNumber,
    isLoading: isLoading || reviewLoading,

    // useReviewScreen specific state
    isFlipped,
    isPlayingAudio,

    // Actions
    playAudio: handlePlayAudio,
    handleCorrect,
    handleIncorrect,
    handleAgain,
    handleHard,
    handleGood,
    handleEasy,
    handleDeleteWord,
    handleEndSession,
    handleImageChange,
    restartSession,
    handleFlipCard,
    goToNextWord,
    goToPreviousWord,
  }
}
