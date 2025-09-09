import React, { forwardRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { TapGestureHandler, State } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import type { PronunciationProps } from './types'

export const PronunciationButton = forwardRef<
  TapGestureHandler,
  PronunciationProps
>(function PronunciationButton(
  { ttsUrl, isPlayingAudio, onPress, size = 'normal' },
  ref
) {
  if (!ttsUrl) return null

  const iconSize = size === 'small' ? 18 : 24
  const buttonStyle = size === 'small' ? styles.buttonSmall : styles.button

  const handlePress = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.ACTIVE) {
      onPress(ttsUrl)
    }
  }

  return (
    <TapGestureHandler
      ref={ref}
      onHandlerStateChange={handlePress}
      enabled={!isPlayingAudio}
    >
      <View style={buttonStyle}>
        <Ionicons
          name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
          size={iconSize}
          color={Colors.primary.dark}
        />
      </View>
    </TapGestureHandler>
  )
})

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
