import React from 'react'
import { TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function HeaderSection({
  word,
  config,
  isPlayingAudio,
  onPlayPronunciation,
}: WordSectionProps) {
  if (!config.showHeader) return null

  const getTTSUrl = (): string | null => {
    if ('tts_url' in word && typeof word.tts_url === 'string')
      return word.tts_url
    if ('audio_url' in word && typeof word.audio_url === 'string')
      return word.audio_url
    return null
  }

  const ttsUrl = getTTSUrl()
  const canPlayAudio =
    config.enablePronunciation && ttsUrl && onPlayPronunciation

  return (
    <ViewThemed style={styles.headerSection}>
      <ViewThemed style={styles.headerRow}>
        <TextThemed
          style={[styles.wordTitle, config.compact && styles.compactWordTitle]}
        >
          {word.dutch_lemma || 'Unknown'}
        </TextThemed>

        {canPlayAudio && (
          <TouchableOpacity
            style={styles.pronunciationButton}
            onPress={() => onPlayPronunciation(ttsUrl)}
            disabled={isPlayingAudio}
          >
            <Ionicons
              name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
              size={20}
              color={Colors.primary.DEFAULT}
            />
          </TouchableOpacity>
        )}
      </ViewThemed>

      {config.showGrammarInfo && (
        <ViewThemed style={styles.grammarInfo}>
          <ViewThemed style={styles.grammarTag}>
            <TextThemed style={styles.grammarTagText}>
              {word.part_of_speech || 'unknown'}
            </TextThemed>
          </ViewThemed>

          {word.article && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText}>
                {word.article}
              </TextThemed>
            </ViewThemed>
          )}

          {word.plural && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText}>
                plural: {word.plural}
              </TextThemed>
            </ViewThemed>
          )}

          {word.is_irregular && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText}>irregular</TextThemed>
            </ViewThemed>
          )}

          {word.is_reflexive && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText}>reflexive</TextThemed>
            </ViewThemed>
          )}

          {word.is_expression && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText}>
                {word.expression_type || 'expression'}
              </TextThemed>
            </ViewThemed>
          )}

          {word.preposition && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText}>
                + {word.preposition}
              </TextThemed>
            </ViewThemed>
          )}
        </ViewThemed>
      )}

      {word.is_separable && word.prefix_part && word.root_verb && (
        <ViewThemed style={styles.separableInfo}>
          <TextThemed style={styles.separableText}>
            <TextThemed style={styles.prefixText}>
              {word.prefix_part}
            </TextThemed>
            {' + '}
            {word.root_verb}
          </TextThemed>
        </ViewThemed>
      )}
    </ViewThemed>
  )
}
