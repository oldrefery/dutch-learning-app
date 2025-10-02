/**
 * Word Analysis History Section
 * Shows recently analyzed words with collection info
 */

import React from 'react'
import { StyleSheet, FlatList, useColorScheme } from 'react-native'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { formatRelativeTime } from '@/utils/dateUtils'

export function WordAnalysisHistorySection() {
  const colorScheme = useColorScheme() ?? 'light'
  const analyzedWords = useHistoryStore(state => state.analyzedWords)

  if (analyzedWords.length === 0) {
    return (
      <ViewThemed
        style={styles.section}
        lightColor={Colors.background.secondary}
        darkColor={Colors.dark.backgroundSecondary}
      >
        <TextThemed style={styles.sectionTitle}>Recently Analyzed</TextThemed>
        <TextThemed
          style={styles.emptyText}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          No recently analyzed words
        </TextThemed>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed
      style={styles.section}
      lightColor={Colors.background.secondary}
      darkColor={Colors.dark.backgroundSecondary}
    >
      <TextThemed style={styles.sectionTitle}>Recently Analyzed</TextThemed>
      <FlatList
        data={analyzedWords}
        keyExtractor={item => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <ViewThemed style={styles.wordItem}>
            <ViewThemed style={styles.wordHeader}>
              <TextThemed style={styles.wordLemma}>
                {item.dutchLemma}
              </TextThemed>
              <TextThemed
                style={styles.wordTime}
                lightColor={Colors.neutral[500]}
                darkColor={Colors.dark.textSecondary}
              >
                {formatRelativeTime(new Date(item.timestamp))}
              </TextThemed>
            </ViewThemed>
            <ViewThemed style={styles.wordDetails}>
              <TextThemed
                style={styles.wordOriginal}
                lightColor={Colors.neutral[600]}
                darkColor={Colors.dark.textSecondary}
              >
                {item.word !== item.dutchLemma && `"${item.word}"`}
              </TextThemed>
              <TextThemed
                style={[
                  styles.collectionBadge,
                  item.wasAdded
                    ? {
                        color:
                          colorScheme === 'dark'
                            ? Colors.success.dark
                            : Colors.success.DEFAULT,
                      }
                    : {
                        color:
                          colorScheme === 'dark'
                            ? Colors.neutral[500]
                            : Colors.neutral[600],
                      },
                ]}
              >
                {item.wasAdded ? `✓ ${item.addedToCollection}` : 'Not added'}
              </TextThemed>
            </ViewThemed>
          </ViewThemed>
        )}
        ItemSeparatorComponent={() => (
          <ViewThemed
            style={styles.separator}
            lightColor={Colors.neutral[200]}
            darkColor={Colors.dark.border}
          />
        )}
      />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  wordItem: {
    paddingVertical: 12,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  wordLemma: {
    fontSize: 16,
    fontWeight: '600',
  },
  wordTime: {
    fontSize: 12,
  },
  wordDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordOriginal: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  collectionBadge: {
    fontSize: 13,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
})
