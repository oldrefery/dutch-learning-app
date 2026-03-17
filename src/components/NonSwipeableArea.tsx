import React, { useContext, useMemo } from 'react'
import { View, ViewStyle } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { ParentGestureContext } from '@/contexts/ParentGestureContext'

interface NonSwipeableAreaProps {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
}

/**
 * Wrapper that prevents child interactions from triggering parent gestures.
 *
 * Uses Gesture.Tap() with blocksExternalGesture to make the parent tap gesture
 * wait until taps inside this area complete. Child Pressable components with
 * cancelable={false} continue to work normally while the parent tap is blocked.
 *
 * Requires ParentGestureContext to provide a ref to the gesture that should be blocked.
 * When no context is provided, renders children without gesture wrapping.
 */
export function NonSwipeableArea({ children, style }: NonSwipeableAreaProps) {
  const parentGestureRef = useContext(ParentGestureContext)

  const blockingGesture = useMemo(() => {
    if (!parentGestureRef) return null
    return Gesture.Tap()
      .maxDuration(10000)
      .shouldCancelWhenOutside(false)
      .cancelsTouchesInView(false)
      .blocksExternalGesture(parentGestureRef)
  }, [parentGestureRef])

  if (!blockingGesture) {
    return <View style={style}>{children}</View>
  }

  return (
    <GestureDetector gesture={blockingGesture}>
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  )
}
