import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated'
import { Text } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface CollectionReviewButtonProps {
  wordsForReview: number
  onPress: () => void
  scrollY: SharedValue<number>
}

export default function CollectionReviewButton({
  wordsForReview,
  onPress,
  scrollY,
}: CollectionReviewButtonProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0],
      Extrapolation.CLAMP
    )

    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, -30],
      Extrapolation.CLAMP
    )

    const height = interpolate(
      scrollY.value,
      [0, 100],
      [60, 0],
      Extrapolation.CLAMP
    )

    const marginBottom = interpolate(
      scrollY.value,
      [0, 100],
      [16, 0],
      Extrapolation.CLAMP
    )

    return {
      opacity,
      transform: [{ translateY }],
      height,
      marginBottom,
      overflow: 'hidden',
    }
  })

  if (wordsForReview === 0) return null

  return (
    <Animated.View style={[styles.reviewButtonContainer, animatedStyle]}>
      <TouchableOpacity style={styles.reviewButton} onPress={onPress}>
        <Text style={styles.reviewButtonText}>
          Review {wordsForReview} Words
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  reviewButtonContainer: {
    marginHorizontal: 16,
  },
  reviewButton: {
    backgroundColor: Colors.primary.DEFAULT,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
})
