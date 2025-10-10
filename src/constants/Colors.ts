/**
 * Centralized color system with semantic naming
 * Following best practices for design system color management
 *
 * TODO: Consider platform-specific color variants in future updates
 * - iOS: Current implementation (#1C1C1E background)
 * - Android: Could use Material Design (#121212 background)
 * - Implementation: Platform.select() for dark theme backgrounds
 */

// Color palette
const colorPalette = {
  // Primary colors - used for main actions, buttons, links
  primary: {
    DEFAULT: '#3B82F6',
    dark: '#1D4ED8',
    light: '#EBF4FF',
    darkMode: '#409CFF', // Less saturated blue for dark backgrounds
  },

  // Neutral colors - used for text, borders, backgrounds
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Status colors - used for feedback and states
  success: {
    DEFAULT: '#10B981',
    dark: '#34D399', // Lighter version for dark backgrounds
    light: '#ECFDF5',
    lightest: '#F0FDF4',
    border: '#BBF7D0',
    darkModeChip: 'rgba(52, 211, 153, 0.15)', // Chip background for dark mode
    darkModeChipText: '#34D399', // Chip text for dark mode
  },

  warning: {
    DEFAULT: '#F59E0B',
    dark: '#FBBF24', // Lighter version for dark backgrounds
    light: '#FEF3C7',
    darkTheme: '#92400E',
    darkModeBadge: 'rgba(245, 158, 11, 0.2)', // Semi-transparent bg for badges in dark mode
    darkModeBadgeText: '#FBBF24', // Bright text for badges in dark mode
  },

  error: {
    DEFAULT: '#EF4444',
    dark: '#F87171', // Lighter version for dark backgrounds
    light: '#FEF2F2',
    lightest: '#FEF2F2',
    border: '#FECACA',
    darkMode: '#FF453A', // Apple HIG compliant red for dark theme
    darkModeChip: 'rgba(255, 69, 58, 0.15)', // Chip background for dark mode
    darkModeChipText: '#FF453A', // Chip text for dark mode
  },

  // Surface colors - used for backgrounds and containers
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
  },

  // Surface system for elevation and hierarchy
  surface: {
    // Light theme surfaces
    light: {
      primary: '#FFFFFF', // Main background
      secondary: '#F8FAFC', // Secondary background
      tertiary: '#F1F5F9', // Cards, containers
      elevated: '#FFFFFF', // Modal, popover backgrounds
      overlay: 'rgba(0, 0, 0, 0.05)', // Overlays
    },
    // Dark theme surfaces
    dark: {
      primary: '#1C1C1E', // Main background (iOS style)
      secondary: '#2C2C2E', // Secondary background
      tertiary: '#3A3A3C', // Cards, containers
      elevated: '#48484A', // Modal, popover backgrounds
      overlay: 'rgba(255, 255, 255, 0.05)', // Overlays
    },
  },

  // Link colors
  link: {
    DEFAULT: '#2e78b7',
  },

  // iOS system colors
  ios: {
    systemBlue: '#007AFF',
  },

  // Transparent/overlay colors - for backgrounds, overlays, and semi-transparent elements
  transparent: {
    // Modal overlays
    modalOverlay: 'rgba(0, 0, 0, 0.5)',

    // Text with transparency for different themes
    textLight: 'rgba(0, 0, 0, 0.8)',
    textDark: 'rgba(255, 255, 255, 0.8)',

    // Background overlays for different themes
    backgroundLight: 'rgba(0, 0, 0, 0.05)',
    backgroundDark: 'rgba(255, 255, 255, 0.05)',

    // White overlays with different opacity levels
    white05: 'rgba(255, 255, 255, 0.05)',
    white08: 'rgba(255, 255, 255, 0.08)',
    white10: 'rgba(255, 255, 255, 0.1)',
    white15: 'rgba(255, 255, 255, 0.15)',
    white20: 'rgba(255, 255, 255, 0.2)',
    white25: 'rgba(255, 255, 255, 0.25)',
    white30: 'rgba(255, 255, 255, 0.3)',
    white40: 'rgba(255, 255, 255, 0.4)',
    white50: 'rgba(255, 255, 255, 0.5)',
    white60: 'rgba(255, 255, 255, 0.6)',
    white92: 'rgba(255, 255, 255, 0.92)',
    white95: 'rgba(255, 255, 255, 0.95)',

    // Black overlays
    black05: 'rgba(0, 0, 0, 0.05)',
    black03: 'rgba(0, 0, 0, 0.03)',
    black04: 'rgba(0, 0, 0, 0.04)',
    black08: 'rgba(0, 0, 0, 0.08)',
    black10: 'rgba(0, 0, 0, 0.1)',
    black40: 'rgba(0, 0, 0, 0.4)',

    // iOS dark surface overlays (for glass backgrounds)
    iosDarkSurface92: 'rgba(28, 28, 30, 0.92)',
    iosDarkSurface95: 'rgba(44, 44, 46, 0.95)',

    // Hairline separators
    hairlineLight: 'rgba(60, 60, 67, 0.29)',
    hairlineDark: 'rgba(255, 255, 255, 0.28)',

    // Brand overlays
    primary20: 'rgba(64, 156, 255, 0.2)',

    // Misc
    gray35: 'rgba(127,127,127,0.35)',
  },

  // Legacy colors for compatibility (will be gradually replaced)
  legacy: {
    tintColorLight: '#2f95dc',
    black: '#000000',
    white: '#FFFFFF',
    lightGray: '#CCCCCC',
    darkGray: '#EEEEEE',
    transparent: 'transparent',
  },
}

