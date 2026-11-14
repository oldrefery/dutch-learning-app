import { buildReviewInsights } from '@woordenaar/domain'
import { buildCollectionOverviews } from '@/features/collections/collection-overview'
import { selectReviewWords } from '@/features/review/review-domain'
import { makeWord } from '@/features/review/__fixtures__/session'
import {
  calendarReferenceDate,
  createReviewCalendar,
  normalizeTimeZone,
} from './calendar'

test.each([
  ['Europe/Amsterdam', '2026-11-13T22:59:59Z', '2026-11-13'],
  ['Europe/Amsterdam', '2026-11-13T23:00:00Z', '2026-11-14'],
  ['America/Los_Angeles', '2026-11-14T07:59:59Z', '2026-11-13'],
  ['America/Los_Angeles', '2026-11-14T08:00:00Z', '2026-11-14'],
  ['Asia/Kathmandu', '2026-11-13T18:15:00Z', '2026-11-14'],
  ['Pacific/Kiritimati', '2026-12-31T10:00:00Z', '2027-01-01'],
  ['Europe/Amsterdam', '2026-03-28T23:00:00Z', '2026-03-29'],
  ['Europe/Amsterdam', '2026-03-29T22:00:00Z', '2026-03-30'],
  ['Europe/Amsterdam', '2026-10-24T22:00:00Z', '2026-10-25'],
  ['Europe/Amsterdam', '2026-10-25T23:00:00Z', '2026-10-26'],
])(
  'uses %s calendar at %s regardless of server time zone',
  (zone, instant, expected) => {
    expect(createReviewCalendar(zone, new Date(instant)).dateKey).toBe(expected)
    const reference = calendarReferenceDate(expected)
    expect(reference.getDate()).toBe(Number(expected.slice(-2)))
  }
)

test.each([undefined, '', 'invalid/zone', '../../bad', 'x'.repeat(101)])(
  'invalid cookie %s falls back safely',
  value => {
    expect(normalizeTimeZone(value)).toBe('UTC')
  }
)

test('all three selectors change 1096 to 1107 together without modifying progress', () => {
  const words = Array.from({ length: 2396 }, (_, index) =>
    Object.freeze({
      word_id: `word-${index}`,
      collection_id: 'collection-1',
      dutch_lemma: `woord-${index}`,
      easiness_factor: index < 955 ? 2 : 2.5,
      interval_days: 95,
      repetition_count: index < 2149 ? 5 : 0,
      next_review_date:
        index < 1077
          ? '2026-11-12'
          : index < 1096
            ? '2026-11-13'
            : index < 1107
              ? '2026-11-14'
              : '2026-12-01',
      last_reviewed_at: '2026-08-10T10:00:00Z',
    })
  )
  const before = JSON.stringify(words)
  const reviewWords = words.map(word =>
    makeWord(word.word_id, 'word', {
      nextReviewDate: word.next_review_date,
      easinessFactor: word.easiness_factor,
      intervalDays: word.interval_days,
      repetitionCount: word.repetition_count,
      lastReviewedAt: word.last_reviewed_at,
    })
  )
  const collection = {
    collection_id: 'collection-1',
    name: 'Words',
    is_shared: false,
    created_at: '2026-01-01',
    updated_at: null,
  }
  const counts = ['2026-11-13T22:59:59Z', '2026-11-13T23:00:00Z'].map(
    instant => {
      const calendar = createReviewCalendar(
        'Europe/Amsterdam',
        new Date(instant)
      )
      const today = calendarReferenceDate(calendar.dateKey)
      const [overview] = buildCollectionOverviews([collection], words, today)
      const insights = buildReviewInsights(words, today)
      const review = selectReviewWords(reviewWords, 'all-due', null, today)
      expect(overview).toMatchObject({
        totalWords: 2396,
        masteredWords: 2149,
        difficultWords: 955,
      })
      expect(insights.masteredWords).toHaveLength(2149)
      expect(insights.forecast.today + insights.forecast.overdue).toBe(
        overview.dueWords
      )
      expect(review).toHaveLength(overview.dueWords)
      return overview.dueWords
    }
  )
  expect(counts).toEqual([1096, 1107])
  expect(JSON.stringify(words)).toBe(before)
})
