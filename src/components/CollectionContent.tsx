import React from 'react'
import { FlatList, RefreshControl, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import CollectionStats from '@/components/CollectionStats'
import CollectionReviewButton from '@/components/CollectionReviewButton'
import SwipeableWordItem from '@/components/SwipeableWordItem'
import type { Word } from '@/types/database'

interface CollectionStatsData {
  totalWords: number
  masteredWords: number
  wordsForReview: number
  newWords: number
}

interface CollectionContentProps {
  words: Word[]
  stats: CollectionStatsData
  refreshing: boolean
  onRefresh: () => void
  onWordPress: (word: Word) => void
  onDeleteWord: (wordId: string) => void
  onStartReview: () => void
  onMoveToCollection?: (wordId: string) => void
  moveModalVisible?: boolean
  wordBeingMoved?: string | null
}

export default function CollectionContent({
  words,
  stats,
  refreshing,
  onRefresh,
  onWordPress,
  onDeleteWord,
  onStartReview,
  onMoveToCollection,
  moveModalVisible,
  wordBeingMoved,
}: CollectionContentProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const renderHeader = () => (
    <ViewThemed style={styles.headerContent}>
      <CollectionStats stats={stats} />
      <CollectionReviewButton
        wordsForReview={stats.wordsForReview}
        onPress={onStartReview}
      />
    </ViewThemed>
  )

  const renderEmptyComponent = () => (
    <ViewThemed style={styles.emptyContainer}>
      <Ionicons
        name="book-outline"
        size={48}
        color={
          colorScheme === 'dark'
            ? Colors.dark.textTertiary
            : Colors.neutral[400]
        }
      />
      <TextThemed
        style={styles.emptyText}
        lightColor={Colors.neutral[700]}
        darkColor={Colors.dark.text}
      >
        No words in this collection
      </TextThemed>
      <TextThemed
        style={styles.emptySubtext}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        Add some words to get started
      </TextThemed>
    </ViewThemed>
  )

  return (
    <FlatList
      style={styles.wordsSection}
      data={words}
      ListHeaderComponent={renderHeader}
      keyExtractor={(item: Word) => item.word_id}
      renderItem={({ item, index }: { item: Word; index: number }) => (
        <SwipeableWordItem
          word={item}
          index={index}
          onPress={() => onWordPress(item)}
          onDelete={onDeleteWord}
          onMoveToCollection={onMoveToCollection}
          moveModalVisible={moveModalVisible}
          wordBeingMoved={wordBeingMoved}
        />
      )}
      ListEmptyComponent={renderEmptyComponent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = {
  headerContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  wordsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center' as const,
  },
}
