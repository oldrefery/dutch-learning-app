import React from 'react'
import { StyleSheet, View } from 'react-native'
import { CardFront } from '@/components/ReviewCard/CardFront'
import type { Word } from '@/types/database'

interface MeaningRecallCardProps {
  word: Word
  isPlayingAudio: boolean
  onPlayPronunciation: (url?: string) => void
  pronunciationRef?: React.RefObject<View | null>
}

export function MeaningRecallCard({
  word,
  isPlayingAudio,
  onPlayPronunciation,
  pronunciationRef,
}: MeaningRecallCardProps) {
  return (
    <View style={styles.container} testID="meaning-recall-card">
      <CardFront
        currentWord={word}
        isPlayingAudio={isPlayingAudio}
        onPlayPronunciation={onPlayPronunciation}
        pronunciationRef={pronunciationRef}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
