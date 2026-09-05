import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { REVIEW_MODE } from '@/constants/ReviewConstants'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import type { ReviewMode } from '@/types/ReviewTypes'

interface ReviewAssessmentControlsProps {
  isRevealed: boolean
  effectiveMode: ReviewMode
  recognitionResult: boolean | null
  disabled: boolean
  onReveal: () => void
  onAgain: () => void
  onHard: () => void
  onGood: () => void
  onEasy: () => void
}

interface AssessmentButtonProps {
  testID: string
  label: string
  hint: string
  disabled: boolean
  style: StyleProp<ViewStyle>
  onPress: () => void
}

function AssessmentButton({
  testID,
  label,
  hint,
  disabled,
  style,
  onPress,
}: AssessmentButtonProps) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[reviewScreenStyles.srsButton, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
    >
      <TextThemed style={reviewScreenStyles.buttonText}>{label}</TextThemed>
    </TouchableOpacity>
  )
}

export function ReviewAssessmentControls({
  isRevealed,
  effectiveMode,
  recognitionResult,
  disabled,
  onReveal,
  onAgain,
  onHard,
  onGood,
  onEasy,
}: ReviewAssessmentControlsProps) {
  if (!isRevealed) {
    if (effectiveMode === REVIEW_MODE.RECOGNITION) return null

    return (
      <View style={reviewScreenStyles.buttonsRow}>
        <AssessmentButton
          testID="reveal-answer-button"
          label="Show Answer"
          hint="Reveals the answer and SRS rating controls"
          disabled={false}
          style={reviewScreenStyles.revealButton}
          onPress={onReveal}
        />
      </View>
    )
  }

  if (effectiveMode === REVIEW_MODE.RECOGNITION && recognitionResult === null) {
    return null
  }

  if (recognitionResult === false) {
    return (
      <View style={reviewScreenStyles.buttonsRow}>
        <AssessmentButton
          testID="recognition-continue-button"
          label="Continue"
          hint="Records Again and moves to the next word"
          disabled={disabled}
          style={reviewScreenStyles.againButton}
          onPress={onAgain}
        />
      </View>
    )
  }

  return (
    <View style={reviewScreenStyles.buttonsRow}>
      {effectiveMode !== REVIEW_MODE.RECOGNITION && (
        <AssessmentButton
          testID="srs-again-button"
          label="Again"
          hint="Schedules the word for another attempt"
          disabled={disabled}
          style={reviewScreenStyles.againButton}
          onPress={onAgain}
        />
      )}
      <AssessmentButton
        testID="srs-hard-button"
        label="Hard"
        hint="Rates this recall as hard"
        disabled={disabled}
        style={reviewScreenStyles.hardButton}
        onPress={onHard}
      />
      <AssessmentButton
        testID="srs-good-button"
        label="Good"
        hint="Rates this recall as good"
        disabled={disabled}
        style={reviewScreenStyles.goodButton}
        onPress={onGood}
      />
      <AssessmentButton
        testID="srs-easy-button"
        label="Easy"
        hint="Rates this recall as easy"
        disabled={disabled}
        style={reviewScreenStyles.easyButton}
        onPress={onEasy}
      />
    </View>
  )
}
