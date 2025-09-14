import React, { forwardRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import type { PronunciationProps } from './types'

export const PronunciationButton = forwardRef<View, PronunciationProps>(
  function PronunciationButton(
    { ttsUrl, isPlayingAudio, onPress, size = 'normal' },
    ref
  ) {
    if (!ttsUrl) return null

    const iconSize = size === 'small' ? 18 : 24
    const buttonStyle = size === 'small' ? styles.buttonSmall : styles.button

    const tapGesture = Gesture.Tap().onEnd(() => {
      'worklet'
      if (!isPlayingAudio) {
        runOnJS(onPress)(ttsUrl)
      }
    })

    return (
      <GestureDetector gesture={tapGesture}>
        <View style={buttonStyle} ref={ref}>
          <Ionicons
            name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
            size={iconSize}
            color={Colors.primary.dark}
          />
        </View>
      </GestureDetector>
    )
  }
)

const styles = StyleSheet.create({
  button: {
    marginLeft: 12,
    padding: 8,
  },
  buttonSmall: {
    marginLeft: 8,
    padding: 4,
  },
})
