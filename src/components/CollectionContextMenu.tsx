import React, { useEffect } from 'react'
import {
  Modal,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
  Pressable,
} from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { SymbolView } from 'expo-symbols'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Collection } from '@/types/database'

interface CollectionContextMenuProps {
  visible: boolean
  collection: Collection | null
  onClose: () => void
  onRename: () => void
  onShare: () => void
  onCopyCode: () => void
  onStopSharing: () => void
  onDelete: () => void
}

export default function CollectionContextMenu({
  visible,
  collection,
  onClose,
  onRename,
  onShare,
  onCopyCode,
  onStopSharing,
  onDelete,
}: CollectionContextMenuProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'
  const slideAnim = useSharedValue(300)
  const opacityAnim = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      })
      opacityAnim.value = withTiming(1, { duration: 200 })
    } else {
      slideAnim.value = withTiming(300, { duration: 200 })
      opacityAnim.value = withTiming(0, { duration: 200 })
    }
  }, [visible, slideAnim, opacityAnim])

  const animatedMenuStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }))

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
  }))

  if (!collection) return null

  const isShared = collection.is_shared

  const handleAction = (action: () => void) => {
    onClose()
    // Small delay to allow modal to close smoothly
    setTimeout(action, 100)
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.backdropOverlay, animatedBackdropStyle]}
        />
      </Pressable>

      <Animated.View style={[styles.menuContainer, animatedMenuStyle]}>
        <BlurView
          intensity={isDarkMode ? 80 : 60}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <ViewThemed
            style={[
              styles.menu,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(28, 28, 30, 0.92)'
                  : 'rgba(255, 255, 255, 0.92)',
              },
            ]}
          >
            {/* Header */}
            <ViewThemed style={styles.header}>
              <TextThemed style={styles.title} numberOfLines={1}>
                {collection.name}
              </TextThemed>
            </ViewThemed>

            {/* Menu Items */}
            <ViewThemed style={styles.menuItems}>
              {/* Rename */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction(onRename)}
              >
                <ViewThemed style={styles.iconContainer}>
                  <Ionicons
                    name="pencil"
                    size={22}
                    color={isDarkMode ? Colors.dark.text : Colors.light.text}
                  />
                </ViewThemed>
                <TextThemed style={styles.menuItemText}>Rename</TextThemed>
              </TouchableOpacity>

              {/* Share or Copy Code + Stop Sharing */}
              {isShared ? (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction(onCopyCode)}
                  >
                    <ViewThemed style={styles.iconContainer}>
                      <Ionicons
                        name="copy"
                        size={22}
                        color={
                          isDarkMode ? Colors.dark.text : Colors.light.text
                        }
                      />
                    </ViewThemed>
                    <TextThemed style={styles.menuItemText}>
                      Copy Code
                    </TextThemed>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction(onStopSharing)}
                  >
                    <ViewThemed style={styles.iconContainer}>
                      {Platform.OS === 'ios' ? (
                        <SymbolView
                          name="person.2.slash"
                          size={22}
                          type="hierarchical"
                          tintColor={Colors.error.DEFAULT}
                          fallback={
                            <Ionicons
                              name="close-circle"
                              size={22}
                              color={Colors.error.DEFAULT}
                            />
                          }
                        />
                      ) : (
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color={Colors.error.DEFAULT}
                        />
                      )}
                    </ViewThemed>
                    <TextThemed
                      style={[styles.menuItemText, styles.destructiveText]}
                    >
                      Stop Sharing
                    </TextThemed>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleAction(onShare)}
                >
                  <ViewThemed style={styles.iconContainer}>
                    <Ionicons
                      name="share"
                      size={22}
                      color={isDarkMode ? Colors.dark.text : Colors.light.text}
                    />
                  </ViewThemed>
                  <TextThemed style={styles.menuItemText}>
                    Share Collection
                  </TextThemed>
                </TouchableOpacity>
              )}

              {/* Separator */}
              <ViewThemed
                style={[
                  styles.separator,
                  {
                    backgroundColor: isDarkMode
                      ? Colors.dark.border
                      : Colors.light.border,
                  },
                ]}
              />

              {/* Delete */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction(onDelete)}
              >
                <ViewThemed style={styles.iconContainer}>
                  <Ionicons
                    name="trash"
                    size={22}
                    color={Colors.error.DEFAULT}
                  />
                </ViewThemed>
                <TextThemed
                  style={[styles.menuItemText, styles.destructiveText]}
                >
                  Delete
                </TextThemed>
              </TouchableOpacity>
            </ViewThemed>

            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <TextThemed style={styles.cancelButtonText}>Cancel</TextThemed>
            </TouchableOpacity>
          </ViewThemed>
        </BlurView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blurContainer: {
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  menu: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 12,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuItems: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '500',
  },
  destructiveText: {
    color: Colors.error.DEFAULT,
  },
  separator: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.primary.DEFAULT,
  },
})
