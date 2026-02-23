/**
 * Application Configuration Constants - Single Source of Truth
 *
 * This file contains ALL application constants and serves as the single source
 * of truth for configuration values used across:
 * - React Native app components
 * - Supabase Edge Functions (Deno runtime)
 * - Shared utilities and services
 *
 * ⚠️  IMPORTANT: When changing values in this file, you MUST redeploy Edge Functions!
 *
 * Quick deploy commands:
 *   npm run deploy:constants    # Deploy all Edge Functions
 *   npm run deploy:gemini       # Deploy gemini-handler only
 *   npm run deploy:images       # Deploy get-multiple-images only
 *
 * Git hooks will automatically remind you about this when committing changes.
 */

// ===========================
// IMAGE CONFIGURATION
// ===========================

export const IMAGE_CONFIG = {
  // Mobile-optimized image dimensions for bandwidth efficiency
  MOBILE_WIDTH: 400,
  MOBILE_HEIGHT: 300,

  // Number of image options for selection
  SELECTOR_OPTIONS_COUNT: 6,
  DEFAULT_QUERY_COUNT: 4,

  // Lorem Picsum configuration
  PICSUM_ID_RANGE: 1000,

  // Unsplash API settings
  UNSPLASH: {
    PREFERRED_SIZE: 'small' as const,
    FALLBACK_SIZE: 'regular' as const,
    ORIENTATION: 'landscape' as const,
  },
} as const

// ===========================
// API CONFIGURATION
// ===========================

export const API_CONFIG = {
  // Rate limiting to avoid hitting API quotas
  GEMINI_REQUEST_DELAY: 100,
  UNSPLASH_REQUEST_DELAY: 200,

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,

  // Timeout for Edge Function calls (30 seconds per attempt)
  // Allows time for complex Gemini API prompts and cache lookups
  // Total max time with 3 retries: ~97 seconds (30s x 3 + 1s + 2s + 4s backoff)
  EDGE_FUNCTION_TIMEOUT_MS: 30000,
} as const

// ===========================
// SEARCH CONFIGURATION
// ===========================

export const SEARCH_CONFIG = {
  // Stop words for context extraction from examples
  STOP_WORDS: [
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'can',
    'had',
    'her',
    'was',
    'one',
    'our',
    'out',
    'day',
    'get',
    'has',
    'him',
    'his',
    'how',
    'its',
    'may',
    'new',
    'now',
    'old',
    'see',
    'two',
    'way',
    'who',
    'boy',
    'did',
    'she',
    'use',
    'man',
    'put',
    'say',
    'too',
  ],

  MIN_CONTEXT_WORD_LENGTH: 3,
} as const

// ===========================
// TOUCH/GESTURE CONFIGURATION
// ===========================

export const TOUCH_CONFIG = {
  // Maximum duration for a gesture to be considered a "tap"
  // vs a scroll/drag gesture (in milliseconds)
  MAX_TAP_DURATION: 300,

  // Maximum distance a finger can move during a tap
  // before it's considered a drag/scroll (in pixels)
  MAX_TAP_DISTANCE: 10,
} as const

// ===========================
// SRS (SPACED REPETITION) CONFIGURATION
// ===========================

export const SRS_CONFIG = {
  // Default values for new words
  DEFAULT_INTERVAL_DAYS: 1,
  DEFAULT_REPETITION_COUNT: 0,
  DEFAULT_EASINESS_FACTOR: 2.5,

  // Minimum and maximum easiness factor bounds
  MIN_EASINESS_FACTOR: 1.3,
  MAX_EASINESS_FACTOR: 2.5,
} as const

// ===========================
// UI/UX CONFIGURATION
// ===========================

export const UI_CONFIG = {
  // Review card configuration
  CARD_MIN_HEIGHT: 500,

  // Animation durations (in milliseconds)
  ANIMATION_DURATION_SHORT: 200,
  ANIMATION_DURATION_MEDIUM: 300,
  ANIMATION_DURATION_LONG: 500,

  // Toast notification durations
  TOAST_DURATION_SHORT: 2000,
  TOAST_DURATION_LONG: 4000,
} as const

// Helper functions for creating image URLs
export const createPicsumUrl = (imageId: number): string => {
  return `https://picsum.photos/${IMAGE_CONFIG.MOBILE_WIDTH}/${IMAGE_CONFIG.MOBILE_HEIGHT}?random=${imageId}`
}

export const getPreferredUnsplashUrl = (photo: any): string => {
  return (
    photo.urls[IMAGE_CONFIG.UNSPLASH.PREFERRED_SIZE] ||
    photo.urls[IMAGE_CONFIG.UNSPLASH.FALLBACK_SIZE]
  )
}

// Hash function for consistent image ID generation
export const generateImageHash = (text: string, offset: number = 0): number => {
  const hash = text.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
  return (Math.abs(hash + offset) % IMAGE_CONFIG.PICSUM_ID_RANGE) + 1
}

// ===========================
// COMBINED APP CONFIGURATION
// ===========================

// Export all configs as a single object for easy importing
export const APP_CONFIG = {
  IMAGE: IMAGE_CONFIG,
  TOUCH: TOUCH_CONFIG,
  SRS: SRS_CONFIG,
  UI: UI_CONFIG,
  API: API_CONFIG,
  SEARCH: SEARCH_CONFIG,
} as const

// ===========================
// TYPE EXPORTS
// ===========================

export type ImageConfig = typeof IMAGE_CONFIG
export type TouchConfig = typeof TOUCH_CONFIG
export type SRSConfig = typeof SRS_CONFIG
export type UIConfig = typeof UI_CONFIG
export type APIConfig = typeof API_CONFIG
export type SearchConfig = typeof SEARCH_CONFIG
export type AppConfig = typeof APP_CONFIG
