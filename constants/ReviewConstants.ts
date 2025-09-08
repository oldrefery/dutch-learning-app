import { Dimensions } from 'react-native'
import { UI_CONFIG, TOUCH_CONFIG } from '@/constants/AppConfig'

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

  // Colors (using shared constants)
  COLORS: {
    PRIMARY: '#3b82f6',
    SUCCESS: '#10b981',
    ERROR: '#ef4444',
    WARNING: '#f59e0b',
    BACKGROUND: '#f8fafc',
    CARD_BACKGROUND: '#ffffff',
    TEXT_PRIMARY: '#1f2937',
    TEXT_SECONDARY: '#6b7280',
    BORDER: '#e5e7eb',
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
