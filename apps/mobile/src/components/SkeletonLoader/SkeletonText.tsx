import React, { useEffect } from 'react'
import { StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated'
import { Colors } from '@/constants/Colors'

interface SkeletonTextProps {
  /**
   * Width of the skeleton placeholder
   */
  width?: number | string
  /**
   * Height of the skeleton placeholder
   */
  height?: number
  /**
   * Border radius of the skeleton placeholder
   */
  borderRadius?: number
  /**
   * Animation duration in milliseconds
   */
  duration?: number
  /**
   * Custom style overrides
   */
  style?: ViewStyle
  /**
   * Delay before animation starts (useful for staggered animations)
   */
  delay?: number
}

/**
 * SkeletonText - A smooth skeleton loading placeholder for text content
 * Built with React Native Reanimated 4.0 for optimal performance
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  duration = 1200,
  delay = 0,
  style,
}) => {
  const opacity = useSharedValue(1)

  useEffect(() => {
    // Add delay if specified (useful for staggered loading)
    const startAnimation = () => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1, // Repeat infinitely
        false // Don't reverse
      )
    }

    if (delay > 0) {
      const timeoutId = setTimeout(startAnimation, delay)
      return () => clearTimeout(timeoutId)
    } else {
      startAnimation()
    }
  }, [duration, delay, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
        } as ViewStyle,
        animatedStyle,
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.neutral[200],
  },
})
