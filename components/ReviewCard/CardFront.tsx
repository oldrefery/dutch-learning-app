import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
import { PronunciationButton } from './PronunciationButton'
import { Colors } from '@/constants/Colors'
import type { ReviewCardProps } from './types'

interface CardFrontProps extends ReviewCardProps {
  isPlayingAudio: boolean
  onPlayPronunciation: (url: string) => void
  pronunciationRef?: React.RefObject<View>
}

export function CardFront({
  currentWord,
  isPlayingAudio,
  onPlayPronunciation,
  pronunciationRef,
}: CardFrontProps) {
  return (
    <View style={styles.cardFront}>
      <View style={styles.wordWithPronunciation}>
        <Text style={styles.dutchWord}>
          {currentWord.article ? `${currentWord.article} ` : ''}
          {currentWord.dutch_lemma}
        </Text>
        <PronunciationButton
          ref={pronunciationRef}
          ttsUrl={currentWord.tts_url}
          isPlayingAudio={isPlayingAudio}
          onPress={onPlayPronunciation}
        />
      </View>
      <Text style={styles.partOfSpeech}>{currentWord.part_of_speech}</Text>
      <Text style={styles.tapHint}>Tap to see translation</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  cardFront: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  wordWithPronunciation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dutchWord: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.neutral[700],
    textAlign: 'center',
  },
  partOfSpeech: {
    fontSize: 16,
    color: Colors.neutral[500],
    fontStyle: 'italic',
    marginBottom: 24,
  },
  tapHint: {
    fontSize: 14,
    color: Colors.neutral[400],
    textAlign: 'center',
  },
})
