import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  useColorScheme,
} from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import type { GestureType } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { TextThemed, ViewThemed } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import WordDetailModal from '@/components/WordDetailModal'
import { ReviewModeSelector } from '@/components/ReviewModeSelector'
import { ReviewAssessmentControls } from '@/components/ReviewModes/ReviewAssessmentControls'
import { ReviewSessionCard } from '@/components/ReviewModes/ReviewSessionCard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import { useImageSelector } from '@/hooks/useImageSelector'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sentry } from '@/lib/sentry'
import { useReviewWordsCount } from '@/hooks/useReviewWordsCount'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { GlassHeaderDefaults } from '@/constants/GlassConstants'
import { REVIEW_MODE, REVIEW_SCOPE } from '@/constants/ReviewConstants'
import { useSettingsStore } from '@/stores/useSettingsStore'
import type { ReviewMode } from '@/types/ReviewTypes'
import type { RecognitionOption } from '@/utils/reviewDistractors'
import {
  buildRecognitionOptions,
  getPreferredTranslation,
} from '@/utils/reviewDistractors'

const showReanalysisError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Could not re-analyze word'
  ToastService.show(message, ToastType.ERROR)
}

interface ReviewModePresentation {
  effectiveMode: ReviewMode
  preferredTranslation: string | null
  recognitionOptions: RecognitionOption[] | null
  fallbackMessage: string | null
}

const getReviewModePresentation = (
  configuredMode: ReviewMode,
  currentWord: Word | null,
  vocabulary: Word[]
): ReviewModePresentation => {
  const preferredTranslation = currentWord
    ? getPreferredTranslation(currentWord)
    : null

  if (configuredMode === REVIEW_MODE.RECOGNITION && currentWord) {
    const recognitionOptions = buildRecognitionOptions(currentWord, vocabulary)
    return recognitionOptions
      ? {
          effectiveMode: configuredMode,
          preferredTranslation,
          recognitionOptions,
          fallbackMessage: null,
        }
      : {
          effectiveMode: REVIEW_MODE.MEANING_RECALL,
          preferredTranslation,
          recognitionOptions: null,
          fallbackMessage:
            'Not enough distinct translations. Using Meaning Recall for this word.',
        }
  }

  if (
    configuredMode === REVIEW_MODE.DUTCH_PRODUCTION &&
    currentWord &&
    !preferredTranslation
  ) {
    return {
      effectiveMode: REVIEW_MODE.MEANING_RECALL,
      preferredTranslation: null,
      recognitionOptions: null,
      fallbackMessage:
        'No translation is available. Using Meaning Recall for this word.',
    }
  }

  return {
    effectiveMode: configuredMode,
    preferredTranslation,
    recognitionOptions: null,
    fallbackMessage: null,
  }
}

function useReviewWordDetails(currentWord: Word | null) {
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const reanalyzeWord = useApplicationStore(state => state.reanalyzeWord)
  const updateCurrentWordInReview = useApplicationStore(
    state => state.updateCurrentWordInReview
  )

  const handleOpenDetails = useCallback(() => {
    if (!currentWord) return
    setSelectedWord(currentWord)
    setModalVisible(true)
  }, [currentWord])

  const handleCloseDetails = useCallback(() => {
    setModalVisible(false)
    setSelectedWord(null)
  }, [])

  const handleReanalyzeSelectedWord = useCallback(async () => {
    if (!selectedWord) return

    setIsReanalyzing(true)
    try {
      const updatedWord = await reanalyzeWord(selectedWord.word_id)
      if (!updatedWord) {
        ToastService.show('Failed to re-analyze word', ToastType.ERROR)
        return
      }
      setSelectedWord(updatedWord)
      updateCurrentWordInReview(updatedWord)
      ToastService.show('Word re-analyzed successfully', ToastType.SUCCESS)
    } catch (error: unknown) {
      showReanalysisError(error)
    } finally {
      setIsReanalyzing(false)
    }
  }, [reanalyzeWord, selectedWord, updateCurrentWordInReview])

  const handleReanalyzeCurrentWord = useCallback(async () => {
    if (!currentWord) return

    setIsReanalyzing(true)
    try {
      const updatedWord = await reanalyzeWord(currentWord.word_id)
      if (!updatedWord) {
        ToastService.show('Failed to re-analyze word', ToastType.ERROR)
        return
      }
      updateCurrentWordInReview(updatedWord)
      ToastService.show('Word re-analyzed successfully', ToastType.SUCCESS)
    } catch (error: unknown) {
      showReanalysisError(error)
    } finally {
      setIsReanalyzing(false)
    }
  }, [currentWord, reanalyzeWord, updateCurrentWordInReview])

  return {
    selectedWord,
    modalVisible,
    isReanalyzing,
    handleOpenDetails,
    handleCloseDetails,
    handleReanalyzeSelectedWord,
    handleReanalyzeCurrentWord,
  }
}

