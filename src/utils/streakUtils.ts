import type { Word } from '@/types/database'

/**
 * Calculate the current study streak in days
 * A streak is the number of consecutive days the user has reviewed words
 *
 * @param words - Array of all user's words
 * @returns Number of consecutive days with reviews (0 if no reviews or streak broken)
 */
export function calculateStreak(words: Word[]): number {
  if (words.length === 0) {
    return 0
  }

  // Get all unique review dates (date only, no time)
  const reviewDates = words
    .filter(word => word && word.last_reviewed_at)
    .map(word => {
      const date = new Date(word!.last_reviewed_at!)
      // Normalize to midnight UTC to compare dates only
      return new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      ).getTime()
    })

  if (reviewDates.length === 0) {
    return 0
  }

  // Get unique dates and sort descending (newest first)
  const uniqueDates = Array.from(new Set(reviewDates)).sort((a, b) => b - a)

  // Get today at midnight UTC
  const today = new Date()
  const todayMidnight = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  ).getTime()

  // Get yesterday at midnight UTC
  const yesterdayMidnight = todayMidnight - 24 * 60 * 60 * 1000

  // Start counting from today or yesterday (if no review today)
  let streakCount = 0
  let currentDate = uniqueDates.includes(todayMidnight)
    ? todayMidnight
    : yesterdayMidnight

  // If the most recent review is older than yesterday, streak is broken
  if (uniqueDates[0] < yesterdayMidnight) {
    return 0
  }

  // Count consecutive days backwards
  for (const reviewDate of uniqueDates) {
    if (reviewDate === currentDate) {
      streakCount++
      currentDate -= 24 * 60 * 60 * 1000 // Go back one day
    } else if (reviewDate < currentDate) {
      // Gap found - streak is broken
      break
    }
  }

  return streakCount
}
