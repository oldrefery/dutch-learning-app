import React from 'react'
import { StyleSheet, useColorScheme, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

export type GlassCapsuleButtonVariant = 'tinted' | 'plain' | 'subtle'
export type GlassCapsuleButtonSize = 'small' | 'medium' | 'large'

export interface GlassCapsuleButtonProps {
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap
  /** Button text */
  text: string
  /** Button press handler */
  onPress: () => void
  /** Visual variant following HIG */
  variant?: GlassCapsuleButtonVariant
  /** Button size */
  size?: GlassCapsuleButtonSize
  /** Disabled state */
  disabled?: boolean
  /** Accessibility label (required for good UX) */
  accessibilityLabel: string
  /** Optional accessibility hint */
  accessibilityHint?: string
  /** Custom icon color override */
  iconColor?: string
  /** Custom text color override */
  textColor?: string
}

/**
 * Glass Capsule Button Component
 *
 * Rectangular button with rounded corners for actions that need text labels.
 * Follows Apple HIG guidelines for capsule-shaped buttons.
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/buttons
 */
export function GlassCapsuleButton({
  icon,
  text,
  onPress,
  variant = 'tinted',
  size = 'medium',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  iconColor,
  textColor,
}: GlassCapsuleButtonProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // Size configurations
  const sizeConfig = {
    small: {
      height: 32,
      paddingHorizontal: 12,
      iconSize: 14,
      fontSize: 13,
      borderRadius: 16, // Capsule shape
    },
    medium: {
      height: 36,
      paddingHorizontal: 16,
      iconSize: 16,
      fontSize: 14,
      borderRadius: 18, // Capsule shape
    },
    large: {
      height: 44,
      paddingHorizontal: 20,
      iconSize: 18,
      fontSize: 16,
      borderRadius: 22, // Capsule shape
    },
  }

  const config = sizeConfig[size]

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
        // Tinted buttons: colored background with matching text
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

  const getColors = () => {
    if (iconColor && textColor) {
      return { iconColor, textColor }
    }
    if (disabled) {
      return {
        iconColor: Colors.neutral[400],
        textColor: Colors.neutral[400],
      }
    }

    switch (variant) {
      case 'tinted':
        return {
          iconColor: Colors.primary.DEFAULT,
          textColor: Colors.primary.DEFAULT,
        }
      case 'plain':
        return {
          iconColor: isDark ? Colors.dark.text : Colors.light.text,
          textColor: isDark ? Colors.dark.text : Colors.light.text,
        }
      case 'subtle':
        return {
          iconColor: isDark ? Colors.dark.textSecondary : Colors.neutral[600],
          textColor: isDark ? Colors.dark.textSecondary : Colors.neutral[600],
        }
    }
  }

  const variantStyles = getVariantStyles()
  const colors = getColors()

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
          height: config.height,
          paddingHorizontal: config.paddingHorizontal,
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
      <Ionicons
        name={icon}
        size={config.iconSize}
        color={colors.iconColor}
        style={styles.icon}
      />
      <TextThemed
        style={[
          styles.text,
          {
            fontSize: config.fontSize,
            color: colors.textColor,
          },
        ]}
      >
        {text}
      </TextThemed>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Ensures minimum tap target per HIG
    minHeight: 44,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '500',
  },
})

export default GlassCapsuleButton
