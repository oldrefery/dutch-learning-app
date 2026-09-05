import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import type { GestureType } from 'react-native-gesture-handler'
import { GestureErrorBoundary } from '@/components/GestureErrorBoundary'
import { GlassHeader } from '@/components/glass/GlassHeader'
import { MeaningRecallCard } from '@/components/ReviewModes/MeaningRecallCard'
import { DutchProductionCard } from '@/components/ReviewModes/DutchProductionCard'
import { RecognitionCard } from '@/components/ReviewModes/RecognitionCard'
import { TextThemed, ViewThemed } from '@/components/Themed'
import {
  UniversalWordCard,
  WordCardPresets,
} from '@/components/UniversalWordCard'
import { GlassHeaderDefaults } from '@/constants/GlassConstants'
import { REVIEW_MODE } from '@/constants/ReviewConstants'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'
import { ParentGestureContext } from '@/contexts/ParentGestureContext'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import type { Word } from '@/types/database'
import type { ReviewMode } from '@/types/ReviewTypes'
import type { RecognitionOption } from '@/utils/reviewDistractors'
import {
  getDutchProductionAnswer,
  getPreferredTranslation,
} from '@/utils/reviewDistractors'

interface ReviewSessionCardProps {
  word: Word
  configuredMode: ReviewMode
  effectiveMode: ReviewMode
  preferredTranslation: string | null
  recognitionOptions: RecognitionOption[] | null
  selectedRecognitionOption: RecognitionOption | null
  isFlipped: boolean
  isPlayingAudio: boolean
  isReanalyzing: boolean
  tapGesture: GestureType
  panGesture: GestureType
  lockedGesture: GestureType
  pronunciationRef: React.RefObject<View | null>
  onPlayAudio: (url?: string) => void
  onSelectRecognitionOption: (option: RecognitionOption) => void
  onFlip: () => void
  onOpenDetails: () => void
  onDelete: () => void
  onReanalyze?: () => void
  onChangeImage?: () => void
}

interface ReviewPromptProps {
  word: Word
  effectiveMode: ReviewMode
  preferredTranslation: string | null
  recognitionOptions: RecognitionOption[] | null
  selectedRecognitionOption: RecognitionOption | null
  isPlayingAudio: boolean
  pronunciationRef: React.RefObject<View | null>
  onPlayAudio: (url?: string) => void
  onSelectRecognitionOption: (option: RecognitionOption) => void
}

function ReviewPrompt({
  word,
  effectiveMode,
  preferredTranslation,
  recognitionOptions,
  selectedRecognitionOption,
  isPlayingAudio,
  pronunciationRef,
  onPlayAudio,
  onSelectRecognitionOption,
}: ReviewPromptProps) {
  if (effectiveMode === REVIEW_MODE.RECOGNITION && recognitionOptions) {
    return (
      <RecognitionCard
        word={word}
        options={recognitionOptions}
        selectedOptionId={selectedRecognitionOption?.id ?? null}
        isPlayingAudio={isPlayingAudio}
        onPlayPronunciation={onPlayAudio}
        onSelectOption={onSelectRecognitionOption}
        pronunciationRef={pronunciationRef}
      />
    )
  }

  if (effectiveMode === REVIEW_MODE.DUTCH_PRODUCTION && preferredTranslation) {
    return <DutchProductionCard prompt={preferredTranslation} />
  }

  return (
    <MeaningRecallCard
      word={word}
      isPlayingAudio={isPlayingAudio}
      onPlayPronunciation={onPlayAudio}
      pronunciationRef={pronunciationRef}
    />
  )
}

const getRecognitionFeedback = (
  configuredMode: ReviewMode,
  selectedOption: RecognitionOption | null,
  word: Word
): string | null => {
  if (configuredMode !== REVIEW_MODE.RECOGNITION || !selectedOption) return null
  if (selectedOption.isCorrect) {
    return 'Correct. Choose how difficult the recall felt.'
  }

  return `Correct answer: ${getPreferredTranslation(word) ?? ''}`
}

