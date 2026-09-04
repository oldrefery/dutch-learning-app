import React, { forwardRef, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { GlassIconButton } from '@/components/glass/buttons/GlassIconButton'
import type { PronunciationProps } from './types'

/**
 * Pronunciation Button for Review Cards
 *
 * Now follows HIG guidelines with:
 * - Proper tap target (44x44pt)
 * - Tinted button style
 * - Clear visual states
 * - Accessibility support
 */
export const PronunciationButton = forwardRef<View, PronunciationProps>(
  function PronunciationButton(
    { ttsUrl, isPlayingAudio, onPress, size = 'normal' },
    ref
  ) {
    const buttonSize = size === 'small' ? 'small' : 'medium'

    const handlePress = useCallback(() => {
      if (!isPlayingAudio && ttsUrl) {
        onPress(ttsUrl)
      }
    }, [isPlayingAudio, onPress, ttsUrl])

    if (!ttsUrl) return null

    return (
      <View ref={ref} style={styles.container}>
        <GlassIconButton
          icon={isPlayingAudio ? 'volume-high' : 'volume-medium'}
          onPress={handlePress}
          variant="tinted"
          size={buttonSize}
          disabled={isPlayingAudio}
          accessibilityLabel="Play pronunciation"
          accessibilityHint="Plays audio pronunciation of the word"
        />
      </View>
    )
  }
)

const styles = StyleSheet.create({
  container: {
    marginLeft: 12,
  },
})
