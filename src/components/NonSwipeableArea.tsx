import React from 'react'
import { View } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'

interface NonSwipeableAreaProps {
  children: React.ReactNode
  style?: any
}

/**
 * Обертка для компонентов, которые не должны вызывать родительские жесты
 * Использует Native gesture для блокировки родительских gesture handlers
 */
export function NonSwipeableArea({ children, style }: NonSwipeableAreaProps) {
  // Создаем Native gesture который блокирует родительские жесты
  const nativeGesture = Gesture.Native()

  return (
    <GestureDetector gesture={nativeGesture}>
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  )
}
