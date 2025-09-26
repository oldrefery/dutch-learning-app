// CORS headers for Edge Functions
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Image configuration
export const IMAGE_CONFIG = {
  DEFAULT_QUERY_COUNT: 3,
  MAX_QUERY_COUNT: 5,
  FALLBACK_IMAGE_WIDTH: 400,
  FALLBACK_IMAGE_HEIGHT: 300,
}

// Search configuration
export const SEARCH_CONFIG = {
  MAX_EXAMPLES: 6,
  MIN_EXAMPLES: 3,
  MAX_TRANSLATIONS: 5,
  MIN_TRANSLATIONS: 1,
}

// API configuration
export const API_CONFIG = {
  GEMINI_API_URL:
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  UNSPLASH_API_URL: 'https://api.unsplash.com/search/photos',
  PICSUM_BASE_URL: 'https://picsum.photos',
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
}
