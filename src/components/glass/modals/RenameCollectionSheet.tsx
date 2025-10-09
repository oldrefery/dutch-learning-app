import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { TextInput } from 'react-native-gesture-handler'
import { TextThemed } from '@/components/Themed'
import { LiquidGlass } from '@/components/LiquidGlass'
import { GlassHeader } from '@/components/glass/GlassHeader'
import { Colors } from '@/constants/Colors'
import {
  GlassHeaderDefaults,
  LiquidGlassRadius,
  LiquidGlassTint,
} from '@/constants/GlassConstants'
import { usePreferReducedTransparency } from '@/hooks/usePreferReducedTransparency'

export type RenameCollectionSheetProps = {
  visible: boolean
  currentName: string
  onClose: () => void
  onRename: (newName: string) => Promise<void>
}

const ANIMATION_DURATION_MS = 280

export const RenameCollectionSheet: React.FC<RenameCollectionSheetProps> = ({
  visible,
  currentName,
  onClose,
  onRename,
}) => {
  const [newName, setNewName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const reduceTransparency = usePreferReducedTransparency()
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  // Shared animation state
  const progress = useSharedValue(1) // 1 = closed, 0 = open

  const unmountSheet = useCallback(() => {
    setIsMounted(false)
  }, [])

  // Mount/unmount handling to allow exit animation
  useEffect(() => {
    if (visible) {
      setIsMounted(true)
      setNewName(currentName)
      progress.value = withTiming(0, { duration: ANIMATION_DURATION_MS })
    } else {
      progress.value = withTiming(
        1,
        { duration: ANIMATION_DURATION_MS },
        () => {
          'worklet'
          scheduleOnRN(unmountSheet)
        }
      )
    }
  }, [visible, currentName, progress, unmountSheet])

  const canSave = useMemo(() => {
    const trimmed = newName.trim()
    return trimmed.length > 0 && trimmed !== currentName && !isSubmitting
  }, [newName, currentName, isSubmitting])

  const handleBackdropPress = useCallback(() => {
    if (!isSubmitting) onClose()
  }, [isSubmitting, onClose])

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setIsSubmitting(true)
    try {
      await onRename(newName.trim())
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }, [canSave, newName, onRename, onClose])

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 0.96 + 0.04 * (1 - progress.value) }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }))

  if (!isMounted) return null

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Close rename sheet"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.sheetContainer, sheetStyle]}>
          <LiquidGlass
            intensity={isDarkMode ? 18 : 20}
            tint={LiquidGlassTint.Light}
            style={[
              styles.sheet,
              {
                borderRadius: LiquidGlassRadius.L,
                minHeight: 240,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDarkMode
                    ? Colors.transparent.white05
                    : Colors.transparent.white10,
                  borderRadius: LiquidGlassRadius.L,
                },
              ]}
            />
            <View style={{ paddingBottom: 12 }}>
              <View style={{ height: GlassHeaderDefaults.height }}>
                <GlassHeader
                  title="Rename Collection"
                  roundedTop={true}
                  renderBackground={false}
                  leftSlot={
                    <TouchableOpacity
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel rename"
                    >
                      <TextThemed style={styles.headerAction}>
                        Cancel
                      </TextThemed>
                    </TouchableOpacity>
                  }
                  rightSlot={
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={!canSave}
                      accessibilityRole="button"
                      accessibilityLabel="Save collection name"
                    >
                      <TextThemed
                        style={[
                          styles.headerAction,
                          !canSave && styles.headerActionDisabled,
                        ]}
                      >
                        Save
                      </TextThemed>
                    </TouchableOpacity>
                  }
                />
              </View>

              <View style={styles.content}>
                <TextThemed style={styles.label}>Collection Name</TextThemed>
                <TextInput
                  style={[styles.input, styles.inputThemedColors]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Enter collection name"
                  placeholderTextColor={Colors.neutral[500]}
                  autoFocus
                  selectTextOnFocus
                  maxLength={50}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>
          </LiquidGlass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.transparent.black40,
  },
  sheetContainer: {
    width: '92%',
    maxWidth: 560,
  },
  sheet: {
    width: '100%',
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.DEFAULT,
  },
  headerActionDisabled: {
    color: Colors.neutral[400],
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  inputThemedColors: {
    backgroundColor: Colors.background.secondary,
    borderColor: Colors.neutral[300],
    color: Colors.text.primary,
  },
})

export default RenameCollectionSheet
