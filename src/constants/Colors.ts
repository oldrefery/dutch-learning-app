/**
 * Centralized color system with semantic naming
 * Following best practices for design system color management
 */

// Color palette
const colorPalette = {
  // Primary colors - used for main actions, buttons, links
  primary: {
    DEFAULT: '#3B82F6',
    dark: '#1D4ED8',
    light: '#EBF4FF',
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
    light: '#ECFDF5',
    lightest: '#F0FDF4',
    border: '#BBF7D0',
  },

  warning: {
    DEFAULT: '#F59E0B',
    light: '#FEF3C7',
    dark: '#92400E',
  },

  error: {
    DEFAULT: '#EF4444',
    light: '#FEF2F2',
    lightest: '#FEF2F2',
    border: '#FECACA',
  },

  // Surface colors - used for backgrounds and containers
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
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
    white10: 'rgba(255, 255, 255, 0.1)',
    white20: 'rgba(255, 255, 255, 0.2)',
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

// Theme configurations
const themes = {
  light: {
    text: colorPalette.neutral[900],
    background: colorPalette.background.primary,
    tint: colorPalette.legacy.tintColorLight,
    tabIconDefault: colorPalette.legacy.lightGray,
    tabIconSelected: colorPalette.legacy.tintColorLight,
  },
  dark: {
    text: colorPalette.background.primary,
    background: colorPalette.legacy.black,
    tint: colorPalette.background.primary,
    tabIconDefault: colorPalette.legacy.lightGray,
    tabIconSelected: colorPalette.background.primary,
  },
}

// Add text color objects to match usage in components
const textColors = {
  text: {
    primary: colorPalette.neutral[900],
    secondary: colorPalette.neutral[600],
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
