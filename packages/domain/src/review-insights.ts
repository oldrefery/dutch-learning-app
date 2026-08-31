export const DIFFICULT_EASINESS_FACTOR_THRESHOLD = 2.1
export const MASTERED_MIN_REPETITIONS = 3

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface ReviewInsightWord {
  dutch_lemma: string
  easiness_factor: number
  interval_days: number
  next_review_date: string
  repetition_count: number
  word_id: string
}

export interface ForecastDay {
  count: number
  dateKey: string
  dayOffset: number
}

export interface ReviewForecast {
  later: number
  nextSevenDays: ForecastDay[]
  overdue: number
  today: number
  total: number
  unscheduled: number
}

export interface DistributionBucket {
  count: number
  id: string
  label: string
}

export interface ReviewInsights<
  T extends ReviewInsightWord = ReviewInsightWord,
> {
  difficultWords: T[]
  dueDifficultWords: T[]
  easinessDistribution: DistributionBucket[]
  forecast: ReviewForecast
  intervalDistribution: DistributionBucket[]
  masteredWords: T[]
}

const padDatePart = (value: number): string => String(value).padStart(2, '0')

export const toLocalDateKey = (date: Date): string =>
  [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')

export const normalizeReviewDateToLocalKey = (
  reviewDate: string
): string | null => {
  if (DATE_ONLY_PATTERN.test(reviewDate)) return reviewDate

  const parsedDate = new Date(reviewDate)
  return Number.isNaN(parsedDate.getTime()) ? null : toLocalDateKey(parsedDate)
}

export const isDueOnLocalDate = (
  reviewDate: string | null | undefined,
  referenceDate: Date = new Date()
): boolean => {
  if (!reviewDate) return false

  const reviewDateKey = normalizeReviewDateToLocalKey(reviewDate)
  return (
    reviewDateKey !== null && reviewDateKey <= toLocalDateKey(referenceDate)
  )
}

const addLocalCalendarDays = (date: Date, dayOffset: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, 12)

export function buildReviewForecast<T extends ReviewInsightWord>(
  words: readonly T[],
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

export function buildIntervalDistribution<T extends ReviewInsightWord>(
  words: readonly T[]
): DistributionBucket[] {
  const buckets: DistributionBucket[] = [
    { id: 'new', label: 'New · 0 days', count: 0 },
    { id: 'short', label: 'Short · 1–6 days', count: 0 },
    { id: 'developing', label: 'Developing · 7–20 days', count: 0 },
    { id: 'established', label: 'Established · 21+ days', count: 0 },
  ]

  words.forEach(word => {
    if (word.interval_days <= 0) buckets[0].count += 1
    else if (word.interval_days <= 6) buckets[1].count += 1
    else if (word.interval_days <= 20) buckets[2].count += 1
    else buckets[3].count += 1
  })

  return buckets
}

export function buildEasinessDistribution<T extends ReviewInsightWord>(
  words: readonly T[]
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

export const isDifficultWord = <T extends ReviewInsightWord>(
  word: T
): boolean => word.easiness_factor <= DIFFICULT_EASINESS_FACTOR_THRESHOLD

export const isMasteredWord = <
  T extends Pick<ReviewInsightWord, 'repetition_count'>,
>(
  word: T
): boolean => word.repetition_count >= MASTERED_MIN_REPETITIONS

export function buildReviewInsights<T extends ReviewInsightWord>(
  words: readonly T[],
  referenceDate: Date = new Date()
): ReviewInsights<T> {
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
