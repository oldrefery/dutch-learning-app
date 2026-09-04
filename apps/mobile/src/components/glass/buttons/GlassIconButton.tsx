import React from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import {
  getGlassButtonVariantStyles,
  getGlassButtonColor,
  type GlassButtonVariant,
} from './glassButtonStyles'

export type GlassIconButtonVariant = GlassButtonVariant
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
  /** Test ID for E2E testing */
  testID?: string
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
export const GlassIconButton = ({
  icon,
  onPress,
  variant = 'tinted',
  size = 'medium',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  iconColor,
  iconSize: customIconSize,
  testID,
}: GlassIconButtonProps) => {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // Size configurations following HIG tap target guidelines
  const sizeConfig = {
    small: {
      containerSize: 36,
      iconSize: 18,
      borderRadius: 18, // Circular for instantaneous actions
    },
    medium: {
      containerSize: 44, // HIG minimum tap target
      iconSize: 22,
      borderRadius: 22, // Circular for instantaneous actions
    },
    large: {
      containerSize: 52,
      iconSize: 26,
      borderRadius: 26, // Circular for instantaneous actions
    },
  }

  const config = sizeConfig[size]
  const finalIconSize = customIconSize || config.iconSize

  const variantStyles = getGlassButtonVariantStyles(variant, isDark, disabled)
  const finalIconColor = getGlassButtonColor(
    variant,
    isDark,
    disabled,
    iconColor
  )

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      cancelable={false}
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
