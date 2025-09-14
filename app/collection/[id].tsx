import React, { useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import { Colors } from '@/constants/Colors'
import CollectionStats from '@/components/CollectionStats'
import CollectionReviewButton from '@/components/CollectionReviewButton'
import SwipeableWordItem from '@/components/SwipeableWordItem'
import WordDetailModal from '@/components/WordDetailModal'
import type { Word } from '@/types/database'

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

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

  // Clean approach - no need for manual height calculations

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
          headerStyle: {
            backgroundColor: Colors.background.secondary,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
        }}
      />
      <View style={styles.container}>
        <FlatList
          style={styles.wordsSection}
          data={collectionWords}
          ListHeaderComponent={() => (
            <View style={styles.headerContent}>
              <CollectionStats stats={stats} />
              <CollectionReviewButton
                wordsForReview={stats.wordsForReview}
                onPress={handleStartReview}
              />
            </View>
          )}
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
              <Ionicons
                name="book-outline"
                size={48}
                color={Colors.neutral[400]}
              />
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
    backgroundColor: Colors.background.secondary,
  },
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
    color: Colors.neutral[700],
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.neutral[500],
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
    color: Colors.error.DEFAULT,
    marginBottom: 16,
  },
  backButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  backButtonText: {
    color: Colors.primary.DEFAULT,
    fontSize: 16,
    fontWeight: '500',
  },
})
