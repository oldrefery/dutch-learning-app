/**
 * SRS (Spaced Repetition System) Constants
 *
 * Centralized constants for the spaced repetition algorithm
 */
// SRS Assessment types - user's evaluation of how well they knew the word
export const SRS_ASSESSMENT = {
  AGAIN: 'again',
  HARD: 'hard',
  GOOD: 'good',
  EASY: 'easy',
} as const

// Type for SRS assessments
export type SRSAssessmentType =
  (typeof SRS_ASSESSMENT)[keyof typeof SRS_ASSESSMENT]

// SRS Algorithm Parameters
export const SRS_PARAMS = {
  // Initial values for new words
  INITIAL: {
    INTERVAL_DAYS: 0, // Available immediately for first review
    REPETITION_COUNT: 0, // No successful reviews yet
    EASINESS_FACTOR: 2.5, // Starting easiness factor
  },

  // Easiness factor adjustments
  EASINESS_ADJUSTMENT: {
    AGAIN: -0.2, // Significant penalty for forgetting
    HARD: -0.15, // Small penalty for difficulty
    GOOD: 0.0, // No change for the correct answer
    EASY: 0.15, // Bonus for easy recall
  },

  // Easiness factor bounds
  EASINESS_BOUNDS: {
    MIN: 1.3, // Minimum easiness factor
    MAX: 2.5, // Maximum easiness factor
  },

  // Fixed intervals for first reviews
  FIRST_INTERVALS: {
    GOOD: {
      FIRST: 1, // 1 day after first correct
      SECOND: 6, // 6 days after the second correct
    },
    EASY: {
      FIRST: 4, // 4 days after first easy
      SECOND: 10, // 10 days after the second easy
    },
  },

  // Multipliers
  MULTIPLIERS: {
    HARD: 1.2, // 20% increase for hard
    EASY: 1.3, // 30% bonus for easy
  },
} as const
