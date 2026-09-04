import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { GlassCapsuleButton } from '@/components/glass/buttons'
import { Colors } from '@/constants/Colors'

interface ReviewButtonProps {
  wordsForReview: number
  onPress: () => void
}

/**
 * Review Button Component
 *
 * Uses GlassCapsuleButton following Apple HIG guidelines:
 * - Tinted style for secondary actions (primary is in tab bar)
 * - Minimum 44pt tap target height
 * - Clear pressed state
 * - Disabled state when no words available
 * - Integrated with Liquid Glass design system
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/buttons
 */
export default function ReviewButton({
  wordsForReview,
  onPress,
}: ReviewButtonProps) {
  const isDisabled = wordsForReview === 0

  if (isDisabled) {
    return (
      <ViewThemed style={styles.container}>
        <ViewThemed style={styles.disabledContainer}>
          <TextThemed
            style={styles.disabledText}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            No words for review
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
    )
  }

  const buttonText = `Review All Collections (${wordsForReview})`

  return (
    <ViewThemed style={styles.container}>
      <GlassCapsuleButton
        icon="play-circle"
        text={buttonText}
        onPress={onPress}
        variant="tinted"
        size="large"
        accessibilityLabel="Start review session"
        accessibilityHint={`Review ${wordsForReview} ${wordsForReview === 1 ? 'word' : 'words'} from all collections`}
      />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: Colors.transparent.clear,
  },
  disabledContainer: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: Colors.transparent.black05,
  },
  disabledText: {
    fontSize: 16,
    fontWeight: '500',
  },
})
