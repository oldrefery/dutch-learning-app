export const APPLICATION_STORE_CONSTANTS = {
  // Error messages
  ERROR_MESSAGES: {
    APP_INITIALIZATION_FAILED: 'Failed to initialize app',
    WORDS_FETCH_FAILED: 'Failed to fetch words',
    COLLECTIONS_FETCH_FAILED: 'Failed to fetch collections',
    WORD_ADD_FAILED: 'Failed to add word',
    WORD_UPDATE_FAILED: 'Failed to update word',
    WORD_DELETE_FAILED: 'Failed to delete word',
    COLLECTION_CREATE_FAILED: 'Failed to create collection',
    COLLECTION_DELETE_FAILED: 'Failed to delete collection',
    COLLECTION_UPDATE_FAILED: 'Failed to update collection',
    REVIEW_SESSION_START_FAILED: 'Failed to start review session',
    REVIEW_ASSESSMENT_SUBMIT_FAILED: 'Failed to submit review assessment',
  },

  // Default values
  DEFAULT_EASINESS_FACTOR: 2.5,
  DEFAULT_INTERVAL_DAYS: 1,
  DEFAULT_REPETITION_COUNT: 0,

  // SRS intervals (in minutes)
  SRS_INTERVALS: {
    AGAIN: 1,
    HARD: 6,
    GOOD: 10,
    EASY: 1440, // 1 day
  },

  // Review session
  REVIEW_SESSION: {
    MAX_WORDS_PER_SESSION: 50,
    MIN_WORDS_FOR_SESSION: 1,
  },
} as const
