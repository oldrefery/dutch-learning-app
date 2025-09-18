import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { PronunciationButton } from './PronunciationButton'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { Colors } from '@/constants/Colors'
import type { ReviewCardProps } from './types'

interface WordHeaderProps extends ReviewCardProps {
  isPlayingAudio: boolean
  onPlayPronunciation: (url: string) => void
  pronunciationRef?: React.RefObject<any>
}

export function WordHeader({
  currentWord,
  isPlayingAudio,
  onPlayPronunciation,
  pronunciationRef,
}: WordHeaderProps) {
  const detectSeparableVerbFallback = () => {
    const separablePrefixes = [
      'aan',
      'af',
      'bij',
      'door',
      'in',
      'mee',
      'na',
      'om',
      'onder',
      'op',
      'over',
      'toe',
      'uit',
      'vast',
      'weg',
      'voorbij',
      'terug',
      'voor',
    ]
    const lemma = currentWord.dutch_lemma

    for (const prefix of separablePrefixes) {
      if (lemma.startsWith(prefix)) {
        const root = lemma.substring(prefix.length)
        if (root.length >= 3) {
          return { prefix, root }
        }
      }
    }
    return null
  }

  const getSeparableVerbInfo = () => {
    // Use database data first
    if (
      currentWord.is_separable &&
      currentWord.prefix_part &&
      currentWord.root_verb
    ) {
      return {
        prefix: currentWord.prefix_part,
        root: currentWord.root_verb,
      }
    }

    // Frontend fallback for old words
    if (currentWord.part_of_speech === 'verb') {
      return detectSeparableVerbFallback()
    }

    return null
  }

  const buildMetadataText = () => {
    const parts = [currentWord.part_of_speech]

    if (currentWord.is_irregular) parts.push('irregular')
    if (currentWord.is_reflexive) parts.push('reflexive')

    const separableInfo = getSeparableVerbInfo()
    if (separableInfo) {
      parts.push(`separable (${separableInfo.prefix} + ${separableInfo.root})`)
    }

    if (currentWord.is_expression) {
      parts.push(currentWord.expression_type || 'expression')
    }

    return parts.join(' • ')
  }

  return (
    <ViewThemed style={styles.wordHeader}>
      <ViewThemed style={styles.wordWithPronunciationSmall}>
        <TextThemed style={styles.dutchWordSmall}>
          {currentWord.article ? `${currentWord.article} ` : ''}
          {currentWord.dutch_lemma}
        </TextThemed>
        <NonSwipeableArea>
          <PronunciationButton
            ref={pronunciationRef}
            ttsUrl={currentWord.tts_url}
            isPlayingAudio={isPlayingAudio}
            onPress={onPlayPronunciation}
            size="small"
          />
        </NonSwipeableArea>
      </ViewThemed>

      <ViewThemed style={styles.metadataRow}>
        <TextThemed style={styles.metadataText}>
          {buildMetadataText()}
        </TextThemed>
      </ViewThemed>
    </ViewThemed>
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
    color: Colors.neutral[700],
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metadataText: {
    fontSize: 14,
    color: Colors.neutral[500],
    fontStyle: 'italic',
  },
})
