import React from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import { Pressable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import {
  getGlassButtonVariantStyles,
  getGlassButtonColor,
  type GlassButtonVariant,
} from './glassButtonStyles'

export type GlassCapsuleButtonVariant = GlassButtonVariant
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
export const GlassCapsuleButton = ({
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
}: GlassCapsuleButtonProps) => {
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

  const variantStyles = getGlassButtonVariantStyles(variant, isDark, disabled)
  const finalIconColor = getGlassButtonColor(
    variant,
    isDark,
    disabled,
    iconColor
  )
  const finalTextColor = getGlassButtonColor(
    variant,
    isDark,
    disabled,
    textColor
  )

  return (
    <Pressable
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
        color={finalIconColor}
        style={styles.icon}
      />
      <TextThemed
        style={[
          styles.text,
          {
            fontSize: config.fontSize,
            color: finalTextColor,
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
    minHeight: 44,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '500',
  },
})
