import {
  DIFFICULT_EASINESS_FACTOR_THRESHOLD,
  MASTERED_MIN_REPETITIONS,
} from '@/constants/ReviewConstants'
import type { Word } from '@/types/database'
import {
  isDueOnLocalDate,
  normalizeReviewDateToLocalKey,
  toLocalDateKey,
} from './dateUtils'

export interface ForecastDay {
  dateKey: string
  dayOffset: number
  count: number
}

export interface ReviewForecast {
  total: number
  overdue: number
  today: number
  nextSevenDays: ForecastDay[]
  later: number
  unscheduled: number
}

export interface DistributionBucket {
  id: string
  label: string
  count: number
}

export interface ReviewInsights {
  forecast: ReviewForecast
  intervalDistribution: DistributionBucket[]
  easinessDistribution: DistributionBucket[]
  difficultWords: Word[]
  dueDifficultWords: Word[]
  masteredWords: Word[]
}

const addLocalCalendarDays = (date: Date, dayOffset: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, 12)

export function buildReviewForecast(
  words: readonly Word[],
  referenceDate: Date = new Date()
): ReviewForecast {
  const todayKey = toLocalDateKey(referenceDate)
  const nextSevenDays = Array.from({ length: 7 }, (_, index) => ({
    dateKey: toLocalDateKey(addLocalCalendarDays(referenceDate, index + 1)),
    dayOffset: index + 1,
    count: 0,
  }))
  const upcomingDayIndexes = new Map(
    nextSevenDays.map((day, index) => [day.dateKey, index])
  )

  let overdue = 0
  let today = 0
  let later = 0
  let unscheduled = 0

  words.forEach(word => {
    const reviewDateKey = normalizeReviewDateToLocalKey(word.next_review_date)

    if (!reviewDateKey) {
      unscheduled += 1
      return
    }

    if (reviewDateKey < todayKey) {
      overdue += 1
      return
    }

    if (reviewDateKey === todayKey) {
      today += 1
      return
    }

    const upcomingIndex = upcomingDayIndexes.get(reviewDateKey)
    if (upcomingIndex !== undefined) {
      nextSevenDays[upcomingIndex].count += 1
      return
    }

    later += 1
  })

  return {
    total: words.length,
    overdue,
    today,
    nextSevenDays,
    later,
    unscheduled,
  }
}

export function buildIntervalDistribution(
  words: readonly Word[]
): DistributionBucket[] {
  const buckets: DistributionBucket[] = [
    { id: 'new', label: 'New · 0 days', count: 0 },
    { id: 'short', label: 'Short · 1–6 days', count: 0 },
    { id: 'developing', label: 'Developing · 7–20 days', count: 0 },
    { id: 'established', label: 'Established · 21+ days', count: 0 },
  ]

  words.forEach(word => {
    if (word.interval_days <= 0) {
      buckets[0].count += 1
    } else if (word.interval_days <= 6) {
      buckets[1].count += 1
    } else if (word.interval_days <= 20) {
      buckets[2].count += 1
    } else {
      buckets[3].count += 1
    }
  })

  return buckets
}

export function buildEasinessDistribution(
  words: readonly Word[]
): DistributionBucket[] {
  const buckets: DistributionBucket[] = [
    { id: 'difficult', label: 'Difficult · ≤ 2.10', count: 0 },
    { id: 'learning', label: 'Learning · 2.11–2.49', count: 0 },
    { id: 'standard', label: 'Standard · 2.50+', count: 0 },
  ]

  words.forEach(word => {
    if (word.easiness_factor <= DIFFICULT_EASINESS_FACTOR_THRESHOLD) {
      buckets[0].count += 1
    } else if (word.easiness_factor < 2.5) {
      buckets[1].count += 1
    } else {
      buckets[2].count += 1
    }
  })

  return buckets
}

export const isDifficultWord = (word: Word): boolean =>
  word.easiness_factor <= DIFFICULT_EASINESS_FACTOR_THRESHOLD

export const isMasteredWord = (word: Word): boolean =>
  word.repetition_count >= MASTERED_MIN_REPETITIONS

export function buildReviewInsights(
  words: readonly Word[],
  referenceDate: Date = new Date()
): ReviewInsights {
  const difficultWords = words.filter(isDifficultWord).sort((left, right) => {
    const dueDifference =
      Number(isDueOnLocalDate(right.next_review_date, referenceDate)) -
      Number(isDueOnLocalDate(left.next_review_date, referenceDate))

    return (
      dueDifference ||
      left.easiness_factor - right.easiness_factor ||
      left.dutch_lemma.localeCompare(right.dutch_lemma)
    )
  })

  return {
    forecast: buildReviewForecast(words, referenceDate),
    intervalDistribution: buildIntervalDistribution(words),
    easinessDistribution: buildEasinessDistribution(words),
    difficultWords,
    dueDifficultWords: difficultWords.filter(word =>
      isDueOnLocalDate(word.next_review_date, referenceDate)
    ),
    masteredWords: words.filter(isMasteredWord),
  }
}

export function getForecastBucketTotal(forecast: ReviewForecast): number {
  return (
    forecast.overdue +
    forecast.today +
    forecast.nextSevenDays.reduce((total, day) => total + day.count, 0) +
    forecast.later +
    forecast.unscheduled
  )
}
