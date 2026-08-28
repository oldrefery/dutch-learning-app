import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'

interface DutchProductionCardProps {
  prompt: string
}

export function DutchProductionCard({ prompt }: DutchProductionCardProps) {
  return (
    <ViewThemed
      style={styles.container}
      testID="dutch-production-card"
      accessible
      accessibilityLabel={`Translate into Dutch: ${prompt}`}
    >
      <TextThemed
        style={styles.eyebrow}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        Translate into Dutch
      </TextThemed>
      <TextThemed style={styles.prompt}>{prompt}</TextThemed>
      <TextThemed
        style={styles.hint}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        Say the Dutch word, then reveal the answer.
      </TextThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.XL,
    paddingBottom: 110,
  },
  eyebrow: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    lineHeight: 24,
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },
  prompt: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.XXLARGE,
    fontWeight: '700',
    lineHeight: 40,
    textAlign: 'center',
  },
  hint: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
  },
})
