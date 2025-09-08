import React from 'react'
import { StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { Text } from '@/components/Themed'

interface CollectionReviewButtonProps {
  wordsForReview: number
  onPress: () => void
  scrollY: Animated.Value
}

export default function CollectionReviewButton({
  wordsForReview,
  onPress,
  scrollY,
}: CollectionReviewButtonProps) {
  if (wordsForReview === 0) return null

  const statsOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const statsTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -100],
    extrapolate: 'clamp',
  })

  return (
    <Animated.View
      style={[
        styles.reviewButtonContainer,
        {
          opacity: statsOpacity,
          transform: [{ translateY: statsTranslateY }],
          height: scrollY.interpolate({
            inputRange: [0, 100],
            outputRange: [60, 0], // Button height to 0
            extrapolate: 'clamp',
          }),
          overflow: 'hidden',
        },
      ]}
    >
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
    position: 'absolute',
    top: 200, // Adjust based on stats card height
    left: 0,
    right: 0,
    marginHorizontal: 16,
    zIndex: 10,
  },
  reviewButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})
