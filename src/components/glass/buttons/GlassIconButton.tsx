import React from 'react'
import { StyleSheet, useColorScheme, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { LiquidGlassRadius } from '@/constants/GlassConstants'

export type GlassIconButtonVariant = 'tinted' | 'plain' | 'subtle'
export type GlassIconButtonSize = 'small' | 'medium' | 'large'

export interface GlassIconButtonProps {
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap
  /** Button press handler */
  onPress: () => void
  /** Visual variant following HIG */
  variant?: GlassIconButtonVariant
  /** Button size affecting tap target and icon */
  size?: GlassIconButtonSize
  /** Disabled state */
  disabled?: boolean
  /** Accessibility label (required for good UX) */
  accessibilityLabel: string
  /** Optional accessibility hint */
  accessibilityHint?: string
  /** Custom icon color override */
  iconColor?: string
  /** Custom icon size override */
  iconSize?: number
}

/**
 * Glass Icon Button Component
 *
 * Follows Apple HIG guidelines for buttons:
 * - Minimum 44x44pt tap target
 * - Clear visual states (normal, pressed, disabled)
 * - Tinted style for secondary actions
 * - Integrated with Liquid Glass design system
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/buttons
 */
export function GlassIconButton({
  icon,
  onPress,
  variant = 'tinted',
  size = 'medium',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  iconColor,
  iconSize: customIconSize,
}: GlassIconButtonProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // Size configurations following HIG tap target guidelines
  const sizeConfig = {
    small: {
      containerSize: 36,
      iconSize: 18,
      borderRadius: LiquidGlassRadius.S,
    },
    medium: {
      containerSize: 44, // HIG minimum tap target
      iconSize: 22,
      borderRadius: LiquidGlassRadius.S,
    },
    large: {
      containerSize: 52,
      iconSize: 26,
      borderRadius: LiquidGlassRadius.M,
    },
  }

  const config = sizeConfig[size]
  const finalIconSize = customIconSize || config.iconSize

  // Variant-based styling following HIG
  const getVariantStyles = () => {
    if (disabled) {
      return {
        backgroundColor: isDark
          ? Colors.transparent.white10
          : Colors.transparent.black10,
        borderColor: 'transparent',
      }
    }

    switch (variant) {
      case 'tinted':
        // Tinted buttons: colored background with matching icon
        return {
          backgroundColor: isDark
            ? Colors.transparent.primary20
            : Colors.primary.light,
          borderColor: isDark
            ? Colors.transparent.primary30
            : Colors.transparent.primary40,
        }
      case 'plain':
        // Plain buttons: subtle background, more prominent on press
        return {
          backgroundColor: isDark
            ? Colors.transparent.white15
            : Colors.transparent.white40,
          borderColor: isDark
            ? Colors.transparent.white20
            : Colors.transparent.white50,
        }
      case 'subtle':
        // Subtle buttons: minimal visual weight
        return {
          backgroundColor: Colors.transparent.clear,
          borderColor: isDark
            ? Colors.transparent.white20
            : Colors.transparent.black10,
        }
    }
  }

  const getIconColor = () => {
    if (iconColor) return iconColor
    if (disabled) return Colors.neutral[400]

    switch (variant) {
      case 'tinted':
        return Colors.primary.DEFAULT
      case 'plain':
        return isDark ? Colors.dark.text : Colors.light.text
      case 'subtle':
        return isDark ? Colors.dark.textSecondary : Colors.neutral[600]
    }
  }

  const variantStyles = getVariantStyles()
  const finalIconColor = getIconColor()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          width: config.containerSize,
          height: config.containerSize,
          borderRadius: config.borderRadius,
          backgroundColor: variantStyles.backgroundColor,
          borderWidth: 1,
          borderColor: variantStyles.borderColor,
          // Pressed state visual feedback following HIG
          opacity: pressed ? 0.7 : 1,
          transform: pressed ? [{ scale: 0.95 }] : [{ scale: 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={finalIconSize} color={finalIconColor} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    // Ensures minimum tap target per HIG
    minWidth: 44,
    minHeight: 44,
  },
})

export default GlassIconButton
