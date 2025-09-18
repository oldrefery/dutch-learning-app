import React from 'react'
import { TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { CopyButton } from '@/components/CopyButton'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { formatWordForCopying } from '@/utils/wordTextFormatter'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function HeaderSection({
  word,
  config,
  isPlayingAudio,
  onPlayPronunciation,
}: WordSectionProps) {
  if (!config.showHeader) {
    return null
  }

  const getTTSUrl = (): string | null => {
    if ('tts_url' in word && word.tts_url) return word.tts_url
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
          selectable
        >
          {word.dutch_lemma || 'Unknown'}
        </TextThemed>

        <NonSwipeableArea style={styles.headerActions}>
          <CopyButton
            text={formatWordForCopying(word)}
            size={22}
            color={Colors.primary.DEFAULT}
          />
          {canPlayAudio && (
            <TouchableOpacity
              style={styles.pronunciationButton}
              onPress={() => {
                console.log('🔊 PRONUNCIATION BUTTON: onPress triggered')
                onPlayPronunciation(ttsUrl)
              }}
              disabled={isPlayingAudio}
            >
              <Ionicons
                name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
                size={20}
                color={Colors.primary.DEFAULT}
              />
            </TouchableOpacity>
          )}
        </NonSwipeableArea>
      </ViewThemed>

      {config.showGrammarInfo && (
        <ViewThemed style={styles.grammarInfo}>
          <ViewThemed style={styles.grammarTag}>
            <TextThemed style={styles.grammarTagText} selectable>
              {word.part_of_speech || 'unknown'}
            </TextThemed>
          </ViewThemed>

          {word.article && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                {word.article}
              </TextThemed>
            </ViewThemed>
          )}

          {'plural' in word && word.plural && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                plural: {word.plural}
              </TextThemed>
            </ViewThemed>
          )}

          {word.is_irregular && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                irregular
              </TextThemed>
            </ViewThemed>
          )}

          {word.is_reflexive && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                reflexive
              </TextThemed>
            </ViewThemed>
          )}

          {word.is_expression && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                {word.expression_type || 'expression'}
              </TextThemed>
            </ViewThemed>
          )}

          {'preposition' in word && word.preposition && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                + {word.preposition}
              </TextThemed>
            </ViewThemed>
          )}
        </ViewThemed>
      )}

      {word.is_separable && word.prefix_part && word.root_verb && (
        <ViewThemed style={styles.separableInfo}>
          <TextThemed style={styles.separableText} selectable>
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