export function ReviewSessionCard({
  word,
  configuredMode,
  effectiveMode,
  preferredTranslation,
  recognitionOptions,
  selectedRecognitionOption,
  isFlipped,
  isPlayingAudio,
  isReanalyzing,
  tapGesture,
  panGesture,
  lockedGesture,
  pronunciationRef,
  onPlayAudio,
  onSelectRecognitionOption,
  onFlip,
  onOpenDetails,
  onDelete,
  onReanalyze,
  onChangeImage,
}: ReviewSessionCardProps) {
  const gesture = selectedRecognitionOption
    ? lockedGesture
    : isFlipped || effectiveMode === REVIEW_MODE.RECOGNITION
      ? panGesture
      : Gesture.Exclusive(panGesture, tapGesture)
  const recognitionFeedback = getRecognitionFeedback(
    configuredMode,
    selectedRecognitionOption,
    word
  )
  const canHideAnswer = !(
    configuredMode === REVIEW_MODE.RECOGNITION && selectedRecognitionOption
  )

  return (
    <GestureErrorBoundary>
      <ParentGestureContext.Provider value={tapGesture}>
        <GestureDetector gesture={gesture}>
          <ViewThemed style={reviewScreenStyles.flashcard}>
            {!isFlipped ? (
              <ReviewPrompt
                word={word}
                effectiveMode={effectiveMode}
                preferredTranslation={preferredTranslation}
                recognitionOptions={recognitionOptions}
                selectedRecognitionOption={selectedRecognitionOption}
                isPlayingAudio={isPlayingAudio}
                pronunciationRef={pronunciationRef}
                onPlayAudio={onPlayAudio}
                onSelectRecognitionOption={onSelectRecognitionOption}
              />
            ) : (
              <>
                <GlassHeader
                  title={getDutchProductionAnswer(word)}
                  leftSlot={
                    canHideAnswer ? (
                      <TouchableOpacity
                        testID="hide-answer-button"
                        style={reviewScreenStyles.headerAction}
                        onPress={onFlip}
                        accessibilityRole="button"
                        accessibilityLabel="Hide answer"
                        accessibilityHint="Returns to the review prompt"
                      >
                        <TextThemed style={reviewScreenStyles.headerActionText}>
                          Hide
                        </TextThemed>
                      </TouchableOpacity>
                    ) : null
                  }
                  rightSlot={
                    <TouchableOpacity
                      testID="review-details-button"
                      style={reviewScreenStyles.headerAction}
                      onPress={onOpenDetails}
                      accessibilityRole="button"
                      accessibilityLabel="Open word details"
                      accessibilityHint="Opens the full word detail dialog"
                    >
                      <TextThemed style={reviewScreenStyles.headerActionText}>
                        Details
                      </TextThemed>
                    </TouchableOpacity>
                  }
                />
                {recognitionFeedback && (
                  <ViewThemed
                    style={[
                      reviewScreenStyles.feedbackBanner,
                      selectedRecognitionOption?.isCorrect
                        ? reviewScreenStyles.correctFeedback
                        : reviewScreenStyles.incorrectFeedback,
                    ]}
                    accessibilityRole="alert"
                  >
                    <TextThemed style={reviewScreenStyles.feedbackText}>
                      {recognitionFeedback}
                    </TextThemed>
                  </ViewThemed>
                )}
                <UniversalWordCard
                  word={word}
                  config={WordCardPresets.review.config}
                  actions={{
                    ...WordCardPresets.review.actions,
                    onDelete,
                    showReanalyzeButton: Boolean(onReanalyze),
                    onReanalyze,
                    isReanalyzing,
                  }}
                  isPlayingAudio={isPlayingAudio}
                  onPlayPronunciation={onPlayAudio}
                  onChangeImage={onChangeImage}
                  style={reviewScreenStyles.universalWordCard}
                  contentStyle={{
                    paddingTop:
                      GlassHeaderDefaults.height +
                      (recognitionFeedback
                        ? REVIEW_SCREEN_CONSTANTS.FEEDBACK_BANNER_HEIGHT
                        : 0),
                  }}
                />
              </>
            )}
          </ViewThemed>
        </GestureDetector>
      </ParentGestureContext.Provider>
    </GestureErrorBoundary>
  )
}
