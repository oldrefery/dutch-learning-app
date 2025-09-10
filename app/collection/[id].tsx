import React, { useState, useRef } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import CollectionStats from '@/components/CollectionStats'
import CollectionReviewButton from '@/components/CollectionReviewButton'
import SwipeableWordItem from '@/components/SwipeableWordItem'
import type { Word } from '@/types/database'

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [refreshing, setRefreshing] = useState(false)
  const { words, collections, fetchWords, fetchCollections, deleteWord } =
    useAppStore()
  const scrollY = useRef(new Animated.Value(0)).current

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

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchWords(), fetchCollections()])
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to refresh data',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handleWordPress = (word: Word) => {
    // TODO: Navigate to word detail screen
    Toast.show({
      type: 'info',
      text1: 'Word Detail',
      text2: `Viewing "${word.dutch_original || word.dutch_lemma}"`,
    })
  }

  const handleStartReview = () => {
    if (stats.wordsForReview === 0) {
      Toast.show({
        type: 'info',
        text1: 'No Words',
        text2: 'No words are due for review in this collection',
      })
      return
    }
    // Navigate to review screen
    router.push('/(tabs)/review')
  }

  const handleDeleteWord = async (wordId: string) => {
    try {
      await deleteWord(wordId)
      Toast.show({
        type: 'success',
        text1: 'Word Deleted',
        text2: 'Word has been removed from collection',
      })
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: error.message || 'Could not delete word',
      })
    }
  }

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
        <CollectionStats stats={stats} scrollY={scrollY} />
        <CollectionReviewButton
          wordsForReview={stats.wordsForReview}
          onPress={handleStartReview}
          scrollY={scrollY}
        />

        <Animated.View
          style={[
            styles.wordsSection,
            {
              paddingTop: scrollY.interpolate({
                inputRange: [0, 100],
                outputRange: [280, 16], // Start with space for stats, end with normal padding
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <Animated.FlatList
            data={collectionWords}
            keyExtractor={item => item.word_id}
            renderItem={({ item, index }) => (
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
                <Text style={styles.emptyText}>
                  No words in this collection
                </Text>
                <Text style={styles.emptySubtext}>
                  Add some words to get started
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          />
        </Animated.View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
