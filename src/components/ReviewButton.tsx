import React from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Animated,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { LIQUID_GLASS, INTERACTION } from '@/constants/UIConstants'

interface ReviewButtonProps {
  wordsForReview: number
  onPress: () => void
}

export default function ReviewButton({
  wordsForReview,
  onPress,
}: ReviewButtonProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: INTERACTION.SCALE_DOWN,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  if (wordsForReview === 0) {
    return (
      <ViewThemed style={styles.container}>
        <BlurView
          intensity={LIQUID_GLASS.BLUR_INTENSITY.CARD}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <ViewThemed
            style={[
              styles.disabledButton,
              {
                backgroundColor: isDarkMode
                  ? LIQUID_GLASS.BACKGROUND_DARK.SECONDARY
                  : LIQUID_GLASS.BACKGROUND_LIGHT.SECONDARY,
                borderColor: isDarkMode
                  ? LIQUID_GLASS.BORDER_DARK
                  : LIQUID_GLASS.BORDER_LIGHT,
              },
            ]}
          >
            <TextThemed style={styles.disabledButtonText}>
              No words for review
            </TextThemed>
          </ViewThemed>
        </BlurView>
      </ViewThemed>
    )
  }

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={INTERACTION.ACTIVE_OPACITY}
      >
        <BlurView
          intensity={LIQUID_GLASS.BLUR_INTENSITY.CARD}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <ViewThemed
            style={[
              styles.reviewButton,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(52, 120, 246, 0.85)'
                  : 'rgba(59, 130, 246, 0.9)',
                borderColor: isDarkMode
                  ? 'rgba(52, 120, 246, 0.4)'
                  : 'rgba(59, 130, 246, 0.3)',
              },
            ]}
          >
            <TextThemed style={styles.reviewButtonText}>
              Review All Collections
            </TextThemed>
            <TextThemed style={styles.reviewButtonSubtext}>
              {wordsForReview} words ready for review
            </TextThemed>
          </ViewThemed>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.MEDIUM,
    overflow: 'hidden',
    ...LIQUID_GLASS.SHADOW.CARD,
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.MEDIUM,
  },
  reviewButton: {
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.MEDIUM,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  reviewButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  disabledButton: {
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.MEDIUM,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  disabledButtonText: {
    color: Colors.neutral[500],
    fontSize: 16,
    fontWeight: '500',
  },
})
