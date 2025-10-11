/**
 * Word Analysis History Section
 * Shows recently analyzed words with collection info
 */

import React from 'react'
import {
  StyleSheet,
  FlatList,
  useColorScheme,
  TouchableOpacity,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { formatRelativeTime } from '@/utils/dateUtils'

interface WordAnalysisHistorySectionProps {
  onWordPress: (dutchLemma: string) => void
}

export function WordAnalysisHistorySection({
  onWordPress,
}: WordAnalysisHistorySectionProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const analyzedWords = useHistoryStore(state => state.analyzedWords)

  const isDarkMode = colorScheme === 'dark'
  const blurBackgroundDark = Colors.transparent.iosDarkSurface95
  const blurBackgroundLight = Colors.transparent.white95
  const separatorDark = Colors.transparent.white10
  const separatorLight = Colors.transparent.black05

  if (analyzedWords.length === 0) {
    return (
      <ViewThemed style={styles.sectionContainer}>
        <BlurView
          style={styles.sectionBlur}
          intensity={100}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod={'dimezisBlurView'}
        >
          <ViewThemed
            style={[
              styles.section,
              {
                backgroundColor: isDarkMode
                  ? blurBackgroundDark
                  : blurBackgroundLight,
                borderColor: isDarkMode ? separatorDark : separatorLight,
              },
            ]}
          >
            <TextThemed style={styles.sectionTitle}>
              Recently Analyzed
            </TextThemed>
            <TextThemed
              style={styles.emptyText}
              lightColor={Colors.neutral[600]}
              darkColor={Colors.dark.textSecondary}
            >
              No recently analyzed words
            </TextThemed>
          </ViewThemed>
        </BlurView>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed style={styles.sectionContainer}>
      <BlurView
        style={styles.sectionBlur}
        intensity={100}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod={'dimezisBlurView'}
      >
        <ViewThemed
          style={[
            styles.section,
            {
              backgroundColor: isDarkMode
                ? blurBackgroundDark
                : blurBackgroundLight,
              borderColor: isDarkMode ? separatorDark : separatorLight,
            },
          ]}
        >
          <TextThemed style={styles.sectionTitle}>Recently Analyzed</TextThemed>
          <FlatList
            data={analyzedWords}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onWordPress(item.dutchLemma)}
                activeOpacity={0.7}
              >
                <ViewThemed
                  style={styles.wordItem}
                  lightColor="transparent"
                  darkColor="transparent"
                >
                  <ViewThemed
                    style={styles.wordHeader}
                    lightColor="transparent"
                    darkColor="transparent"
                  >
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
                  <ViewThemed
                    style={styles.wordDetails}
                    lightColor="transparent"
                    darkColor="transparent"
                  >
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
                      {item.wasAdded
                        ? `✓ ${item.addedToCollection}`
                        : 'Not added'}
                    </TextThemed>
                  </ViewThemed>
                </ViewThemed>
              </TouchableOpacity>
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
      </BlurView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: 'transparent',
  },
  sectionBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
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
