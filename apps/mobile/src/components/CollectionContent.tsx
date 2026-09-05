import React, { useRef, useEffect, useState, useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  useColorScheme,
  StyleSheet,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import CollectionStats from '@/components/CollectionStats'
import CollectionReviewButton from '@/components/CollectionReviewButton'
import CollectionSearchBar from '@/components/CollectionSearchBar'
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
  onWordLongPress?: (word: Word) => void
  moveModalVisible?: boolean
  wordBeingMoved?: string | null
  highlightWordId?: string
  onScrollYChange?: (y: number) => void
  topInset?: number
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
  onWordLongPress,
  moveModalVisible,
  wordBeingMoved,
  highlightWordId,
  onScrollYChange,
  topInset,
}: CollectionContentProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const flatListRef = useRef<FlatList>(null)
  const scrollRetryRef = useRef(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) {
      return words
    }

    const query = searchQuery.toLowerCase().trim()

    return words.filter(word => word.dutch_lemma.toLowerCase().includes(query))
  }, [words, searchQuery])

  // Scroll to highlighted word when component mounts or words change
  useEffect(() => {
    // Clear any pending retry timer from previous scroll attempt
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    if (!highlightWordId || filteredWords.length === 0) return

    const wordIndex = filteredWords.findIndex(
      word => word.word_id === highlightWordId
    )
    if (wordIndex === -1) return

    // Reset retry guard for each new scroll request
    scrollRetryRef.current = false

    // Delay to ensure FlatList has rendered enough items
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: wordIndex,
        animated: true,
        viewPosition: 0.3,
      })
    }, 600)

    return () => {
      clearTimeout(timer)
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [highlightWordId, filteredWords])

  const ListHeaderComponent = () => (
    <ViewThemed style={styles.headerContent}>
      <CollectionStats stats={stats} />
      <CollectionReviewButton
        wordsForReview={stats.wordsForReview}
        onPress={onStartReview}
      />
      <CollectionSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search Dutch words..."
        resultCount={filteredWords.length}
        totalCount={words.length}
      />
    </ViewThemed>
  )

  const renderEmptyComponent = () => {
    const isSearching = searchQuery.trim().length > 0

    return (
      <ViewThemed style={styles.emptyContainer}>
        <Ionicons
          name={isSearching ? 'search-outline' : 'book-outline'}
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
          {isSearching ? 'No words found' : 'No words in this collection'}
        </TextThemed>
        <TextThemed
          style={styles.emptySubtext}
          lightColor={Colors.neutral[500]}
          darkColor={Colors.dark.textSecondary}
        >
          {isSearching
            ? `No words match "${searchQuery}"`
            : 'Add some words to get started'}
        </TextThemed>
      </ViewThemed>
    )
  }

  const keyExtractor = (item: Word) => item.word_id

  const renderItem = ({ item, index }: { item: Word; index: number }) => {
    const isLast = index === filteredWords.length - 1

    return (
      <ViewThemed>
        <SwipeableWordItem
          word={item}
          index={index}
          onPress={() => onWordPress(item)}
          onDelete={onDeleteWord}
          onMoveToCollection={onMoveToCollection}
          onLongPress={() => onWordLongPress?.(item)}
          moveModalVisible={moveModalVisible}
          wordBeingMoved={wordBeingMoved}
          highlighted={highlightWordId === item.word_id}
        />
        {!isLast && (
          <ViewThemed
            style={styles.separator}
            lightColor={Colors.light.separator}
            darkColor={Colors.dark.separator}
          />
        )}
      </ViewThemed>
    )
  }

  return (
    <FlatList
      ref={flatListRef}
      style={styles.wordsSection}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: Platform.OS === 'android' ? (topInset ?? 0) : 0,
      }}
      data={filteredWords}
      ListHeaderComponent={ListHeaderComponent}
      keyExtractor={keyExtractor}
      onScroll={event => {
        const y = event.nativeEvent.contentOffset.y
        onScrollYChange?.(y)
      }}
      scrollEventThrottle={16}
      onScrollToIndexFailed={info => {
        // Guard against infinite retry loop
        if (scrollRetryRef.current) return
        scrollRetryRef.current = true

        // Scroll to estimated offset first to force rendering items near target
        flatListRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        })
        // Retry after items at the target offset are rendered
        retryTimerRef.current = setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: info.index,
            animated: true,
            viewPosition: 0.3,
          })
        }, 300)
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

const styles = StyleSheet.create({
  headerContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  wordsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  separator: {
    height: 1,
    marginLeft: 16,
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
})
