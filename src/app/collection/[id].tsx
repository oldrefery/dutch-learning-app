import React from 'react'
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { GlassHeaderBackground } from '@/components/glass/GlassHeaderBackground'
import { Ionicons } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import * as Haptics from 'expo-haptics'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { useImageSelector } from '@/hooks/useImageSelector'
import { useCollectionDetail } from '@/hooks/useCollectionDetail'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import CollectionDetailHeader from '@/components/CollectionDetailHeader'
import CollectionContent from '@/components/CollectionContent'
import WordDetailModal from '@/components/WordDetailModal'
import ImageSelector from '@/components/ImageSelector'
import { MoveWordToCollectionSheet } from '@/components/glass/modals/MoveWordToCollectionSheet'
import WordContextMenu from '@/components/WordContextMenu'

export default function CollectionDetailScreen() {
  const { id, highlightWordId } = useLocalSearchParams<{
    id: string
    highlightWordId?: string
  }>()
  const colorScheme = useColorScheme() ?? 'light'
  const headerHeight = useHeaderHeight()

  const {
    collection,
    collectionWords,
    stats,
    refreshing,
    selectedWord,
    modalVisible,
    isSharing,
    moveModalVisible,
    wordToMove,
    contextMenuVisible,
    contextMenuWord,
    collections,
    words,
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
    handleMoveToCollection,
    handleCloseMoveModal,
    handleSelectTargetCollection,
    handleWordLongPress,
    handleCloseContextMenu,
    handleResetWordFromContextMenu,
    handleMoveFromContextMenu,
    handleDeleteFromContextMenu,
    handleReanalyzeSelectedWord,
    isReanalyzing,
  } = useCollectionDetail(id!)

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()

  const handleQuickAddWord = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({
      pathname: ROUTES.TABS.ADD_WORD,
      params: { collectionId: collection?.collection_id },
    })
  }

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
          headerTransparent: true,
          headerBackground: () => <GlassHeaderBackground />,
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
          onMoveToCollection={handleMoveToCollection}
          onWordLongPress={handleWordLongPress}
          moveModalVisible={moveModalVisible}
          wordBeingMoved={wordToMove}
          highlightWordId={highlightWordId}
          topInset={headerHeight}
        />

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[
            styles.fab,
            {
              shadowColor:
                colorScheme === 'dark'
                  ? Colors.primary.darkMode
                  : Colors.primary.DEFAULT,
            },
          ]}
          onPress={handleQuickAddWord}
          activeOpacity={0.8}
        >
          <PlatformBlurView
            style={styles.fabBlur}
            intensity={90}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            experimentalBlurMethod={'dimezisBlurView'}
          >
            <ViewThemed
              style={[
                styles.fabInner,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? Colors.primary.darkMode
                      : Colors.primary.DEFAULT,
                },
              ]}
            >
              <Ionicons
                name="add"
                size={28}
                color={Colors.background.primary}
              />
            </ViewThemed>
          </PlatformBlurView>
        </TouchableOpacity>
      </ViewThemed>

      <WordDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={selectedWord}
        onChangeImage={openImageSelector}
        onDeleteWord={handleDeleteSelectedWord}
        onReanalyzeWord={handleReanalyzeSelectedWord}
        isReanalyzing={isReanalyzing}
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

      <MoveWordToCollectionSheet
        visible={moveModalVisible}
        onClose={handleCloseMoveModal}
        onSelectCollection={handleSelectTargetCollection}
        collections={collections}
        words={words}
        currentCollectionId={collection?.collection_id}
        wordToMove={
          wordToMove ? words.find(w => w.word_id === wordToMove) : undefined
        }
      />

      <WordContextMenu
        visible={contextMenuVisible}
        word={contextMenuWord}
        onClose={handleCloseContextMenu}
        onReset={handleResetWordFromContextMenu}
        onMove={handleMoveFromContextMenu}
        onDelete={handleDeleteFromContextMenu}
      />
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  fabInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.transparent.white20,
  },
})