// Enhanced theme configurations following 2025 guidelines
const themes = {
  light: {
    // Text colors
    text: colorPalette.neutral[900], // Primary text
    textSecondary: colorPalette.neutral[600], // Secondary text
    textTertiary: colorPalette.neutral[500], // Tertiary text

    // Background colors
    background: colorPalette.surface.light.primary,
    backgroundSecondary: colorPalette.surface.light.secondary,
    backgroundTertiary: colorPalette.surface.light.tertiary,
    backgroundElevated: colorPalette.surface.light.elevated,

    // Interactive colors
    tint: colorPalette.primary.DEFAULT,
    tabIconDefault: colorPalette.neutral[400],
    tabIconSelected: colorPalette.primary.DEFAULT,

    // Status colors for the light theme
    success: colorPalette.success.DEFAULT,
    warning: colorPalette.warning.DEFAULT,
    error: colorPalette.error.DEFAULT,

    // Border color for the light theme
    border: colorPalette.neutral[200],
    // Separator color for light theme (iOS standard opaque separator)
    separator: 'rgba(60, 60, 67, 0.29)', // iOS system separator color
  },
  dark: {
    // Text colors - optimized contrast for dark theme
    text: '#E5E5E7', // Primary text (softer than pure white)
    textSecondary: 'rgba(255, 255, 255, 0.6)', // Secondary text
    textTertiary: 'rgba(255, 255, 255, 0.4)', // Tertiary text

    // Background colors - modern dark theme hierarchy
    background: colorPalette.surface.dark.primary, // #1C1C1E
    backgroundSecondary: colorPalette.surface.dark.secondary, // #2C2C2E
    backgroundTertiary: colorPalette.surface.dark.tertiary, // #3A3A3C
    backgroundElevated: colorPalette.surface.dark.elevated, // #48484A

    // Interactive colors
    tint: colorPalette.primary.darkMode, // Use darkMode primary for better contrast
    tabIconDefault: colorPalette.neutral[500],
    tabIconSelected: '#E5E5E7',

    // Status colors adapted for the dark theme
    success: colorPalette.success.dark, // #34D399
    warning: colorPalette.warning.dark, // #FBBF24
    error: colorPalette.error.darkMode, // #FF453A (Apple HIG)

    // Border color for the dark theme
    border: colorPalette.neutral[700],
    // Separator color for the dark theme (iOS standard opaque separator)
    separator: 'rgba(84, 84, 88, 0.65)', // iOS system separator color for dark mode
  },
}

// Enhanced text color system for both themes
const textColors = {
  text: {
    // Light theme text colors
    primary: colorPalette.neutral[900], // Main text
    secondary: colorPalette.neutral[600], // Secondary text
    tertiary: colorPalette.neutral[500], // Tertiary text
    disabled: colorPalette.neutral[400], // Disabled text

    // Dark theme text colors
    primaryDark: '#E5E5E7', // Main text in a dark theme
    secondaryDark: 'rgba(255, 255, 255, 0.6)', // Secondary text in the dark theme
    tertiaryDark: 'rgba(255, 255, 255, 0.4)', // Tertiary text in the dark theme
    disabledDark: 'rgba(255, 255, 255, 0.3)', // Disabled text in the dark theme
  },
}

// Single named export with both palette and themes
export const Colors = {
  ...colorPalette,
  ...textColors,
  ...themes,
}

// Default export for backward compatibility
export default themes
