/**
 * User Interface Constants
 *
 * Constants related to UI interactions, timings, and behavior
 */

// Search and Input Timing
export const SEARCH_DEBOUNCE_DELAY = 500 // milliseconds

// Liquid Glass Effect Constants (HIG Compliant)
export const LIQUID_GLASS = {
  // Blur intensities for different contexts
  BLUR_INTENSITY: {
    CARD: 80,
    MODAL: 100,
    MENU: 100,
    OVERLAY: 60,
  },

  // Background colors with transparency for the light theme
  BACKGROUND_LIGHT: {
    PRIMARY: 'rgba(255, 255, 255, 0.92)', // Main cards
    SECONDARY: 'rgba(255, 255, 255, 0.85)', // Secondary elements
    ELEVATED: 'rgba(255, 255, 255, 0.95)', // Modals, popovers
    OVERLAY: 'rgba(0, 0, 0, 0.5)', // Modal backdrop
  },

  // Background colors with transparency for the dark theme
  BACKGROUND_DARK: {
    PRIMARY: 'rgba(28, 28, 30, 0.92)', // Main cards
    SECONDARY: 'rgba(44, 44, 46, 0.85)', // Secondary elements
    ELEVATED: 'rgba(28, 28, 30, 0.95)', // Modals, popovers
    OVERLAY: 'rgba(0, 0, 0, 0.7)', // Modal backdrop
  },

  // Border colors for glass effect
  BORDER_LIGHT: 'rgba(0, 0, 0, 0.08)',
  BORDER_DARK: 'rgba(255, 255, 255, 0.12)',

  // Border radius values following HIG
  BORDER_RADIUS: {
    SMALL: 12,
    MEDIUM: 16,
    LARGE: 20,
    EXTRA_LARGE: 24,
  },

  // Shadow presets for depth and elevation
  SHADOW: {
    CARD: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    FLOATING: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 10,
    },
    SUBTLE: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
  },
} as const

// Animation Timings (HIG recommended values)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 350,
  SPRING: 300,
} as const

// Interactive feedback
export const INTERACTION = {
  ACTIVE_OPACITY: 0.8,
  SCALE_DOWN: 0.98,
  HAPTIC_ENABLED: true,
} as const
