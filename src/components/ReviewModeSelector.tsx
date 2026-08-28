import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { REVIEW_MODE_OPTIONS } from '@/constants/ReviewConstants'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { ReviewMode } from '@/types/ReviewTypes'

interface ReviewModeSelectorProps {
  selectedMode: ReviewMode
  onSelectMode: (mode: ReviewMode) => void
  onStart: (mode: ReviewMode) => void | Promise<void>
  isLoading?: boolean
}

export function ReviewModeSelector({
  selectedMode,
  onSelectMode,
  onStart,
  isLoading = false,
}: ReviewModeSelectorProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]

  return (
    <ViewThemed
      style={styles.container}
      testID="review-mode-selector"
      accessibilityLabel="Choose a review mode"
    >
      <TextThemed style={styles.title}>How do you want to practice?</TextThemed>
      <TextThemed
        style={styles.subtitle}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        Your choice applies to this session. Scheduling still uses the same SRS
        ratings.
      </TextThemed>

      <View style={styles.options} accessibilityRole="radiogroup">
        {REVIEW_MODE_OPTIONS.map(option => {
          const isSelected = option.mode === selectedMode

          return (
            <Pressable
              key={option.mode}
              testID={`review-mode-${option.mode}`}
              onPress={() => onSelectMode(option.mode)}
              accessibilityRole="radio"
              accessibilityLabel={option.title}
              accessibilityHint={option.description}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: isSelected
                    ? colorScheme === 'dark'
                      ? Colors.transparent.primary20
                      : Colors.primary.light
                    : theme.backgroundSecondary,
                  borderColor: isSelected ? theme.tint : theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={styles.optionCopy}>
                <TextThemed style={styles.optionTitle}>
                  {option.title}
                </TextThemed>
                <TextThemed
                  style={styles.optionDescription}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                >
                  {option.description}
                </TextThemed>
              </View>
              <View
                style={[
                  styles.selectionIndicator,
                  {
                    borderColor: isSelected ? theme.tint : theme.border,
                    backgroundColor: isSelected
                      ? theme.tint
                      : Colors.transparent.clear,
                  },
                ]}
                importantForAccessibility="no"
              />
            </Pressable>
          )
        })}
      </View>

      <Pressable
        testID="start-review-button"
        accessibilityRole="button"
        accessibilityLabel={`Start ${REVIEW_MODE_OPTIONS.find(option => option.mode === selectedMode)?.title ?? 'review'} session`}
        accessibilityHint="Starts a review session using the selected mode"
        accessibilityState={{ disabled: isLoading }}
        disabled={isLoading}
        onPress={() => void onStart(selectedMode)}
        style={({ pressed }) => [
          styles.startButton,
          {
            backgroundColor: theme.tint,
            opacity: isLoading ? 0.5 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <TextThemed style={styles.startButtonText}>
          {isLoading ? 'Starting…' : 'Start Review'}
        </TextThemed>
      </Pressable>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
  },
  title: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.XLARGE,
    fontWeight: '700',
    lineHeight: 31,
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },
  subtitle: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    lineHeight: 24,
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
  },
  options: {
    gap: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },
  option: {
    minHeight: 72,
    borderWidth: 2,
    borderRadius: 16,
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    fontWeight: '600',
    lineHeight: 22,
  },
  optionDescription: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    lineHeight: 20,
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.XS,
  },
  selectionIndicator: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 11,
  },
  startButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },
  startButtonText: {
    color: Colors.legacy.white,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    fontWeight: '700',
  },
})
