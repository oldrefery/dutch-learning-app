import React, { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { PronunciationButton } from './PronunciationButton'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { ReviewCardProps } from './types'

interface CardFrontProps extends ReviewCardProps {
  isPlayingAudio: boolean
  onPlayPronunciation: (url: string) => void
  pronunciationRef?: React.RefObject<View | null>
}

export function CardFront({
  currentWord,
  isPlayingAudio,
  onPlayPronunciation,
  pronunciationRef,
}: CardFrontProps) {
  const autoPlayPronunciation = useApplicationStore(
    state => state.autoPlayPronunciation
  )
  const hasAutoPlayedRef = useRef(false)

  // Auto-play pronunciation when card is shown (if enabled and tts_url exists)
  useEffect(() => {
    if (
      autoPlayPronunciation &&
      currentWord.tts_url &&
      !hasAutoPlayedRef.current &&
      !isPlayingAudio
    ) {
      hasAutoPlayedRef.current = true
      onPlayPronunciation(currentWord.tts_url)
    }
  }, [
    autoPlayPronunciation,
    currentWord.tts_url,
    onPlayPronunciation,
    isPlayingAudio,
  ])

  // Reset the auto-played flag when the word changes
  useEffect(() => {
    hasAutoPlayedRef.current = false
  }, [currentWord.word_id])

  return (
    <ViewThemed style={styles.cardFront}>
      <ViewThemed style={styles.wordWithPronunciation}>
        <TextThemed
          style={styles.dutchWord}
          lightColor={Colors.neutral[700]}
          darkColor={Colors.dark.text}
        >
          {currentWord.article ? `${currentWord.article} ` : ''}
          {currentWord.dutch_lemma}
        </TextThemed>
        <NonSwipeableArea>
          <PronunciationButton
            ref={pronunciationRef}
            ttsUrl={currentWord.tts_url}
            isPlayingAudio={isPlayingAudio}
            onPress={onPlayPronunciation}
          />
        </NonSwipeableArea>
      </ViewThemed>
      <TextThemed
        style={styles.partOfSpeech}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        {currentWord.part_of_speech}
      </TextThemed>
      <TextThemed
        style={styles.tapHint}
        lightColor={Colors.neutral[400]}
        darkColor={Colors.dark.textTertiary}
      >
        Tap to see translation
      </TextThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  cardFront: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  wordWithPronunciation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dutchWord: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  partOfSpeech: {
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  tapHint: {
    fontSize: 14,
    textAlign: 'center',
  },
})
