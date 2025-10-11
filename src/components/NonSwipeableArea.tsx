import React, { useMemo } from 'react'
import { View, ViewStyle } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'

interface NonSwipeableAreaProps {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
}

/**
 * Wrapper for components that should not trigger parent gestures
 * Uses Tap gesture with blocksExternalGesture to prevent parent tap handler from activating
 *
 * Use this for interactive buttons inside GestureDetector areas to prevent
 * button taps from triggering parent gestures (e.g., card flip)
 */
export function NonSwipeableArea({ children, style }: NonSwipeableAreaProps) {
  // Create a tap gesture that blocks external gestures (parent gestures)
  // This ensures button presses don't trigger the parent tap gesture
  const blockingGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(10000) // Long duration to capture all taps
        .shouldCancelWhenOutside(false)
        .blocksExternalGesture(),
    []
  )

  return (
    <GestureDetector gesture={blockingGesture}>
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  )
}
