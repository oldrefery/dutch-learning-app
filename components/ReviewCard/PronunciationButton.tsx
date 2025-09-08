import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { PronunciationProps } from './types'

export function PronunciationButton({
  ttsUrl,
  isPlayingAudio,
  onPress,
  size = 'normal',
}: PronunciationProps) {
  if (!ttsUrl) return null

  const iconSize = size === 'small' ? 18 : 24
  const buttonStyle = size === 'small' ? styles.buttonSmall : styles.button

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={() => onPress(ttsUrl)}
      disabled={isPlayingAudio}
    >
      <Ionicons
        name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
        size={iconSize}
        color="#2563eb"
      />
    </TouchableOpacity>
  )
}

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
