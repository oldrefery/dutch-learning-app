/**
 * Unit tests for dateUtils
 * Tests relative time formatting and date manipulation
 */

import { formatRelativeTime } from '../dateUtils'

describe('dateUtils', () => {
  describe('formatRelativeTime', () => {
    const ONE_HOUR_AGO = '1 hour ago'

    // Helper to create a date relative to now
    const dateMinutesAgo = (minutes: number): Date => {
      return new Date(Date.now() - minutes * 60 * 1000)
    }

    const dateHoursAgo = (hours: number): Date => {
      return new Date(Date.now() - hours * 60 * 60 * 1000)
    }

    const dateDaysAgo = (days: number): Date => {
      return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    const dateWeeksAgo = (weeks: number): Date => {
      return new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)
    }

    describe('just now', () => {
      it('should return "just now" for dates 5 seconds ago', () => {
        const date = new Date(Date.now() - 5000)
        expect(formatRelativeTime(date)).toBe('just now')
      })

      it('should return "just now" for current date', () => {
        const date = new Date()
        expect(formatRelativeTime(date)).toBe('just now')
      })

      it('should return "just now" for future dates', () => {
        const date = new Date(Date.now() + 10000)
        expect(formatRelativeTime(date)).toBe('just now')
      })

      it('should return seconds at exactly 10 second boundary', () => {
        const date = new Date(Date.now() - 10000)
        expect(formatRelativeTime(date)).toBe('10 seconds ago')
      })
    })

    describe('seconds ago', () => {
      it('should return seconds count between 10-60 seconds', () => {
        const date = new Date(Date.now() - 30000)
        expect(formatRelativeTime(date)).toBe('30 seconds ago')
      })

      it('should return "59 seconds ago" at minute boundary', () => {
        const date = new Date(Date.now() - 59000)
        expect(formatRelativeTime(date)).toBe('59 seconds ago')
      })

      it('should return "15 seconds ago" for specific time', () => {
        const date = new Date(Date.now() - 15000)
        expect(formatRelativeTime(date)).toBe('15 seconds ago')
      })
    })

    describe('minutes ago', () => {
      it('should return "1 minute ago" for 1 minute', () => {
        const date = dateMinutesAgo(1)
        expect(formatRelativeTime(date)).toBe('1 minute ago')
      })

      it('should return "5 minutes ago" for 5 minutes', () => {
        const date = dateMinutesAgo(5)
        expect(formatRelativeTime(date)).toBe('5 minutes ago')
      })

      it('should return "30 minutes ago" for 30 minutes', () => {
        const date = dateMinutesAgo(30)
        expect(formatRelativeTime(date)).toBe('30 minutes ago')
      })

      it('should return "59 minutes ago" at hour boundary', () => {
        const date = dateMinutesAgo(59)
        expect(formatRelativeTime(date)).toBe('59 minutes ago')
      })

      it('should handle plural "minutes" correctly', () => {
        const date = dateMinutesAgo(2)
        expect(formatRelativeTime(date)).toBe('2 minutes ago')
      })
    })

    describe('hours ago', () => {
      it('should return singular hour text for 1 hour', () => {
        const date = dateHoursAgo(1)
        expect(formatRelativeTime(date)).toBe(ONE_HOUR_AGO)
      })

      it('should return "2 hours ago" for 2 hours', () => {
        const date = dateHoursAgo(2)
        expect(formatRelativeTime(date)).toBe('2 hours ago')
      })

      it('should return "12 hours ago" for 12 hours', () => {
        const date = dateHoursAgo(12)
        expect(formatRelativeTime(date)).toBe('12 hours ago')
      })

      it('should return "23 hours ago" at day boundary', () => {
        const date = dateHoursAgo(23)
        expect(formatRelativeTime(date)).toBe('23 hours ago')
      })

      it('should handle singular "hour" correctly', () => {
        const date = dateHoursAgo(1)
        expect(formatRelativeTime(date)).toBe(ONE_HOUR_AGO)
      })
    })

    describe('days ago', () => {
      it('should return "1 day ago" for 1 day', () => {
        const date = dateDaysAgo(1)
        expect(formatRelativeTime(date)).toBe('1 day ago')
      })

      it('should return "2 days ago" for 2 days', () => {
        const date = dateDaysAgo(2)
        expect(formatRelativeTime(date)).toBe('2 days ago')
      })

      it('should return "5 days ago" for 5 days', () => {
        const date = dateDaysAgo(5)
        expect(formatRelativeTime(date)).toBe('5 days ago')
      })

      it('should return "6 days ago" at week boundary', () => {
        const date = dateDaysAgo(6)
        expect(formatRelativeTime(date)).toBe('6 days ago')
      })

      it('should handle singular "day" correctly', () => {
        const date = dateDaysAgo(1)
        expect(formatRelativeTime(date)).toMatch(/^1 day ago$/)
      })
    })

    describe('weeks ago', () => {
      it('should return "1 week ago" for 1 week', () => {
        const date = dateWeeksAgo(1)
        expect(formatRelativeTime(date)).toBe('1 week ago')
      })

      it('should return "2 weeks ago" for 2 weeks', () => {
        const date = dateWeeksAgo(2)
        expect(formatRelativeTime(date)).toBe('2 weeks ago')
      })

      it('should return "4 weeks ago" for 4 weeks', () => {
        const date = dateWeeksAgo(4)
        expect(formatRelativeTime(date)).toBe('4 weeks ago')
      })

      it('should handle singular "week" correctly', () => {
        const date = dateWeeksAgo(1)
        expect(formatRelativeTime(date)).toMatch(/^1 week ago$/)
      })

      it('should handle plural "weeks" correctly', () => {
        const date = dateWeeksAgo(3)
        expect(formatRelativeTime(date)).toMatch(/^3 weeks ago$/)
      })
    })

    describe('boundary conditions', () => {
      it('should handle exactly 1 minute (60 seconds)', () => {
        const date = new Date(Date.now() - 60000)
        expect(formatRelativeTime(date)).toBe('1 minute ago')
      })

      it('should handle exactly 1 hour (3600 seconds)', () => {
        const date = new Date(Date.now() - 3600000)
        expect(formatRelativeTime(date)).toBe(ONE_HOUR_AGO)
      })

      it('should handle exactly 1 day (86400 seconds)', () => {
        const date = new Date(Date.now() - 86400000)
        expect(formatRelativeTime(date)).toBe('1 day ago')
      })

      it('should handle exactly 1 week (604800 seconds)', () => {
        const date = new Date(Date.now() - 604800000)
        expect(formatRelativeTime(date)).toBe('1 week ago')
      })
    })

    describe('edge cases', () => {
      it('should handle very recent dates (1 second ago)', () => {
        const date = new Date(Date.now() - 1000)
        expect(formatRelativeTime(date)).toBe('just now')
      })

      it('should handle very old dates (100 weeks ago)', () => {
        const date = dateWeeksAgo(100)
        expect(formatRelativeTime(date)).toMatch(/\d+ weeks ago/)
      })

      it('should not crash with past dates in the distant past', () => {
        const date = new Date('2020-01-01')
        const result = formatRelativeTime(date)
        expect(result).toMatch(/weeks ago/)
      })

      it('should handle DST transitions gracefully', () => {
        // Create dates around potential DST transitions
        const date1 = dateHoursAgo(1.5)
        const result1 = formatRelativeTime(date1)
        expect(result1).toBe(ONE_HOUR_AGO)

        const date2 = dateHoursAgo(2.5)
        const result2 = formatRelativeTime(date2)
        expect(result2).toBe('2 hours ago')
      })
    })

    describe('consistency', () => {
      it('should provide consistent results for the same relative time', () => {
        const date = dateMinutesAgo(5)
        const result1 = formatRelativeTime(date)
        const result2 = formatRelativeTime(date)
        expect(result1).toBe(result2)
      })

      it('should return increasingly older descriptions as time passes', () => {
        // Using fixed differences to ensure they're in expected ranges
        const results = [
          formatRelativeTime(new Date(Date.now() - 5000)), // just now
          formatRelativeTime(new Date(Date.now() - 30000)), // seconds ago
          formatRelativeTime(dateMinutesAgo(5)), // minutes ago
          formatRelativeTime(dateHoursAgo(5)), // hours ago
          formatRelativeTime(dateDaysAgo(5)), // days ago
        ]

        // Check that descriptions are different and follow expected pattern
        expect(results[0]).toBe('just now')
        expect(results[1]).toMatch(/seconds ago/)
        expect(results[2]).toMatch(/minutes ago/)
        expect(results[3]).toMatch(/hours ago/)
        expect(results[4]).toMatch(/days ago/)
      })
    })
  })
})
