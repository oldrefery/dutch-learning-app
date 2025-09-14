import { APP_STORE_CONSTANTS } from '@/constants/AppStoreConstants'

export const appStoreUtils = {
  /**
   * Calculate next review date based on SRS assessment
   */
  calculateNextReviewDate: (
    assessment: string,
    currentInterval: number = 1
  ): number => {
    const intervals = APP_STORE_CONSTANTS.SRS_INTERVALS
    let newInterval: number

    switch (assessment) {
      case 'again':
        newInterval = intervals.AGAIN
        break
      case 'hard':
        newInterval = intervals.HARD
        break
      case 'good':
        newInterval = intervals.GOOD
        break
      case 'easy':
        newInterval = intervals.EASY
        break
      default:
        newInterval = intervals.GOOD
    }

    // Convert minutes to days for storage
    return Math.ceil(newInterval / (24 * 60))
  },

  /**
   * Calculate new easiness factor based on SRS assessment
   */
  calculateEasinessFactor: (
    assessment: string,
    currentEasiness: number = 2.5
  ): number => {
    const baseEasiness = currentEasiness

    switch (assessment) {
      case 'again':
        return Math.max(1.3, baseEasiness - 0.2)
      case 'hard':
        return Math.max(1.3, baseEasiness - 0.15)
      case 'good':
        return baseEasiness
      case 'easy':
        return Math.min(2.5, baseEasiness + 0.15)
      default:
        return baseEasiness
    }
  },

  /**
   * Check if word is due for review
   */
  isWordDueForReview: (word: any): boolean => {
    if (!word.next_review_date) return true

    const today = new Date().toISOString().split('T')[0]
    return word.next_review_date <= today
  },

  /**
   * Filter words that are due for review
   */
  filterWordsForReview: (words: any[]): any[] => {
    return words.filter(appStoreUtils.isWordDueForReview)
  },
}
