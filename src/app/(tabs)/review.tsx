import React, { useRef, useState, useCallback, useMemo } from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { useFocusEffect } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import WordDetailModal from '@/components/WordDetailModal'
import { CardFront } from '@/components/ReviewCard/CardFront'
import {
  UniversalWordCard,
  WordCardPresets,
} from '@/components/UniversalWordCard'
import { GlassHeader } from '@/components/glass/GlassHeader'
import { GestureErrorBoundary } from '@/components/GestureErrorBoundary'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import { useImageSelector } from '@/hooks/useImageSelector'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sentry } from '@/lib/sentry'
import { useReviewWordsCount } from '@/hooks/useReviewWordsCount'

export default function ReviewScreen() {
  const insets = useSafeAreaInsets()
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pronunciationRef = useRef<View>(null)

  const {
    // State
    currentWord,
    sessionComplete,
    reviewWords,
    isLoading,
    totalWords,
    currentWordNumber,
    isFlipped,
    isPlayingAudio,
    // Actions
    playAudio,
    handleAgain,
    handleHard,
    handleGood,
    handleEasy,
    handleDeleteWord,
    handleImageChange,
    restartSession,
    handleFlipCard,
    goToNextWord,
    goToPreviousWord,
  } = useReviewScreen()

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()

  // Get startReviewSession from the store
  const startReviewSession = useApplicationStore(
    state => state.startReviewSession
  )

  // Enable pull-to-refresh to also refresh review count (badge)
  const { refreshCount } = useReviewWordsCount()

  // Auto-fetch review words when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Only auto-fetch if there are no words or the session is complete
      if (reviewWords.length === 0 || sessionComplete) {
        startReviewSession()
      }
    }, [reviewWords.length, sessionComplete, startReviewSession])
  )

  const handleWordPress = useCallback(() => {
    if (currentWord) {
      setSelectedWord(currentWord)
      setModalVisible(true)
    }
  }, [currentWord])

  const handleCloseModal = useCallback(() => {
    setModalVisible(false)
    setSelectedWord(null)
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([refreshCount(), startReviewSession()])
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'refreshReviewSession' },
        extra: { message: 'Error refreshing review session' },
      })
    } finally {
      setRefreshing(false)
    }
  }, [refreshCount, startReviewSession])

  // Create completely stable gestures to prevent recreation
  const tapGestureInstance = useMemo(() => {
    return Gesture.Tap()
      .maxDuration(200)
      .maxDistance(5)
      .onBegin(() => {
        'worklet'
      })
      .onEnd(() => {
        'worklet'
        scheduleOnRN(handleFlipCard)
      })
  }, [handleFlipCard]) // Only depend on handleFlipCard

  const panGestureInstance = useMemo(() => {
    return Gesture.Pan()
      .minDistance(20)
      .onEnd(event => {
        'worklet'
        const swipeThreshold = 50
        if (Math.abs(event.translationX) > swipeThreshold) {
          if (event.translationX < -swipeThreshold) {
            scheduleOnRN(goToNextWord)
          } else if (event.translationX > swipeThreshold) {
            scheduleOnRN(goToPreviousWord)
          }
        }
      })
  }, [goToNextWord, goToPreviousWord]) // Only depend on navigation functions

  const doubleTapGestureInstance = useMemo(() => {
    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(400)
      .maxDistance(10)
      .onEnd(() => {
        'worklet'
        scheduleOnRN(handleWordPress)
      })
  }, [handleWordPress])

  const renderCard = useCallback(() => {
    if (!currentWord) {
      return null
    }

    try {
      // Combine all stable gestures
      const combinedGesture = Gesture.Exclusive(
        panGestureInstance,
        Gesture.Simultaneous(tapGestureInstance, doubleTapGestureInstance)
      )

      return (
        <GestureErrorBoundary>
          <GestureDetector gesture={combinedGesture}>
            <ViewThemed style={reviewScreenStyles.flashcard}>
              {!isFlipped ? (
                <CardFront
                  currentWord={currentWord}
                  isPlayingAudio={isPlayingAudio}
                  onPlayPronunciation={playAudio}
                  pronunciationRef={pronunciationRef}
                />
              ) : (
                <>
                  <GlassHeader title={currentWord.dutch_lemma} />
                  <UniversalWordCard
                    word={currentWord}
                    config={WordCardPresets.review.config}
                    actions={{
                      ...WordCardPresets.review.actions,
                      onDelete: handleDeleteWord,
                    }}
                    isPlayingAudio={isPlayingAudio}
                    onPlayPronunciation={playAudio}
                    onChangeImage={openImageSelector}
                    style={reviewScreenStyles.universalWordCard}
                    contentStyle={{ paddingTop: 64 }}
                  />
                </>
              )}
            </ViewThemed>
          </GestureDetector>
        </GestureErrorBoundary>
      )
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'renderReviewCard' },
        extra: { message: 'Error rendering card' },
      })

      return (
        <ViewThemed style={reviewScreenStyles.flashcard}>
          <TextThemed>Error rendering card</TextThemed>
        </ViewThemed>
      )
    }
  }, [
    currentWord,
    isFlipped,
    isPlayingAudio,
    playAudio,
    handleDeleteWord,
    openImageSelector,
    tapGestureInstance,
    panGestureInstance,
    doubleTapGestureInstance,
  ])

  // Check if we should show the empty state first
  if (reviewWords.length === 0 && !isLoading) {
    return (
      <ViewThemed style={reviewScreenStyles.container}>
        <ScrollView
          contentContainerStyle={reviewScreenStyles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary.DEFAULT]}
              tintColor={Colors.primary.DEFAULT}
            />
          }
        >
          <TextThemed
            style={reviewScreenStyles.emptyText}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            No words to review! 🎉
          </TextThemed>
          <TextThemed
            style={reviewScreenStyles.emptySubtext}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            All your words are scheduled for future review. Pull to refresh or
            add new words to practice.
          </TextThemed>
        </ScrollView>
      </ViewThemed>
    )
  }

  if (isLoading) {
    return (
      <ViewThemed style={reviewScreenStyles.container}>
        <ViewThemed style={reviewScreenStyles.loadingContainer}>
          <ActivityIndicator
            size="large"
            // color={REVIEW_SCREEN_CONSTANTS.COLORS.PRIMARY}
            color={Colors.primary.DEFAULT}
          />
          <TextThemed
            style={reviewScreenStyles.loadingText}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Loading review session...
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
    )
  }

  if (sessionComplete) {
    return (
      <ViewThemed style={reviewScreenStyles.container}>
        <ViewThemed style={reviewScreenStyles.emptyContainer}>
          <TextThemed
            style={reviewScreenStyles.emptyText}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Session Complete! 🎉
          </TextThemed>
          <TextThemed
            style={reviewScreenStyles.emptySubtext}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            You reviewed {reviewWords.length} words
          </TextThemed>
          <TouchableOpacity
            testID="review-again-button"
            style={reviewScreenStyles.srsButton}
            onPress={restartSession}
          >
            <TextThemed style={reviewScreenStyles.buttonText}>
              Review Again
            </TextThemed>
          </TouchableOpacity>
        </ViewThemed>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed
      style={[
        reviewScreenStyles.container,
        { paddingBottom: insets.bottom + 60, paddingTop: insets.top },
      ]}
    >
      <ViewThemed style={reviewScreenStyles.progressContainer}>
        <TextThemed
          style={reviewScreenStyles.progressText}
          lightColor={Colors.neutral[500]}
          darkColor={Colors.dark.textSecondary}
        >
          {currentWordNumber} / {totalWords}
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={reviewScreenStyles.cardContainer}>
        {renderCard()}
      </ViewThemed>

      <ViewThemed style={reviewScreenStyles.buttonsContainer}>
        <TouchableOpacity
          testID="srs-again-button"
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.againButton]}
          onPress={handleAgain}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Again</TextThemed>
        </TouchableOpacity>

        <TouchableOpacity
          testID="srs-hard-button"
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.hardButton]}
          onPress={handleHard}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Hard</TextThemed>
        </TouchableOpacity>

        <TouchableOpacity
          testID="srs-good-button"
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.goodButton]}
          onPress={handleGood}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Good</TextThemed>
        </TouchableOpacity>

        <TouchableOpacity
          testID="srs-easy-button"
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.easyButton]}
          onPress={handleEasy}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Easy</TextThemed>
        </TouchableOpacity>
      </ViewThemed>

      {currentWord && (
        <ImageSelector
          visible={showImageSelector}
          onClose={closeImageSelector}
          onSelect={handleImageChange}
          currentImageUrl={currentWord.image_url || undefined}
          englishTranslation={currentWord.translations.en[0] || ''}
          partOfSpeech={currentWord.part_of_speech || ''}
          examples={currentWord.examples || undefined}
        />
      )}

      <WordDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={selectedWord}
        onChangeImage={openImageSelector}
        onDeleteWord={handleDeleteWord}
      />
    </ViewThemed>
  )
}
