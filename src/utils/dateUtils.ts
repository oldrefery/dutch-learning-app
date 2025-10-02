/**
 * Date utilities - custom implementation for React Native
 */

/**
 * Format a date as relative time (e.g., "5 minutes ago", "2 hours ago")
 * Custom implementation - no external dependencies needed
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Time unit thresholds
  const minute = 60
  const hour = minute * 60
  const day = hour * 24
  const week = day * 7

  // Handle future dates
  if (diffInSeconds < 0) {
    return 'just now'
  }

  // Just now (less than 10 seconds)
  if (diffInSeconds < 10) {
    return 'just now'
  }

  // Seconds ago
  if (diffInSeconds < minute) {
    return `${diffInSeconds} seconds ago`
  }

  // Minutes ago
  if (diffInSeconds < hour) {
    const minutes = Math.floor(diffInSeconds / minute)
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  }

  // Hours ago
  if (diffInSeconds < day) {
    const hours = Math.floor(diffInSeconds / hour)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }

  // Days ago
  if (diffInSeconds < week) {
    const days = Math.floor(diffInSeconds / day)
    return days === 1 ? '1 day ago' : `${days} days ago`
  }

  // Weeks ago
  const weeks = Math.floor(diffInSeconds / week)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}
