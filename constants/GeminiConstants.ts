// Constants for Gemini AI word analysis

// Separable verb prefixes for fallback detection
export const SEPARABLE_PREFIXES = [
  'aan',
  'af',
  'bij',
  'door',
  'in',
  'mee',
  'na',
  'om',
  'onder',
  'op',
  'over',
  'toe',
  'uit',
  'vast',
  'weg',
  'voorbij',
  'terug',
  'voor',
  'na',
] as const

// Common Dutch verb patterns for validation
export const COMMON_VERB_PATTERNS = [
  'en',
  'eren',
  'eren',
  'eren',
  'eren',
  'eren',
  'eren',
  'eren',
  'eren',
  'eren',
] as const

// Minimum root verb length for separable verbs
export const MIN_ROOT_VERB_LENGTH = 3

// Gemini API configuration
export const GEMINI_CONFIG = {
  MODEL: 'gemini-1.5-flash',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.1,
  TIMEOUT: 30000,
} as const

// Error messages
export const ERROR_MESSAGES = {
  INVALID_WORD: 'Invalid word provided',
  GEMINI_API_ERROR: 'Failed to analyze word with Gemini AI',
  IMAGE_FETCH_ERROR: 'Failed to fetch image for word',
  ANALYSIS_FAILED: 'Word analysis failed',
} as const
