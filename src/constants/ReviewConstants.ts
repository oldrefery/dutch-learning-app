import { Dimensions } from 'react-native'
import { Colors } from './Colors'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

export const REVIEW_CONSTANTS = {
  // Screen dimensions
  SCREEN_WIDTH: screenWidth,
  SCREEN_HEIGHT: screenHeight,

  // Card dimensions
  CARD_WIDTH: screenWidth * 0.9,
  CARD_HEIGHT: screenHeight * 0.6,
  CARD_MIN_HEIGHT: 200,

  // Animation durations
  FLIP_DURATION: 300,
  TOUCH_DEBOUNCE: 300,

  // Touch sensitivity
  SCROLL_THRESHOLD: 10,

  // Audio
  AUDIO_RETRY_ATTEMPTS: 3,
  AUDIO_TIMEOUT: 5000,

  // UI
  BUTTON_HEIGHT: 50,
  BUTTON_MARGIN: 10,
  CARD_PADDING: 20,

  // Colors (using a centralized Colors system)
  COLORS: {
    PRIMARY: Colors.primary.DEFAULT,
    SUCCESS: Colors.success.DEFAULT,
    ERROR: Colors.error.DEFAULT,
    WARNING: Colors.warning.DEFAULT,
    BACKGROUND: Colors.background.secondary,
    CARD_BACKGROUND: Colors.background.primary,
    TEXT_PRIMARY: Colors.neutral[900],
    TEXT_SECONDARY: Colors.neutral[500],
    BORDER: Colors.neutral[200],
  },

  // Typography
  FONT_SIZES: {
    TITLE: 24,
    SUBTITLE: 18,
    BODY: 16,
    CAPTION: 14,
    SMALL: 12,
  },

  // Spacing
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48,
  },
} as const
