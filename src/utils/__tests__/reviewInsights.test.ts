import { createMockWord } from '@/__tests__/helpers/factories'
import { MASTERED_MIN_REPETITIONS } from '@/constants/ReviewConstants'
import {
  buildReviewForecast,
  buildReviewInsights,
  getForecastBucketTotal,
  isDifficultWord,
} from '../reviewInsights'

const REFERENCE_DATE = new Date(2026, 2, 28, 23, 30)
const DST_FIRST_DAY = '2026-03-29'
const DIFFICULT_DUE_ID = 'difficult-due'

describe('reviewInsights', () => {
  it('buckets every word exactly once without double-counting overdue and today', () => {
    const words = [
      createMockWord({ word_id: 'overdue', next_review_date: '2026-03-27' }),
      createMockWord({ word_id: 'today', next_review_date: '2026-03-28' }),
      createMockWord({ word_id: 'tomorrow', next_review_date: DST_FIRST_DAY }),
      createMockWord({ word_id: 'day-seven', next_review_date: '2026-04-04' }),
      createMockWord({ word_id: 'later', next_review_date: '2026-04-05' }),
      createMockWord({ word_id: 'invalid', next_review_date: 'invalid' }),
    ]

    const forecast = buildReviewForecast(words, REFERENCE_DATE)

    expect(forecast).toMatchObject({
      total: 6,
      overdue: 1,
      today: 1,
      later: 1,
      unscheduled: 1,
    })
    expect(forecast.nextSevenDays.map(day => day.count)).toEqual([
      1, 0, 0, 0, 0, 0, 1,
    ])
    expect(getForecastBucketTotal(forecast)).toBe(words.length)
  })

  it('uses local calendar increments across the spring DST transition', () => {
    const forecast = buildReviewForecast(
      [
        createMockWord({ next_review_date: DST_FIRST_DAY }),
        createMockWord({ next_review_date: '2026-03-30' }),
      ],
      REFERENCE_DATE
    )

    expect(forecast.nextSevenDays.slice(0, 2)).toEqual([
      { dateKey: DST_FIRST_DAY, dayOffset: 1, count: 1 },
      { dateKey: '2026-03-30', dayOffset: 2, count: 1 },
    ])
  })

  it('does not classify a new word at easiness factor 2.5 as difficult', () => {
    expect(isDifficultWord(createMockWord({ easiness_factor: 2.5 }))).toBe(
      false
    )
    expect(isDifficultWord(createMockWord({ easiness_factor: 2.1 }))).toBe(true)
  })

  it('builds deterministic difficulty, mastery, and distribution totals', () => {
    const words = [
      createMockWord({
        word_id: DIFFICULT_DUE_ID,
        dutch_lemma: 'appel',
        easiness_factor: 2.1,
        interval_days: 0,
        repetition_count: MASTERED_MIN_REPETITIONS,
        next_review_date: '2026-03-28',
      }),
      createMockWord({
        word_id: 'difficult-future',
        dutch_lemma: 'boek',
        easiness_factor: 1.9,
        interval_days: 8,
        next_review_date: '2026-04-02',
      }),
      createMockWord({
        word_id: 'standard',
        easiness_factor: 2.5,
        interval_days: 30,
      }),
    ]

    const insights = buildReviewInsights(words, REFERENCE_DATE)

    expect(insights.difficultWords.map(word => word.word_id)).toEqual([
      DIFFICULT_DUE_ID,
      'difficult-future',
    ])
    expect(insights.dueDifficultWords.map(word => word.word_id)).toEqual([
      DIFFICULT_DUE_ID,
    ])
    expect(insights.masteredWords).toHaveLength(1)
    expect(
      insights.intervalDistribution.reduce(
        (total, bucket) => total + bucket.count,
        0
      )
    ).toBe(words.length)
    expect(
      insights.easinessDistribution.reduce(
        (total, bucket) => total + bucket.count,
        0
      )
    ).toBe(words.length)
  })
})
