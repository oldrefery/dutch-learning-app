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
