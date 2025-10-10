import { Colors } from '@/constants/Colors'

export type GlassButtonVariant = 'tinted' | 'plain' | 'subtle'

interface VariantStyles {
  backgroundColor: string
  borderColor: string
}

/**
 * Get variant-based styles for glass buttons following HIG
 */
export function getGlassButtonVariantStyles(
  variant: GlassButtonVariant,
  isDark: boolean,
  disabled: boolean
): VariantStyles {
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
      return {
        backgroundColor: isDark
          ? Colors.transparent.primary20
          : Colors.primary.light,
        borderColor: isDark
          ? Colors.transparent.primary30
          : Colors.transparent.primary40,
      }
    case 'plain':
      return {
        backgroundColor: isDark
          ? Colors.transparent.white15
          : Colors.transparent.white40,
        borderColor: isDark
          ? Colors.transparent.white20
          : Colors.transparent.white50,
      }
    case 'subtle':
      return {
        backgroundColor: Colors.transparent.clear,
        borderColor: isDark
          ? Colors.transparent.white20
          : Colors.transparent.black10,
      }
  }
}

/**
 * Get color for glass button content (icon/text)
 */
export function getGlassButtonColor(
  variant: GlassButtonVariant,
  isDark: boolean,
  disabled: boolean,
  customColor?: string
): string {
  if (customColor) return customColor
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
