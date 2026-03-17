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
 * Uses Gesture.Native() with blocksExternalGesture to make the parent tap gesture
 * wait until touches inside this area end. The native gesture handler allows normal
 * touch handling for child Pressable/Button components while blocking the parent.
 *
 * Requires ParentGestureContext to provide a ref to the gesture that should be blocked.
 * When no context is provided, renders children without gesture wrapping.
 */
export function NonSwipeableArea({ children, style }: NonSwipeableAreaProps) {
  const parentGestureRef = useContext(ParentGestureContext)

  const blockingGesture = useMemo(() => {
    if (!parentGestureRef) return null
    return Gesture.Native().blocksExternalGesture(parentGestureRef)
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
