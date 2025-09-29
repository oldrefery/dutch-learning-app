import React, { useRef, useEffect } from 'react'
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
  highlightWordId?: string
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
  highlightWordId,
}: CollectionContentProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const flatListRef = useRef<FlatList>(null)

  // Scroll to highlighted word when component mounts or words change
  useEffect(() => {
    if (highlightWordId && words.length > 0) {
      const wordIndex = words.findIndex(
        word => word.word_id === highlightWordId
      )
      if (wordIndex !== -1) {
        // Small delay to ensure FlatList is fully rendered
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: wordIndex,
            animated: true,
            viewPosition: 0.3, // Position highlighted item at 30% from the top
          })
        }, 500)

        return () => clearTimeout(timer)
      }
    }
  }, [highlightWordId, words])

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

  const keyExtractor = (item: Word) => item.word_id

  const renderItem = ({ item, index }: { item: Word; index: number }) => (
    <SwipeableWordItem
      word={item}
      index={index}
      onPress={() => onWordPress(item)}
      onDelete={onDeleteWord}
      onMoveToCollection={onMoveToCollection}
      moveModalVisible={moveModalVisible}
      wordBeingMoved={wordBeingMoved}
      highlighted={highlightWordId === item.word_id}
    />
  )

  return (
    <FlatList
      ref={flatListRef}
      style={styles.wordsSection}
      data={words}
      ListHeaderComponent={renderHeader}
      keyExtractor={keyExtractor}
      onScrollToIndexFailed={info => {
        // Fallback: scroll to offset if the index scroll fails
        const wait = new Promise(resolve => setTimeout(resolve, 500))
        wait.then(() => {
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          })
        })
      }}
      renderItem={renderItem}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
}
