import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { Word } from '@/types/database'
import { isDueOnLocalDate } from '@/utils/dateUtils'

interface DifficultWordRowProps {
  word: Word
  onPress: () => void
}

export function DifficultWordRow({ word, onPress }: DifficultWordRowProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const isDue = isDueOnLocalDate(word.next_review_date)
  const translation = word.translations.en?.[0] ?? 'No translation'

  return (
    <Pressable
      testID={`difficult-word-${word.word_id}`}
      accessibilityRole="button"
      accessibilityLabel={`${word.dutch_original ?? word.dutch_lemma}, ${translation}, easiness factor ${word.easiness_factor.toFixed(2)}, ${isDue ? 'due now' : 'scheduled for later'}`}
      accessibilityHint="Opens word details without changing its review schedule"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.copy}>
        <TextThemed style={styles.word}>
          {word.dutch_original ?? word.dutch_lemma}
        </TextThemed>
        <TextThemed
          style={styles.translation}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          {translation}
        </TextThemed>
      </View>
      <View style={styles.metadata}>
        <TextThemed
          style={styles.factor}
          lightColor={isDue ? Colors.error.DEFAULT : Colors.neutral[600]}
          darkColor={isDue ? Colors.error.dark : Colors.dark.textSecondary}
        >
          EF {word.easiness_factor.toFixed(2)} · {isDue ? 'Due' : 'Later'}
        </TextThemed>
        <FontAwesome
          name="chevron-right"
          size={14}
          color={theme.tint}
          importantForAccessibility="no"
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  copy: {
    flex: 1,
  },
  word: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  translation: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factor: {
    fontSize: 12,
    fontWeight: '600',
  },
})
