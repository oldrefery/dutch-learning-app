import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { PronunciationButton } from '@/components/ReviewCard/PronunciationButton'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { Word } from '@/types/database'
import type { RecognitionOption } from '@/utils/reviewDistractors'

interface RecognitionCardProps {
  word: Word
  options: RecognitionOption[]
  selectedOptionId: string | null
  isPlayingAudio: boolean
  onPlayPronunciation: (url?: string) => void
  onSelectOption: (option: RecognitionOption) => void
  pronunciationRef?: React.RefObject<View | null>
}

export function RecognitionCard({
  word,
  options,
  selectedOptionId,
  isPlayingAudio,
  onPlayPronunciation,
  onSelectOption,
  pronunciationRef,
}: RecognitionCardProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const displayWord =
    word.part_of_speech === 'noun' && word.article
      ? `${word.article} ${word.dutch_lemma}`
      : word.dutch_lemma

  return (
    <ViewThemed style={styles.container} testID="recognition-card">
      <TextThemed
        style={styles.eyebrow}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        Choose the correct meaning
      </TextThemed>
      <View style={styles.wordRow}>
        <TextThemed style={styles.word}>{displayWord}</TextThemed>
        <NonSwipeableArea>
          <PronunciationButton
            ref={pronunciationRef}
            ttsUrl={word.tts_url}
            isPlayingAudio={isPlayingAudio}
            onPress={onPlayPronunciation}
          />
        </NonSwipeableArea>
      </View>

      <NonSwipeableArea style={styles.options}>
        {options.map((option, index) => {
          const isSelected = selectedOptionId === option.id

          return (
            <Pressable
              key={option.id}
              testID={`recognition-option-${index}`}
              onPress={() => onSelectOption(option)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint="Selects this translation as your answer"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: isSelected
                    ? colorScheme === 'dark'
                      ? Colors.transparent.primary20
                      : Colors.primary.light
                    : theme.backgroundSecondary,
                  borderColor: isSelected ? theme.tint : theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <TextThemed style={styles.optionText}>{option.label}</TextThemed>
            </Pressable>
          )
        })}
      </NonSwipeableArea>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
    paddingBottom: 110,
  },
  eyebrow: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.LG,
  },
  word: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.XXLARGE,
    fontWeight: '700',
    lineHeight: 40,
    textAlign: 'center',
  },
  options: {
    gap: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },
  option: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },
  optionText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
})
