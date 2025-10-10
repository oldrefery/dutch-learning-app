import React, { useCallback, useEffect, useState } from 'react'
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

export type GlassModalCenterAction = {
  label: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}

export type GlassModalCenterProps = {
  visible: boolean
  title: string
  onClose: () => void
  leftAction?: GlassModalCenterAction
  rightAction?: GlassModalCenterAction
  children: React.ReactNode
  minHeight?: number
  width?: string
  maxWidth?: number
}

const ANIMATION_DURATION_MS = 280

export const GlassModalCenter: React.FC<GlassModalCenterProps> = ({
  visible,
  title,
  onClose,
  leftAction,
  rightAction,
  children,
  minHeight = 240,
  width = '92%',
  maxWidth = 560,
}) => {
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
  }, [visible, progress, unmountSheet])

  const handleBackdropPress = useCallback(() => {
    onClose()
  }, [onClose])

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
            accessibilityLabel="Close modal"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[styles.sheetContainer, sheetStyle, { width, maxWidth }]}
        >
          <LiquidGlass
            intensity={isDarkMode ? 10 : 12}
            tint={LiquidGlassTint.Light}
            style={[
              styles.sheet,
              {
                borderRadius: LiquidGlassRadius.L,
                minHeight,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDarkMode
                    ? Colors.transparent.white20
                    : Colors.transparent.white50,
                  borderRadius: LiquidGlassRadius.L,
                },
              ]}
            />
            <View style={{ paddingBottom: 12 }}>
              <View style={{ height: GlassHeaderDefaults.height }}>
                <GlassHeader
                  title={title}
                  roundedTop={true}
                  renderBackground={false}
                  leftSlot={
                    leftAction ? (
                      <TouchableOpacity
                        onPress={leftAction.onPress}
                        disabled={leftAction.disabled}
                        accessibilityRole="button"
                        accessibilityLabel={
                          leftAction.accessibilityLabel || leftAction.label
                        }
                      >
                        <TextThemed
                          style={[
                            styles.headerAction,
                            leftAction.disabled && styles.headerActionDisabled,
                          ]}
                        >
                          {leftAction.label}
                        </TextThemed>
                      </TouchableOpacity>
                    ) : undefined
                  }
                  rightSlot={
                    rightAction ? (
                      <TouchableOpacity
                        onPress={rightAction.onPress}
                        disabled={rightAction.disabled}
                        accessibilityRole="button"
                        accessibilityLabel={
                          rightAction.accessibilityLabel || rightAction.label
                        }
                      >
                        <TextThemed
                          style={[
                            styles.headerAction,
                            rightAction.disabled && styles.headerActionDisabled,
                          ]}
                        >
                          {rightAction.label}
                        </TextThemed>
                      </TouchableOpacity>
                    ) : undefined
                  }
                />
              </View>

              <View style={styles.content}>{children}</View>
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
    // width and maxWidth are applied inline
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
})

export default GlassModalCenter
