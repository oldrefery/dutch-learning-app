/**
 * Centralized color system with semantic naming
 * Following best practices for design system color management
 */

export const Colors = {
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
  },

  warning: {
    DEFAULT: '#F59E0B',
    light: '#FEF3C7',
    dark: '#92400E',
  },

  error: {
    DEFAULT: '#EF4444',
    light: '#FEF2F2',
    border: '#FECACA',
  },

  // Surface colors - used for backgrounds and containers
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
  },

  // Legacy colors for compatibility (will be gradually replaced)
  legacy: {
    tintColorLight: '#2f95dc',
    black: '#000000',
    white: '#FFFFFF',
    lightGray: '#CCCCCC',
    darkGray: '#EEEEEE',
  },
}

// Default export for backward compatibility
export default {
  light: {
    text: Colors.neutral[900],
    background: Colors.background.primary,
    tint: Colors.legacy.tintColorLight,
    tabIconDefault: Colors.legacy.lightGray,
    tabIconSelected: Colors.legacy.tintColorLight,
  },
  dark: {
    text: Colors.background.primary,
    background: Colors.legacy.black,
    tint: Colors.background.primary,
    tabIconDefault: Colors.legacy.lightGray,
    tabIconSelected: Colors.background.primary,
  },
}
