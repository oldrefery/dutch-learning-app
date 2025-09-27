import React from 'react'
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { useImageSelector } from '@/hooks/useImageSelector'
import { useCollectionDetail } from '@/hooks/useCollectionDetail'
import { Colors } from '@/constants/Colors'
import CollectionDetailHeader from '@/components/CollectionDetailHeader'
import CollectionContent from '@/components/CollectionContent'
import WordDetailModal from '@/components/WordDetailModal'
import ImageSelector from '@/components/ImageSelector'

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colorScheme = useColorScheme() ?? 'light'

  const {
    collection,
    collectionWords,
    stats,
    refreshing,
    selectedWord,
    modalVisible,
    isSharing,
    handleRefresh,
    handleWordPress,
    handleCloseModal,
    handleStartReview,
    handleDeleteWord,
    handleDeleteSelectedWord,
    handleImageChange,
    handleCopyCode,
    handleShareCollection,
    handleStopSharing,
  } = useCollectionDetail(id!)

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()

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
            <CollectionDetailHeader
              collection={collection}
              isSharing={isSharing}
              onCopyCode={handleCopyCode}
              onShare={handleShareCollection}
              onStopSharing={handleStopSharing}
            />
          ),
        }}
      />
      <ViewThemed
        style={styles.container}
        lightColor={Colors.background.secondary}
        darkColor={Colors.dark.background}
      >
        <CollectionContent
          words={collectionWords}
          stats={stats}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onWordPress={handleWordPress}
          onDeleteWord={handleDeleteWord}
          onStartReview={handleStartReview}
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
