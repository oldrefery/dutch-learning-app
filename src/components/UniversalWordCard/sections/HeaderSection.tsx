import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { CopyButton } from '@/components/CopyButton'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { formatWordForCopying } from '@/utils/wordTextFormatter'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

// Audio button component with gesture blocking
interface AudioButtonProps {
  ttsUrl: string
  isPlayingAudio: boolean
  onPress: (url: string) => void
}

function AudioButton({ ttsUrl, isPlayingAudio, onPress }: AudioButtonProps) {
  const handleAudioPress = () => {
    if (!isPlayingAudio) {
      onPress(ttsUrl)
    }
  }

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet'
      scheduleOnRN(handleAudioPress)
    })
    .blocksExternalGesture()

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={styles.pronunciationButton}>
        <Ionicons
          name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
          size={20}
          color={Colors.primary.DEFAULT}
        />
      </View>
    </GestureDetector>
  )
}

export function HeaderSection({
  word,
  config,
  metadata,
  onForceRefresh,
  isPlayingAudio,
  onPlayPronunciation,
}: WordSectionProps) {
  const getTTSUrl = (): string | null => {
    if ('tts_url' in word && word.tts_url) return word.tts_url
    return null
  }

  const ttsUrl = getTTSUrl()
  const canPlayAudio =
    config.enablePronunciation && ttsUrl && onPlayPronunciation

  return (
    <ViewThemed style={styles.headerSection}>
      <ViewThemed style={styles.headerActionsRow}>
        <NonSwipeableArea style={styles.headerActions}>
          {/* Cache Status Badge */}
          {metadata && (
            <ViewThemed style={styles.cacheStatusContainer}>
              <ViewThemed
                style={[
                  styles.cacheBadge,
                  metadata.source === 'cache'
                    ? styles.cacheBadgeFromCache
                    : styles.cacheBadgeFromGemini,
                ]}
              >
                <TextThemed style={styles.cacheBadgeText}>
                  {metadata.source === 'cache' ? '📁 Cache' : '🤖 AI'}
                </TextThemed>
              </ViewThemed>

              {/* Force Refresh Button - only show for cached results */}
              {metadata.source === 'cache' && onForceRefresh && (
                <TouchableOpacity
                  style={styles.forceRefreshButton}
                  onPress={onForceRefresh}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={Colors.primary.DEFAULT}
                  />
                </TouchableOpacity>
              )}
            </ViewThemed>
          )}

          <CopyButton
            text={formatWordForCopying(word)}
            size={22}
            color={Colors.primary.DEFAULT}
          />
          {canPlayAudio && (
            <AudioButton
              ttsUrl={ttsUrl}
              isPlayingAudio={isPlayingAudio || false}
              onPress={onPlayPronunciation}
            />
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

          {word.is_separable && (
            <ViewThemed style={styles.grammarTag}>
              <TextThemed style={styles.grammarTagText} selectable>
                separable
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

      {/* Cache Timestamp - subtle display for cached data */}
      {metadata && metadata.source === 'cache' && metadata.cached_at && (
        <ViewThemed style={styles.cacheTimestamp}>
          <TextThemed style={styles.cacheTimestampText}>
            Cached: {new Date(metadata.cached_at).toLocaleDateString()}
          </TextThemed>
        </ViewThemed>
      )}
    </ViewThemed>
  )
}
