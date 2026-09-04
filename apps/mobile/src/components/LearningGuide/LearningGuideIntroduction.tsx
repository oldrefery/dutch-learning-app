import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

interface LearningGuideIntroductionProps {
  onShowGuide: () => void
  onDismiss: () => void
}

export function LearningGuideIntroduction({
  onShowGuide,
  onDismiss,
}: LearningGuideIntroductionProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]

  return (
    <View
      testID="learning-guide-introduction"
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        },
      ]}
    >
      <TextThemed accessibilityRole="header" style={styles.title}>
        New learning tools, explained
      </TextThemed>
      <TextThemed
        style={styles.description}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        See how review modes, SRS ratings, difficult words, and Audio Review
        work together.
      </TextThemed>
      <View style={styles.actions}>
        <Pressable
          testID="show-learning-guide-button"
          accessibilityRole="button"
          accessibilityLabel="Show Learning Guide"
          accessibilityHint="Opens the learning guide"
          onPress={onShowGuide}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.tint,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <TextThemed style={styles.primaryButtonText}>Show Guide</TextThemed>
        </Pressable>
        <Pressable
          testID="dismiss-learning-guide-button"
          accessibilityRole="button"
          accessibilityLabel="Not Now"
          accessibilityHint="Dismisses this introduction for the current guide version"
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: theme.border,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <TextThemed
            style={[styles.secondaryButtonText, { color: theme.tint }]}
          >
            Not Now
          </TextThemed>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
  },
  title: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    fontWeight: '700',
    lineHeight: 24,
  },
  description: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    lineHeight: 20,
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.XS,
  },
  actions: {
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    gap: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },
  primaryButtonText: {
    color: Colors.legacy.white,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },
  secondaryButtonText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    fontWeight: '600',
  },
})
