import React from 'react'
import {
  Modal,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Collection, Word } from '@/types/database'

interface MoveToCollectionModalProps {
  visible: boolean
  onClose: () => void
  onSelectCollection: (collection: Collection) => void
  collections: Collection[]
  words: Word[]
  currentCollectionId?: string
}

export default function MoveToCollectionModal({
  visible,
  onClose,
  onSelectCollection,
  collections,
  words,
  currentCollectionId,
}: MoveToCollectionModalProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const handleSelectCollection = (collection: Collection) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelectCollection(collection)
    onClose()
  }

  const availableCollections = collections.filter(
    collection => collection.collection_id !== currentCollectionId
  )

  const getWordCount = (collectionId: string) => {
    return words.filter(word => word.collection_id === collectionId).length
  }

  const renderCollectionItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={[
        styles.collectionItem,
        {
          backgroundColor:
            colorScheme === 'dark'
              ? Colors.dark.backgroundSecondary
              : Colors.background.primary,
          borderColor:
            colorScheme === 'dark' ? Colors.dark.border : Colors.neutral[200],
        },
      ]}
      onPress={() => handleSelectCollection(item)}
      activeOpacity={0.7}
    >
      <ViewThemed style={styles.collectionItemContent}>
        <ViewThemed
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.primary.darkMode + '20'
                  : Colors.primary.light,
            },
          ]}
        >
          <Ionicons
            name="folder"
            size={20}
            color={
              colorScheme === 'dark'
                ? Colors.primary.darkMode
                : Colors.primary.DEFAULT
            }
          />
        </ViewThemed>
        <ViewThemed style={styles.collectionInfo}>
          <TextThemed style={styles.collectionName}>{item.name}</TextThemed>
          <TextThemed
            style={[
              styles.collectionCount,
              {
                color:
                  colorScheme === 'dark'
                    ? Colors.dark.textSecondary
                    : Colors.neutral[500],
              },
            ]}
          >
            {getWordCount(item.collection_id)} words
          </TextThemed>
        </ViewThemed>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={
            colorScheme === 'dark'
              ? Colors.dark.textTertiary
              : Colors.neutral[400]
          }
        />
      </ViewThemed>
    </TouchableOpacity>
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <BlurView
        style={styles.container}
        intensity={100}
        experimentalBlurMethod={'dimezisBlurView'}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
      >
        <ViewThemed style={styles.header}>
          <ViewThemed style={styles.headerLeft}>
            <TextThemed style={styles.title}>Move to Collection</TextThemed>
            <TextThemed
              style={[
                styles.subtitle,
                {
                  color:
                    colorScheme === 'dark'
                      ? Colors.dark.textSecondary
                      : Colors.neutral[600],
                },
              ]}
            >
              Choose a collection to move this word to
            </TextThemed>
          </ViewThemed>
          <TouchableOpacity
            style={[
              styles.closeButton,
              {
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.backgroundTertiary
                    : Colors.neutral[100],
              },
            ]}
            onPress={onClose}
          >
            <Ionicons
              name="close"
              size={24}
              color={
                colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[600]
              }
            />
          </TouchableOpacity>
        </ViewThemed>

        {availableCollections.length > 0 ? (
          <FlatList
            data={availableCollections}
            keyExtractor={item => item.collection_id}
            renderItem={renderCollectionItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <ViewThemed style={styles.emptyContainer}>
            <ViewThemed
              style={[
                styles.emptyIconContainer,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? Colors.dark.backgroundTertiary
                      : Colors.neutral[100],
                },
              ]}
            >
              <Ionicons
                name="folder-outline"
                size={32}
                color={
                  colorScheme === 'dark'
                    ? Colors.dark.textTertiary
                    : Colors.neutral[400]
                }
              />
            </ViewThemed>
            <TextThemed style={styles.emptyText}>
              No other collections available
            </TextThemed>
            <TextThemed
              style={[
                styles.emptySubtext,
                {
                  color:
                    colorScheme === 'dark'
                      ? Colors.dark.textSecondary
                      : Colors.neutral[500],
                },
              ]}
            >
              Create another collection to move words between them
            </TextThemed>
          </ViewThemed>
        )}
      </BlurView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  collectionItem: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: Colors.legacy.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  collectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  collectionCount: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
