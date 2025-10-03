import React, { useRef, useState, useCallback } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Platform,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { SymbolView } from 'expo-symbols'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import CollectionContextMenu from '@/components/CollectionContextMenu'
import type { Collection, Word } from '@/types/database'
import { Sentry } from '@/lib/sentry'
import { calculateCollectionStats } from '@/utils/collectionStats'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'

interface SwipeableCollectionCardProps {
  collection: Collection
  words: Word[]
  onPress: () => void
  onDelete: (collectionId: string) => void
  onRename: (collectionId: string, currentName: string) => Promise<void>
  onShare?: (collectionId: string) => void
  onCopyCode?: (collectionId: string) => void
  onStopSharing?: (collectionId: string) => void
}

export default function SwipeableCollectionCard({
  collection,
  words,
  onPress,
  onDelete,
  onRename,
  onShare,
  onCopyCode,
  onStopSharing,
}: SwipeableCollectionCardProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const translateX = useSharedValue(0)
  const lastGestureX = useRef<number>(0)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const { userAccessLevel, collections } = useApplicationStore()

  // Calculate real stats for this collection
  const collectionWords = words.filter(
    word => word.collection_id === collection.collection_id
  )
  const stats = calculateCollectionStats(collectionWords)

  const handleDelete = () => {
    // Prevent read-only users from deleting their last collection
    if (userAccessLevel === 'read_only' && collections.length <= 1) {
      ToastService.show('Cannot delete your last collection', ToastType.ERROR)
      translateX.value = withSpring(0)
      return
    }

    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection.name}"? This will also delete all ${stats.totalWords} words in this collection.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Reset position when a user cancels deletion
            translateX.value = withSpring(0)
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(collection.collection_id),
        },
      ],
      {
        onDismiss: () => {
          // Reset position when the alert is dismissed by tapping outside
          translateX.value = withSpring(0)
        },
      }
    )
  }

  const handleRename = async () => {
    try {
      await onRename(collection.collection_id, collection.name)
      // Reset position after a successful rename
      translateX.value = withSpring(0)
    } catch (error) {
      // Reset position on cancel/error
      translateX.value = withSpring(0)

      // Only log actual errors, not cancellations
      if (error instanceof Error && error.name !== 'CancelledError') {
        Sentry.captureException(error, {
          tags: { operation: 'renameCollection' },
          extra: {
            message: 'Rename failed',
            collectionId: collection.collection_id,
          },
        })
      }
    }
  }

  const handleLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowContextMenu(true)
  }, [])

  const handleCloseContextMenu = () => {
    setShowContextMenu(false)
  }

  const handleContextMenuRename = async () => {
    try {
      await onRename(collection.collection_id, collection.name)
    } catch {
      // Error already handled by onRename
    }
  }

  const handleContextMenuShare = () => {
    if (onShare) {
      onShare(collection.collection_id)
    }
  }

  const handleContextMenuCopyCode = () => {
    if (onCopyCode) {
      onCopyCode(collection.collection_id)
    }
  }

  const handleContextMenuStopSharing = () => {
    if (onStopSharing) {
      onStopSharing(collection.collection_id)
    }
  }

  const handleContextMenuDelete = () => {
    handleDelete()
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const deleteButtonAnimatedStyle = useAnimatedStyle(() => {
    // Only expand on the long swipe left (>= 150 px)
    const isLongSwipeLeft = translateX.value <= -150
    return {
      width: isLongSwipeLeft ? Math.abs(translateX.value) + 80 : 80,
    }
  })

  const renameButtonAnimatedStyle = useAnimatedStyle(() => {
    // Only expand on the long swipe right (>= 150 px)
    const isLongSwipeRight = translateX.value >= 150
    return {
      width: isLongSwipeRight ? translateX.value + 80 : 80,
    }
  })

  const tapGesture = Gesture.Tap()
    .maxDistance(10) // Tap must be within 10 px of the start point
    .maxDuration(300) // Tap must be under 300 ms
    .onEnd(() => {
      'worklet'
      // Only trigger tap if card is in resting position
      if (Math.abs(translateX.value) < 5) {
        scheduleOnRN(onPress)
      }
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(10)
    .onStart(() => {
      'worklet'
      // Only trigger long press if card is in resting position
      if (Math.abs(translateX.value) < 5) {
        scheduleOnRN(handleLongPress)
      }
    })

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Only activate after 15 px horizontal movement
    .failOffsetY([-20, 20]) // Fail if vertical movement exceeds 20 px
    .maxPointers(1) // Only allow a single finger swipe
    .onUpdate(event => {
      'worklet'
      translateX.value = event.translationX
    })
    .onEnd(event => {
      'worklet'
      const { translationX } = event
      lastGestureX.current = translationX

      if (translationX < -150) {
        // Long swipe left - trigger immediate deletion
        translateX.value = withSpring(-300, {}, () => {
          'worklet'
          // Trigger deletion after animation
          scheduleOnRN(handleDelete)
        })
      } else if (translationX > 150) {
        // Long swipe right - trigger immediate rename
        translateX.value = withSpring(300, {}, () => {
          'worklet'
          // Trigger rename after animation
          scheduleOnRN(handleRename)
        })
      } else if (translationX < -80) {
        // Short swipe left - show the delete button
        translateX.value = withSpring(-80)
      } else if (translationX > 80) {
        // Short swipe right - show the rename button
        translateX.value = withSpring(80)
      } else {
        // Return to the original position
        translateX.value = withSpring(0)
      }
    })

  // Use Exclusive to ensure only one gesture can win
  const combinedGesture = Gesture.Exclusive(
    longPressGesture,
    panGesture,
    tapGesture
  )

  return (
    <ViewThemed style={styles.container}>
      {/* Rename button background (left side) */}
      <Animated.View style={[styles.renameButton, renameButtonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.renameButtonContent}
          onPress={handleRename}
        >
          <Ionicons name="pencil" size={20} color="white" />
          <TextThemed style={styles.renameButtonText}>Rename</TextThemed>
        </TouchableOpacity>
      </Animated.View>

      {/* Delete the button background (right side) */}
      <Animated.View style={[styles.deleteButton, deleteButtonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={20} color="white" />
          <TextThemed style={styles.deleteButtonText}>Delete</TextThemed>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable card */}
      <GestureDetector gesture={combinedGesture}>
        <Animated.View
          style={[
            styles.card,
            animatedStyle,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundSecondary
                  : Colors.background.primary,
            },
          ]}
        >
          <ViewThemed
            style={styles.cardContent}
            lightColor="transparent"
            darkColor="transparent"
          >
            <ViewThemed
              style={styles.textContainer}
              lightColor="transparent"
              darkColor="transparent"
            >
              <TextThemed style={styles.collectionName}>
                {collection.name}
              </TextThemed>
              <TextThemed
                style={styles.collectionStats}
                lightColor={Colors.neutral[500]}
                darkColor={Colors.dark.textSecondary}
              >
                {stats.totalWords} words • {stats.progressPercentage}% mastered
              </TextThemed>
            </ViewThemed>
            <ViewThemed
              style={styles.accessoryContainer}
              lightColor="transparent"
              darkColor="transparent"
            >
              {collection.is_shared && Platform.OS === 'ios' && (
                <SymbolView
                  name="person.2.fill"
                  size={24}
                  type="hierarchical"
                  tintColor={
                    colorScheme === 'dark'
                      ? Colors.dark.textSecondary
                      : Colors.neutral[400]
                  }
                  style={styles.sharedIcon}
                  fallback={
                    <Ionicons
                      name="people"
                      size={24}
                      color={
                        colorScheme === 'dark'
                          ? Colors.dark.textSecondary
                          : Colors.neutral[400]
                      }
                    />
                  }
                />
              )}
              {collection.is_shared && Platform.OS !== 'ios' && (
                <Ionicons
                  name="people"
                  size={24}
                  color={
                    colorScheme === 'dark'
                      ? Colors.dark.textSecondary
                      : Colors.neutral[400]
                  }
                  style={styles.sharedIcon}
                />
              )}
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
          </ViewThemed>
        </Animated.View>
      </GestureDetector>

      <CollectionContextMenu
        visible={showContextMenu}
        collection={collection}
        onClose={handleCloseContextMenu}
        onRename={handleContextMenuRename}
        onShare={handleContextMenuShare}
        onCopyCode={handleContextMenuCopyCode}
        onStopSharing={handleContextMenuStopSharing}
        onDelete={handleContextMenuDelete}
        isReadOnly={userAccessLevel === 'read_only'}
        totalCollections={collections.length}
      />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  card: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
    zIndex: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  collectionName: {
    fontSize: 17,
    fontWeight: '400',
    marginBottom: 2,
  },
  collectionStats: {
    fontSize: 15,
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedIcon: {
    marginRight: 6,
    width: 24,
    height: 24,
  },
  renameButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.primary.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  renameButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.error.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
})
