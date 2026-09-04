import React from 'react'
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  Pressable,
} from 'react-native'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Word } from '@/types/database'

interface WordContextMenuProps {
  visible: boolean
  word: Word | null
  onClose: () => void
  onReset: () => void
  onMove: () => void
  onDelete: () => void
}

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  color: string
  onPress: () => void
  destructive?: boolean
}

export default function WordContextMenu({
  visible,
  word,
  onClose,
  onReset,
  onMove,
  onDelete,
}: WordContextMenuProps) {
  const colorScheme = useColorScheme() ?? 'light'

  if (!word) return null

  const isDarkMode = colorScheme === 'dark'
  const overlayOpacity = Colors.transparent.white10
  const overlayOpacityLight = Colors.transparent.black05

  const menuItems: MenuItem[] = [
    {
      icon: 'refresh-outline',
      label: 'Reset Progress',
      color: Colors.primary.DEFAULT,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onReset()
        onClose()
      },
    },
    {
      icon: 'folder-outline',
      label: 'Move to Collection',
      color: Colors.primary.DEFAULT,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onClose()
        setTimeout(() => {
          onMove()
        }, 50)
      },
    },
    {
      icon: 'trash-outline',
      label: 'Delete Word',
      color: Colors.error.DEFAULT,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onDelete()
        onClose()
      },
      destructive: true,
    },
  ]

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <Animated.View
          style={styles.overlay}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
        >
          <TouchableWithoutFeedback accessible={false}>
            <Animated.View
              style={styles.menuContainer}
              entering={SlideInDown.springify().damping(20).stiffness(300)}
              exiting={SlideOutDown.duration(150)}
            >
              <PlatformBlurView
                style={styles.menuBlur}
                intensity={100}
                tint={colorScheme === 'dark' ? 'dark' : 'light'}
                blurMethod={'dimezisBlurView'}
              >
                <ViewThemed
                  style={[
                    styles.menuContent,
                    {
                      backgroundColor: isDarkMode
                        ? Colors.transparent.iosDarkSurface95
                        : Colors.transparent.white95,
                      borderColor: isDarkMode
                        ? overlayOpacity
                        : overlayOpacityLight,
                    },
                  ]}
                >
                  {/* Header with word info */}
                  <ViewThemed style={styles.header}>
                    <TextThemed style={styles.wordTitle} numberOfLines={1}>
                      {word.dutch_original || word.dutch_lemma}
                    </TextThemed>
                    <TextThemed
                      style={[
                        styles.wordTranslation,
                        {
                          color:
                            colorScheme === 'dark'
                              ? Colors.dark.textSecondary
                              : Colors.neutral[500],
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {word.translations.en?.[0] || 'No translation'}
                    </TextThemed>
                  </ViewThemed>

                  {/* Separator */}
                  <ViewThemed
                    style={[
                      styles.separator,
                      {
                        backgroundColor: isDarkMode
                          ? overlayOpacity
                          : overlayOpacityLight,
                      },
                    ]}
                  />

                  {/* Menu items */}
                  <ViewThemed style={styles.menuItems}>
                    {menuItems.map((item, index) => (
                      <React.Fragment key={item.label}>
                        {(() => {
                          const itemTestId = `word-context-${item.label
                            .toLowerCase()
                            .replace(/\s+/g, '-')}`
                          return (
                            <Pressable
                              testID={itemTestId}
                              accessibilityLabel={item.label}
                              accessibilityRole="button"
                              accessible
                              onPress={item.onPress}
                              style={({ pressed }) => [
                                styles.menuItem,
                                {
                                  backgroundColor: pressed
                                    ? colorScheme === 'dark'
                                      ? Colors.transparent.white10
                                      : Colors.transparent.black05
                                    : 'transparent',
                                },
                              ]}
                            >
                              <Ionicons
                                name={item.icon}
                                size={22}
                                color={
                                  item.destructive
                                    ? Colors.error.DEFAULT
                                    : colorScheme === 'dark'
                                      ? Colors.primary.darkMode
                                      : item.color
                                }
                              />
                              <TextThemed
                                testID={`${itemTestId}-label`}
                                accessibilityLabel={item.label}
                                style={[
                                  styles.menuItemText,
                                  {
                                    color: item.destructive
                                      ? Colors.error.DEFAULT
                                      : colorScheme === 'dark'
                                        ? Colors.dark.text
                                        : Colors.neutral[900],
                                  },
                                ]}
                              >
                                {item.label}
                              </TextThemed>
                            </Pressable>
                          )
                        })()}
                        {index < menuItems.length - 1 && (
                          <ViewThemed
                            style={[
                              styles.itemSeparator,
                              {
                                backgroundColor: isDarkMode
                                  ? Colors.transparent.white05
                                  : overlayOpacityLight,
                              },
                            ]}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </ViewThemed>

                  {/* Cancel button */}
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      {
                        backgroundColor:
                          colorScheme === 'dark'
                            ? Colors.transparent.white05
                            : Colors.transparent.black03,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      onClose()
                    }}
                  >
                    <TextThemed
                      style={[
                        styles.cancelText,
                        {
                          color:
                            colorScheme === 'dark'
                              ? Colors.primary.darkMode
                              : Colors.primary.DEFAULT,
                        },
                      ]}
                    >
                      Cancel
                    </TextThemed>
                  </TouchableOpacity>
                </ViewThemed>
              </PlatformBlurView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.transparent.black40,
    justifyContent: 'flex-end',
  },
  menuContainer: {
    marginHorizontal: 16,
    marginBottom: 40,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  menuBlur: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  menuContent: {
    borderRadius: 20,
    borderWidth: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  wordTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  wordTranslation: {
    fontSize: 15,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
  },
  menuItems: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '400',
    flex: 1,
  },
  itemSeparator: {
    height: 1,
    marginLeft: 56,
  },
  cancelButton: {
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
})
