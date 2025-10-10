import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { CopyButton } from '@/components/CopyButton'
import { GlassIconButton } from '@/components/glass/buttons/GlassIconButton'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { formatWordForCopying } from '@/utils/wordTextFormatter'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'
import { Colors } from '@/constants/Colors.ts'

// Audio button component following HIG guidelines
interface AudioButtonProps {
  ttsUrl: string
  isPlayingAudio: boolean
  onPress: (url: string) => void
}

function AudioButton({ ttsUrl, isPlayingAudio, onPress }: AudioButtonProps) {
  const handleAudioPress = React.useCallback(() => {
    if (!isPlayingAudio) {
      onPress(ttsUrl)
    }
  }, [isPlayingAudio, onPress, ttsUrl])

  return (
    <GlassIconButton
      icon={isPlayingAudio ? 'volume-high' : 'volume-medium'}
      onPress={handleAudioPress}
      variant="tinted"
      size="medium"
      disabled={isPlayingAudio}
      accessibilityLabel="Play pronunciation"
      accessibilityHint="Plays audio pronunciation of the word"
    />
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
                <GlassIconButton
                  icon="refresh"
                  onPress={onForceRefresh}
                  variant="tinted"
                  size="small"
                  accessibilityLabel="Force refresh"
                  accessibilityHint="Fetches fresh analysis from AI instead of using cache"
                />
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
