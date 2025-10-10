import React, { useMemo } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  FlatList,
  View,
  useColorScheme,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'
import type { Collection, Word } from '@/types/database'

export type MoveWordToCollectionSheetProps = {
  visible: boolean
  onClose: () => void
  onSelectCollection: (collection: Collection) => void
  collections: Collection[]
  words: Word[]
  currentCollectionId?: string
  wordToMove?: Word
}

export const MoveWordToCollectionSheet: React.FC<
  MoveWordToCollectionSheetProps
> = ({
  visible,
  onClose,
  onSelectCollection,
  collections,
  words,
  currentCollectionId,
  wordToMove,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  const availableCollections = useMemo(() => {
    return collections.filter(
      collection => collection.collection_id !== currentCollectionId
    )
  }, [collections, currentCollectionId])

  const getWordCount = (collectionId: string) => {
    return words.filter(word => word.collection_id === collectionId).length
  }

  const handleSelectCollection = (collection: Collection) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelectCollection(collection)
  }

  const renderCollectionItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.collectionItemWrapper}
      onPress={() => handleSelectCollection(item)}
      activeOpacity={0.6}
    >
      <BlurView
        intensity={isDarkMode ? 20 : 30}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[
          styles.collectionItem,
          {
            borderColor: isDarkMode
              ? Colors.transparent.white15
              : Colors.transparent.white50,
          },
        ]}
      >
        <View
          style={[
            styles.glassOverlay,
            {
              backgroundColor: isDarkMode
                ? Colors.transparent.white08
                : Colors.transparent.white25,
            },
          ]}
        />
        <View style={styles.collectionItemContent}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: isDarkMode
                  ? Colors.primary.darkMode + '25'
                  : Colors.primary.light,
              },
            ]}
          >
            <Ionicons
              name="folder"
              size={24}
              color={
                isDarkMode ? Colors.primary.darkMode : Colors.primary.DEFAULT
              }
            />
          </View>
          <View style={styles.collectionInfo}>
            <TextThemed style={styles.collectionName}>{item.name}</TextThemed>
            <TextThemed
              style={[
                styles.collectionCount,
                {
                  color: isDarkMode
                    ? Colors.dark.textSecondary
                    : Colors.neutral[500],
                },
              ]}
            >
              {getWordCount(item.collection_id)}{' '}
              {getWordCount(item.collection_id) === 1 ? 'word' : 'words'}
            </TextThemed>
          </View>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]}
          />
        </View>
      </BlurView>
    </TouchableOpacity>
  )

  const renderContent = () => {
    if (availableCollections.length === 0) {
      return (
        <ViewThemed style={styles.emptyContainer}>
          <ViewThemed
            style={[
              styles.emptyIconContainer,
              {
                backgroundColor: isDarkMode
                  ? Colors.dark.backgroundTertiary
                  : Colors.neutral[100],
              },
            ]}
          >
            <Ionicons
              name="folder-outline"
              size={32}
              color={
                isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]
              }
            />
          </ViewThemed>
          <TextThemed style={styles.emptyText}>No other collections</TextThemed>
          <TextThemed
            style={[
              styles.emptySubtext,
              {
                color: isDarkMode
                  ? Colors.dark.textSecondary
                  : Colors.neutral[500],
              },
            ]}
          >
            Create another collection to move words
          </TextThemed>
        </ViewThemed>
      )
    }

    return (
      <View style={styles.listContainer}>
        {wordToMove && (
          <BlurView
            intensity={isDarkMode ? 15 : 25}
            tint={isDarkMode ? 'dark' : 'light'}
            style={[
              styles.wordPreview,
              {
                borderColor: isDarkMode
                  ? Colors.transparent.white30
                  : Colors.transparent.white50,
              },
            ]}
          >
            <View
              style={[
                styles.wordPreviewOverlay,
                {
                  backgroundColor: isDarkMode
                    ? Colors.transparent.white10
                    : Colors.transparent.white20,
                },
              ]}
            />
            <View style={styles.wordPreviewContent}>
              <TextThemed style={styles.wordPreviewLabel}>Moving:</TextThemed>
              <TextThemed style={styles.wordPreviewText}>
                {wordToMove.dutch_lemma}
              </TextThemed>
            </View>
          </BlurView>
        )}
        <FlatList
          data={availableCollections}
          keyExtractor={item => item.collection_id}
          renderItem={renderCollectionItem}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    )
  }

  return (
    <GlassModalCenter
      visible={visible}
      title="Move to Collection"
      onClose={onClose}
      leftAction={{
        label: 'Cancel',
        onPress: onClose,
        accessibilityLabel: 'Cancel move',
      }}
      minHeight={450}
      width="92%"
      maxWidth={560}
    >
      {renderContent()}
    </GlassModalCenter>
  )
}

const styles = StyleSheet.create({
  listContainer: {
    maxHeight: 480,
  },
  list: {
    maxHeight: 430,
  },
  wordPreview: {
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  wordPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  wordPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  wordPreviewLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginRight: 8,
    letterSpacing: -0.3,
  },
  wordPreviewText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  collectionItemWrapper: {
    // No margin - separator handles spacing
  },
  separator: {
    height: 10,
  },
  collectionItem: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 72,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  collectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 72,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  collectionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  collectionName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  collectionCount: {
    fontSize: 15,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
})

export default MoveWordToCollectionSheet
