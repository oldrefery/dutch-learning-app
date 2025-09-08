import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
import { PronunciationButton } from './PronunciationButton'
import type { ReviewCardProps } from './types'

interface WordHeaderProps extends ReviewCardProps {
  isPlayingAudio: boolean
  onPlayPronunciation: (url: string) => void
}

export function WordHeader({
  currentWord,
  isPlayingAudio,
  onPlayPronunciation,
}: WordHeaderProps) {
  const buildMetadataText = () => {
    const parts = [currentWord.part_of_speech]

    if (currentWord.is_irregular) parts.push('irregular')
    if (currentWord.is_reflexive) parts.push('reflexive')
    if (currentWord.is_expression) {
      parts.push(currentWord.expression_type || 'expression')
    }

    return parts.join(' • ')
  }

  return (
    <View style={styles.wordHeader}>
      <View style={styles.wordWithPronunciationSmall}>
        <Text style={styles.dutchWordSmall}>
          {currentWord.article ? `${currentWord.article} ` : ''}
          {currentWord.dutch_lemma}
        </Text>
        <PronunciationButton
          ttsUrl={currentWord.tts_url}
          isPlayingAudio={isPlayingAudio}
          onPress={onPlayPronunciation}
          size="small"
        />
      </View>

      <View style={styles.metadataRow}>
        <Text style={styles.metadataText}>{buildMetadataText()}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wordHeader: {
    marginBottom: 20,
  },
  wordWithPronunciationSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dutchWordSmall: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metadataText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
})
