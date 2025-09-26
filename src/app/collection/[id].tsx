import React, { useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useImageSelector } from '@/hooks/useImageSelector'
import { Colors } from '@/constants/Colors'
import { sharingUtils } from '@/utils/sharingUtils'
import CollectionStats from '@/components/CollectionStats'
import CollectionReviewButton from '@/components/CollectionReviewButton'
import SwipeableWordItem from '@/components/SwipeableWordItem'
import WordDetailModal from '@/components/WordDetailModal'
import ImageSelector from '@/components/ImageSelector'
import type { Word } from '@/types/database'

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const colorScheme = useColorScheme() ?? 'light'

  const {
    words,
    collections,
    fetchWords,
    fetchCollections,
    deleteWord,
    updateWordImage,
    shareCollection,
    unshareCollection,
  } = useApplicationStore()

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()

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
      ToastService.show('Failed to refresh data', ToastType.ERROR)
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
      ToastService.show(
        'No words are due for review in this collection',
        ToastType.INFO
      )
      return
    }
    router.push('/(tabs)/review')
  }

  const handleDeleteWord = async (wordId: string) => {
    try {
      await deleteWord(wordId)
      ToastService.show('Word deleted', ToastType.SUCCESS)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not delete word'
      ToastService.show(errorMessage, ToastType.ERROR)
    }
  }

  const handleDeleteSelectedWord = async () => {
    if (selectedWord) {
      await handleDeleteWord(selectedWord.word_id)
      setModalVisible(false)
      setSelectedWord(null)
    }
  }

  const handleImageChange = async (imageUrl: string) => {
    if (!selectedWord) return
    try {
      await updateWordImage(selectedWord.word_id, imageUrl)
      // Update selected word state to reflect new image immediately
      setSelectedWord({ ...selectedWord, image_url: imageUrl })
      ToastService.show('Image updated', ToastType.SUCCESS)
    } catch {
      ToastService.show('Failed to update image', ToastType.ERROR)
    }
  }

  const handleShareToggle = async () => {
    if (!collection?.collection_id) {
      console.log('❌ [handleShareToggle] No collection or collection_id')
      return
    }

    if (collection.is_shared) {
      // Show confirmation dialog for unshare (destructive action)
      Alert.alert(
        'Stop Sharing',
        `Stop sharing "${collection.name}"?\n\nPeople will no longer be able to import words from this collection. You can always share it again later if needed.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Stop Sharing',
            style: 'destructive',
            onPress: async () => {
              setIsSharing(true)
              try {
                console.log('🔄 [handleShareToggle] Unsharing collection', {
                  collectionId: collection.collection_id,
                })
                const success = await unshareCollection(
                  collection.collection_id
                )
                if (success) {
                  ToastService.show('Collection unshared', ToastType.SUCCESS)
                } else {
                  ToastService.show(
                    'Failed to unshare collection',
                    ToastType.ERROR
                  )
                }
              } catch (error) {
                console.error('❌ [handleShareToggle] Unexpected error:', error)
                ToastService.show(
                  'Failed to unshare collection',
                  ToastType.ERROR
                )
              } finally {
                setIsSharing(false)
              }
            },
          },
        ]
      )
      return
    }

    // Share collection (no confirmation needed)
    setIsSharing(true)
    try {
      // Share collection
      console.log('🔄 [handleShareToggle] Starting share flow', {
        collectionId: collection.collection_id,
        collectionName: collection.name,
      })
      const shareToken = await shareCollection(collection.collection_id)
      console.log('📥 [handleShareToggle] shareCollection result', {
        shareToken,
      })

      if (!shareToken) {
        console.log('❌ [handleShareToggle] No share token returned')
        ToastService.show('Failed to share collection', ToastType.ERROR)
        return
      }

      console.log(
        '🔄 [handleShareToggle] Calling sharingUtils.shareCollectionUrl',
        { shareToken, collectionName: collection.name }
      )
      const shareResult = await sharingUtils.shareCollectionUrl(
        shareToken,
        collection.name,
        {
          dialogTitle: `Share "${collection.name}" collection`,
        }
      )
      console.log('📥 [handleShareToggle] sharingUtils result', {
        success: shareResult.success,
        error: shareResult.error,
      })

      if (shareResult.success) {
        ToastService.show('Collection shared successfully', ToastType.SUCCESS)
      } else {
        ToastService.show(
          shareResult.error || 'Failed to share collection',
          ToastType.ERROR
        )
      }
    } catch (error) {
      console.error('❌ [handleShareToggle] Unexpected error:', error)
      ToastService.show('Failed to share collection', ToastType.ERROR)
    } finally {
      console.log(
        '🔄 [handleShareToggle] Finishing share flow, setting isSharing to false'
      )
      setIsSharing(false)
    }
  }

  // Clean approach - no need for manual height calculations

  if (!collection) {
    return (
      <ViewThemed
        style={styles.container}
        lightColor={Colors.background.secondary}
        darkColor={Colors.dark.background}
      >
        <ViewThemed style={styles.errorContainer}>
          <TextThemed style={styles.errorText}>Collection not found</TextThemed>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <TextThemed style={styles.backButtonText}>Go Back</TextThemed>
          </TouchableOpacity>
        </ViewThemed>
      </ViewThemed>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: collection?.name || 'Collection',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.background.secondary,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerRight: () => (
            <TouchableOpacity
              onPress={handleShareToggle}
              disabled={isSharing || !collection?.collection_id}
              style={[
                styles.shareButton,
                {
                  opacity: isSharing ? 0.6 : 1,
                },
              ]}
              accessibilityLabel={
                collection?.is_shared
                  ? 'Unshare collection'
                  : 'Share collection'
              }
              accessibilityHint={
                collection?.is_shared
                  ? 'Stop sharing this collection'
                  : 'Share this collection with others'
              }
            >
              {isSharing ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colorScheme === 'dark'
                      ? Colors.dark.tint
                      : Colors.primary.DEFAULT
                  }
                />
              ) : (
                <Ionicons
                  name={
                    collection?.is_shared
                      ? 'person-remove-outline'
                      : 'share-outline'
                  }
                  size={24}
                  color={
                    collection?.is_shared
                      ? Colors.error.DEFAULT // Destructive action - red color
                      : colorScheme === 'dark'
                        ? Colors.dark.tint
                        : Colors.primary.DEFAULT
                  }
                />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ViewThemed
        style={styles.container}
        lightColor={Colors.background.secondary}
        darkColor={Colors.dark.background}
      >
        <FlatList
          style={styles.wordsSection}
          data={collectionWords}
          ListHeaderComponent={() => (
            <ViewThemed style={styles.headerContent}>
              <CollectionStats stats={stats} />
              <CollectionReviewButton
                wordsForReview={stats.wordsForReview}
                onPress={handleStartReview}
              />
            </ViewThemed>
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
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      </ViewThemed>

      <WordDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={selectedWord}
        onChangeImage={openImageSelector}
        onDeleteWord={handleDeleteSelectedWord}
      />

      {selectedWord && (
        <ImageSelector
          visible={showImageSelector}
          onClose={closeImageSelector}
          onSelect={handleImageChange}
          currentImageUrl={selectedWord.image_url || undefined}
          englishTranslation={selectedWord.translations.en[0] || ''}
          partOfSpeech={selectedWord.part_of_speech || ''}
          examples={selectedWord.examples || undefined}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  shareButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    // marginRight: 0,
    // padding: 0,
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
