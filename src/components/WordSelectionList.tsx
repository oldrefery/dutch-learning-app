import React from 'react'
import { TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface WordSelection {
  word: {
    word_id: string
    dutch_lemma: string
    translations: {
      en: string[]
    }
  }
  selected: boolean
  isDuplicate: boolean
  existingInCollection?: string
}

interface WordSelectionListProps {
  wordSelections: WordSelection[]
  onToggleWord: (wordId: string) => void
}

export function WordSelectionList({
  wordSelections,
  onToggleWord,
}: WordSelectionListProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const getItemBackgroundColor = (item: WordSelection) => {
    if (item.isDuplicate) {
      return colorScheme === 'dark'
        ? Colors.dark.backgroundSecondary
        : Colors.neutral[100]
    }
    if (item.selected) {
      return colorScheme === 'dark' ? Colors.primary.dark : Colors.primary.light
    }
    return colorScheme === 'dark'
      ? Colors.dark.backgroundSecondary
      : Colors.neutral[50]
  }

  const getItemBorderColor = (item: WordSelection) => {
    if (item.isDuplicate) {
      return colorScheme === 'dark' ? Colors.dark.border : Colors.neutral[300]
    }
    if (item.selected) {
      return Colors.primary.DEFAULT
    }
    return colorScheme === 'dark' ? Colors.dark.border : Colors.neutral[200]
  }

  const getIconName = (item: WordSelection) => {
    if (item.isDuplicate || item.selected) {
      return 'checkmark-circle'
    }
    return 'ellipse-outline'
  }

  const getIconColor = (item: WordSelection) => {
    if (item.isDuplicate) {
      return colorScheme === 'dark'
        ? Colors.dark.textTertiary
        : Colors.neutral[400]
    }
    if (item.selected) {
      return Colors.primary.DEFAULT
    }
    return colorScheme === 'dark'
      ? Colors.dark.textTertiary
      : Colors.neutral[400]
  }

  return (
    <ViewThemed style={styles.wordsSection}>
      <TextThemed style={styles.sectionTitle}>Words</TextThemed>
      {wordSelections.map(item => (
        <TouchableOpacity
          key={item.word.word_id}
          style={[
            styles.wordItem,
            {
              backgroundColor: getItemBackgroundColor(item),
              borderColor: getItemBorderColor(item),
              opacity: item.isDuplicate ? 0.6 : 1,
            },
          ]}
          onPress={() => onToggleWord(item.word.word_id)}
          disabled={item.isDuplicate}
        >
          <ViewThemed style={styles.wordContent}>
            <ViewThemed style={styles.wordInfo}>
              <TextThemed
                style={[
                  styles.wordDutch,
                  item.isDuplicate && {
                    color:
                      colorScheme === 'dark'
                        ? Colors.dark.textTertiary
                        : Colors.neutral[400],
                  },
                ]}
              >
                {item.word.dutch_lemma}
              </TextThemed>
              <TextThemed
                style={[
                  styles.wordEnglish,
                  item.isDuplicate && {
                    color:
                      colorScheme === 'dark'
                        ? Colors.dark.textTertiary
                        : Colors.neutral[400],
                  },
                ]}
                lightColor={
                  item.isDuplicate ? Colors.neutral[400] : Colors.neutral[600]
                }
                darkColor={
                  item.isDuplicate
                    ? Colors.dark.textTertiary
                    : Colors.dark.textSecondary
                }
              >
                {item.word.translations.en[0] || 'No translation'}
              </TextThemed>
              {item.isDuplicate && (
                <TextThemed
                  style={styles.duplicateLabel}
                  lightColor={Colors.neutral[500]}
                  darkColor={Colors.dark.textTertiary}
                >
                  {`Already in ${item.existingInCollection}`}
                </TextThemed>
              )}
            </ViewThemed>
            <Ionicons
              name={getIconName(item)}
              size={24}
              color={getIconColor(item)}
            />
          </ViewThemed>
        </TouchableOpacity>
      ))}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  wordsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  wordItem: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  wordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  wordInfo: {
    flex: 1,
  },
  wordDutch: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  wordEnglish: {
    fontSize: 14,
  },
  duplicateLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
})
