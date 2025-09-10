import React, { useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  StatusBar,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import CollectionStats from '@/components/CollectionStats'
import CollectionReviewButton from '@/components/CollectionReviewButton'
import SwipeableWordItem from '@/components/SwipeableWordItem'
import WordDetailModal from '@/components/WordDetailModal'
import type { Word } from '@/types/database'

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Word>)

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  const scrollY = useSharedValue(0)

  const { words, collections, fetchWords, fetchCollections, deleteWord } =
    useAppStore()

  const collection = collections.find(c => c.collection_id === id)
  const collectionWords = words
    .filter(word => word.collection_id === id)
    .sort((a, b) => {
      const wordA = a.dutch_lemma.toLowerCase()
      const wordB = b.dutch_lemma.toLowerCase()
      return wordA.localeCompare(wordB)
    })

  const stats = {
    totalWords: collectionWords.length,
    masteredWords: collectionWords.filter(w => w.repetition_count > 2).length,
    wordsForReview: collectionWords.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    newWords: collectionWords.filter(w => w.repetition_count === 0).length,
  }

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y
  })

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 295], // Only animate based on content height, not status bar
      [0, -295],
      Extrapolation.CLAMP
    )

    return {
      transform: [{ translateY }],
    }
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchWords(), fetchCollections()])
    } catch {
      ToastService.showError(
        ToastMessageType.NETWORK_ERROR,
        'Failed to refresh data'
      )
    } finally {
      setRefreshing(false)
    }
  }

  const handleWordPress = (word: Word) => {
    setSelectedWord(word)
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setSelectedWord(null)
  }

  const handleStartReview = () => {
    // TODO: Uncomment this when we have haptic feedback
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (stats.wordsForReview === 0) {
      ToastService.showInfo(
        ToastMessageType.NO_WORDS_FOR_REVIEW,
        'No words are due for review in this collection'
      )
      return
    }
    router.push('/(tabs)/review')
  }

  const handleDeleteWord = async (wordId: string) => {
    try {
      await deleteWord(wordId)
      ToastService.showSuccess(ToastMessageType.WORD_DELETED)
    } catch (error: any) {
      ToastService.showError(
        ToastMessageType.DELETE_WORD_FAILED,
        error.message || 'Could not delete word'
      )
    }
  }

  const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0
  const HEADER_HEIGHT = 295 + STATUS_BAR_HEIGHT // Height of CollectionStats + CollectionReviewButton with margins + status bar

  if (!collection) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Collection not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: collection?.name || 'Collection',
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.container}>
        <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
          <CollectionStats stats={stats} />
          <CollectionReviewButton
            wordsForReview={stats.wordsForReview}
            onPress={handleStartReview}
          />
        </Animated.View>

        <AnimatedFlatList
          style={styles.wordsSection}
          contentContainerStyle={{ paddingTop: HEADER_HEIGHT }}
          data={collectionWords}
          keyExtractor={(item: Word) => item.word_id}
          renderItem={({ item, index }: { item: Word; index: number }) => (
            <SwipeableWordItem
              word={item}
              index={index}
              onPress={() => handleWordPress(item)}
              onDelete={handleDeleteWord}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No words in this collection</Text>
              <Text style={styles.emptySubtext}>
                Add some words to get started
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        />
      </View>

      <WordDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={selectedWord}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1, // Ensures header stays above the list
    paddingTop: StatusBar.currentHeight || 0,
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
    color: '#374151',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 16,
  },
  backButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
})
