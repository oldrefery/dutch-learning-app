import React, { useMemo } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  FlatList,
  View,
  useColorScheme,
  ActivityIndicator,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'
import type { Collection } from '@/types/database'

export type CollectionSelectorSheetProps = {
  visible: boolean
  onClose: () => void
  onSelect: (collection: Collection | null) => void
  collections: Collection[]
  selectedCollectionId: string | null
  loading?: boolean
}

export const CollectionSelectorSheet: React.FC<
  CollectionSelectorSheetProps
> = ({
  visible,
  onClose,
  onSelect,
  collections,
  selectedCollectionId,
  loading,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  const handleSelect = (collection: Collection | null) => {
    onSelect(collection)
    onClose()
  }

  const renderCollectionItem = ({ item }: { item: Collection }) => {
    const isSelected = selectedCollectionId === item.collection_id

    return (
      <TouchableOpacity
        style={styles.collectionItemWrapper}
        onPress={() => handleSelect(item)}
        activeOpacity={0.6}
      >
        <BlurView
          intensity={isDarkMode ? 20 : 30}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.collectionItem,
            {
              borderColor: isSelected
                ? isDarkMode
                  ? Colors.primary.darkMode
                  : Colors.primary.DEFAULT
                : isDarkMode
                  ? Colors.transparent.white15
                  : Colors.transparent.white50,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.glassOverlay,
              {
                backgroundColor: isSelected
                  ? isDarkMode
                    ? Colors.primary.darkMode + '20'
                    : Colors.primary.light
                  : isDarkMode
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
                    ? Colors.transparent.white20
                    : Colors.transparent.white60,
                },
              ]}
            >
              <Ionicons
                name="folder"
                size={24}
                color={
                  isSelected
                    ? isDarkMode
                      ? Colors.primary.darkMode
                      : Colors.primary.DEFAULT
                    : isDarkMode
                      ? Colors.dark.text
                      : Colors.neutral[700]
                }
              />
            </View>
            <View style={styles.collectionInfo}>
              <TextThemed style={styles.collectionName}>{item.name}</TextThemed>
              <TextThemed
                style={[
                  styles.collectionDate,
                  {
                    color: isDarkMode
                      ? Colors.dark.textSecondary
                      : Colors.neutral[500],
                  },
                ]}
              >
                {new Date(item.created_at).toLocaleDateString()}
              </TextThemed>
            </View>
            {isSelected && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={
                  isDarkMode ? Colors.primary.darkMode : Colors.primary.DEFAULT
                }
              />
            )}
          </View>
        </BlurView>
      </TouchableOpacity>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={
              isDarkMode ? Colors.primary.darkMode : Colors.primary.DEFAULT
            }
          />
          <TextThemed
            style={[
              styles.loadingText,
              {
                color: isDarkMode
                  ? Colors.dark.textSecondary
                  : Colors.neutral[500],
              },
            ]}
          >
            Loading collections...
          </TextThemed>
        </View>
      )
    }

    if (collections.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconContainer,
              {
                backgroundColor: isDarkMode
                  ? Colors.transparent.white10
                  : Colors.transparent.white40,
              },
            ]}
          >
            <Ionicons
              name="folder-outline"
              size={40}
              color={
                isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]
              }
            />
          </View>
          <TextThemed style={styles.emptyText}>No collections yet</TextThemed>
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
            A default collection will be created when you add your first word
          </TextThemed>
        </View>
      )
    }

    return (
      <View style={styles.listContainer}>
        <FlatList
          data={collections}
          keyExtractor={item => item.collection_id}
          renderItem={renderCollectionItem}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />

        {/* Clear Selection Button */}
        <View style={styles.clearButtonContainer}>
          <TouchableOpacity
            style={[
              styles.clearButton,
              {
                backgroundColor: isDarkMode
                  ? Colors.transparent.white10
                  : Colors.transparent.white50,
                borderColor: isDarkMode
                  ? Colors.transparent.white20
                  : Colors.transparent.white50,
              },
            ]}
            onPress={() => handleSelect(null)}
          >
            <Ionicons
              name="close-circle-outline"
              size={20}
              color={
                isDarkMode ? Colors.dark.textSecondary : Colors.neutral[600]
              }
            />
            <TextThemed
              style={[
                styles.clearButtonText,
                {
                  color: isDarkMode
                    ? Colors.dark.textSecondary
                    : Colors.neutral[600],
                },
              ]}
            >
              No Collection
            </TextThemed>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <GlassModalCenter
      visible={visible}
      title="Select Collection"
      onClose={onClose}
      leftAction={{
        label: 'Cancel',
        onPress: onClose,
        accessibilityLabel: 'Cancel selection',
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
    maxHeight: 400,
  },
  separator: {
    height: 10,
  },
  collectionItemWrapper: {
    // Separator handles spacing
  },
  collectionItem: {
    borderRadius: 14,
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
  collectionDate: {
    fontSize: 15,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    letterSpacing: -0.24,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.45,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.24,
    maxWidth: 280,
  },
  clearButtonContainer: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.41,
  },
})

export default CollectionSelectorSheet
