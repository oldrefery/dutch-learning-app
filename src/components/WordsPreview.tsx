import React from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { SharedCollectionWords } from '@/services/collectionSharingService'

interface WordsPreviewProps {
  sharedData: SharedCollectionWords
  previewCount?: number
}

export function WordsPreview({
  sharedData,
  previewCount = 5,
}: WordsPreviewProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <ViewThemed style={styles.wordsSection}>
      <TextThemed style={styles.sectionTitle}>Words Preview</TextThemed>
      {sharedData.words.slice(0, previewCount).map(word => (
        <ViewThemed
          key={word.word_id}
          style={[
            styles.wordItem,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundSecondary
                  : Colors.neutral[50],
              borderColor:
                colorScheme === 'dark'
                  ? Colors.dark.border
                  : Colors.neutral[200],
            },
          ]}
        >
          <TextThemed style={styles.wordDutch}>{word.dutch_lemma}</TextThemed>
          <TextThemed
            style={styles.wordEnglish}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            {word.translations.en[0] || 'No translation'}
          </TextThemed>
        </ViewThemed>
      ))}

      {sharedData.words.length > previewCount && (
        <TextThemed
          style={styles.moreWords}
          lightColor={Colors.neutral[500]}
          darkColor={Colors.dark.textTertiary}
        >
          ... and {sharedData.words.length - previewCount} more words
        </TextThemed>
      )}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  wordsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  wordItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  wordDutch: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  wordEnglish: {
    fontSize: 14,
  },
  moreWords: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
})