export default function ReviewScreen() {
  const colorScheme = useColorScheme()
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)
  const pronunciationRef = useRef<View>(null)
  const tapGestureRef = useRef<GestureType | undefined>(undefined)

  const {
    // State
    reviewSession,
    currentWord,
    sessionComplete,
    reviewWords,
    availableWords,
    isLoading,
    totalWords,
    currentWordNumber,
    isFlipped,
    isPlayingAudio,
    sessionEmpty,
    // Actions
    playAudio,
    handleAgain,
    handleHard,
    handleGood,
    handleEasy,
    handleDeleteWord,
    handleImageChange,
    startSession,
    restartSession,
    chooseAnotherMode,
    handleFlipCard,
    revealAnswer,
    goToNextWord,
    goToPreviousWord,
  } = useReviewScreen()

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()
  const {
    selectedWord,
    modalVisible,
    isReanalyzing,
    handleOpenDetails,
    handleCloseDetails,
    handleReanalyzeSelectedWord,
    handleReanalyzeCurrentWord,
  } = useReviewWordDetails(currentWord)

  const lastSelectedReviewMode = useSettingsStore(
    state => state.lastSelectedReviewMode
  )
  const setLastSelectedReviewMode = useSettingsStore(
    state => state.setLastSelectedReviewMode
  )
  const [selectedRecognitionOption, setSelectedRecognitionOption] =
    useState<RecognitionOption | null>(null)

  // Enable pull-to-refresh to also refresh review count (badge)
  const { refreshCount } = useReviewWordsCount()

  const configuredMode = reviewSession?.config.mode ?? lastSelectedReviewMode
  const {
    effectiveMode,
    preferredTranslation,
    recognitionOptions,
    fallbackMessage,
  } = useMemo(
    () =>
      getReviewModePresentation(configuredMode, currentWord, availableWords),
    [availableWords, configuredMode, currentWord]
  )

  useEffect(() => {
    setSelectedRecognitionOption(null)
  }, [configuredMode, currentWord?.word_id])

  const handleModeSelect = useCallback(
    (mode: ReviewMode) => {
      setLastSelectedReviewMode(mode)
    },
    [setLastSelectedReviewMode]
  )

  const handleStartSession = useCallback(
    async (mode: ReviewMode) => {
      setLastSelectedReviewMode(mode)
      await startSession({ mode, scope: REVIEW_SCOPE.ALL_DUE })
    },
    [setLastSelectedReviewMode, startSession]
  )

  const handleRecognitionOption = useCallback(
    (option: RecognitionOption) => {
      setSelectedRecognitionOption(option)
      revealAnswer()
    },
    [revealAnswer]
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        refreshCount(),
        startSession(
          reviewSession?.config ?? {
            mode: lastSelectedReviewMode,
            scope: REVIEW_SCOPE.ALL_DUE,
          }
        ),
      ])
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'refreshReviewSession' },
        extra: { message: 'Error refreshing review session' },
      })
    } finally {
      setRefreshing(false)
    }
  }, [
    lastSelectedReviewMode,
    refreshCount,
    reviewSession?.config,
    startSession,
  ])

  // Create completely stable gestures to prevent recreation
  // withRef exposes this gesture so NonSwipeableArea can block it via context
  const tapGestureInstance = useMemo(() => {
    return Gesture.Tap()
      .withRef(tapGestureRef)
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

  const lockedGestureInstance = useMemo(() => Gesture.Tap().enabled(false), [])

  if (isLoading) {
    return (
      <ViewThemed style={reviewScreenStyles.container} testID="screen-review">
        <ViewThemed style={reviewScreenStyles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
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

  if (!reviewSession && !sessionComplete && !sessionEmpty) {
    return (
      <ViewThemed
        style={[reviewScreenStyles.container, { paddingTop: insets.top }]}
        testID="screen-review"
      >
        <ReviewModeSelector
          selectedMode={lastSelectedReviewMode}
          onSelectMode={handleModeSelect}
          onStart={handleStartSession}
        />
      </ViewThemed>
    )
  }

  if (sessionEmpty) {
    return (
      <ViewThemed style={reviewScreenStyles.container} testID="screen-review">
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
          <TouchableOpacity
            testID="change-review-mode-button"
            style={[
              reviewScreenStyles.secondaryButton,
              {
                borderColor:
                  Colors[colorScheme === 'dark' ? 'dark' : 'light'].border,
              },
            ]}
            onPress={chooseAnotherMode}
            accessibilityRole="button"
            accessibilityLabel="Choose another review mode"
          >
            <TextThemed style={reviewScreenStyles.secondaryButtonText}>
              Change Mode
            </TextThemed>
          </TouchableOpacity>
        </ScrollView>
      </ViewThemed>
    )
  }

  if (sessionComplete) {
    return (
      <ViewThemed style={reviewScreenStyles.container} testID="screen-review">
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
            style={[
              reviewScreenStyles.srsButton,
              reviewScreenStyles.revealButton,
            ]}
            onPress={restartSession}
            accessibilityRole="button"
            accessibilityLabel="Review again"
            accessibilityHint="Starts another session in the same mode"
          >
            <TextThemed style={reviewScreenStyles.buttonText}>
              Review Again
            </TextThemed>
          </TouchableOpacity>
          <TouchableOpacity
            testID="change-review-mode-button"
            style={reviewScreenStyles.secondaryButton}
            onPress={chooseAnotherMode}
            accessibilityRole="button"
            accessibilityLabel="Choose another review mode"
          >
            <TextThemed style={reviewScreenStyles.secondaryButtonText}>
              Change Mode
            </TextThemed>
          </TouchableOpacity>
        </ViewThemed>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed
      testID="screen-review"
      style={[reviewScreenStyles.container, { paddingTop: insets.top }]}
    >
      <ViewThemed style={reviewScreenStyles.progressContainer}>
        <TextThemed
          style={reviewScreenStyles.progressText}
          lightColor={Colors.neutral[500]}
          darkColor={Colors.dark.textSecondary}
        >
          {currentWordNumber} / {totalWords}
        </TextThemed>
        {fallbackMessage && (
          <TextThemed
            style={reviewScreenStyles.fallbackText}
            lightColor={Colors.warning.darkTheme}
            darkColor={Colors.warning.dark}
            accessibilityRole="alert"
          >
            {fallbackMessage}
          </TextThemed>
        )}
      </ViewThemed>

      <ViewThemed style={reviewScreenStyles.cardContainer}>
        {currentWord && (
          <ReviewSessionCard
            word={currentWord}
            configuredMode={configuredMode}
            effectiveMode={effectiveMode}
            preferredTranslation={preferredTranslation}
            recognitionOptions={recognitionOptions}
            selectedRecognitionOption={selectedRecognitionOption}
            isFlipped={isFlipped}
            isPlayingAudio={isPlayingAudio}
            isReanalyzing={isReanalyzing}
            tapGesture={tapGestureInstance}
            panGesture={panGestureInstance}
            lockedGesture={lockedGestureInstance}
            tapGestureRef={tapGestureRef}
            pronunciationRef={pronunciationRef}
            onPlayAudio={playAudio}
            onSelectRecognitionOption={handleRecognitionOption}
            onFlip={handleFlipCard}
            onOpenDetails={handleOpenDetails}
            onDelete={handleDeleteWord}
            onReanalyze={handleReanalyzeCurrentWord}
            onChangeImage={openImageSelector}
          />
        )}
      </ViewThemed>

      <View
        style={[
          reviewScreenStyles.buttonsOverlay,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <PlatformBlurView
          tint={GlassHeaderDefaults.tint}
          intensity={
            colorScheme === 'dark'
              ? GlassHeaderDefaults.intensityDark
              : GlassHeaderDefaults.intensityLight
          }
          fallbackColor={
            colorScheme === 'dark'
              ? Colors.transparent.white05
              : Colors.transparent.white50
          }
          style={StyleSheet.absoluteFill}
          blurMethod="dimezisBlurView"
        />
        <View style={reviewScreenStyles.hairline} />
        <ReviewAssessmentControls
          isRevealed={isFlipped}
          effectiveMode={effectiveMode}
          recognitionResult={
            configuredMode === REVIEW_MODE.RECOGNITION
              ? (selectedRecognitionOption?.isCorrect ?? null)
              : null
          }
          disabled={isLoading}
          onReveal={revealAnswer}
          onAgain={handleAgain}
          onHard={handleHard}
          onGood={handleGood}
          onEasy={handleEasy}
        />
      </View>

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
        onClose={handleCloseDetails}
        word={selectedWord}
        onChangeImage={openImageSelector}
        onDeleteWord={handleDeleteWord}
        onReanalyzeWord={handleReanalyzeSelectedWord}
        isReanalyzing={isReanalyzing}
      />
    </ViewThemed>
  )
}
