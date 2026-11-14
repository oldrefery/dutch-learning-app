import { render, screen, within } from '@testing-library/react'
import CollectionsPage from '@/app/app/collections/page'
import { InsightsDashboard } from '@/features/insights/InsightsDashboard'
import { ReviewWorkspace } from '@/features/review/ReviewWorkspace'
import { buildCollectionOverviews } from '@/features/collections/collection-overview'
import { listCollectionOverviews } from '@/features/collections/repository'
import { makeData, makeWord } from '@/features/review/__fixtures__/session'
import { DEFAULT_WEB_SETTINGS } from '@/features/settings/settings-storage'
import { getReviewCalendar } from './server'
import { ReviewCalendarProvider } from './ReviewCalendarProvider'
import { calendarReferenceDate } from './calendar'

const router = { refresh: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/collections',
}))
jest.mock('@/lib/auth/session', () => ({
  requireAuthContext: async () => ({
    userId: 'owner',
    accessLevel: 'full_access',
  }),
}))
jest.mock('@/lib/review-calendar/server', () => ({
  getReviewCalendar: jest.fn(),
}))
jest.mock('@/features/collections/repository', () => ({
  listCollectionOverviews: jest.fn(),
  getReviewStreak: async () => 2,
}))
jest.mock('@/features/collections/CreateCollectionForm', () => ({
  CreateCollectionForm: () => null,
}))
jest.mock('@/features/dictionary/repository', () => ({
  isDictionaryContentEnabled: () => true,
}))
jest.mock('@/features/review/actions', () => ({
  submitReviewAssessment: jest.fn(),
}))
jest.mock('@/features/review/correction-actions', () => ({
  submitReviewCorrection: jest.fn(),
}))
jest.mock('@/features/review/correction-refresh', () => ({
  loadReviewCorrectionState: jest.fn(),
}))
jest.mock('@/features/review/details-action', () => ({
  loadReviewWordDetails: jest.fn(),
}))
jest.mock('@/features/words/actions', () => ({ reanalyzeWord: jest.fn() }))
jest.mock('@/features/settings/useWebSettings', () => ({
  useWebSettings: () => ({ settings: DEFAULT_WEB_SETTINGS, update: jest.fn() }),
}))

test('rendered Collections, Review and Insights agree before and after midnight', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 13, 23, 59, 59))
  const collection = {
    collection_id: 'collection-1',
    name: 'Words',
    is_shared: false,
    created_at: '2026-01-01',
    updated_at: null,
  }
  const words = ['2026-11-12', '2026-11-13', '2026-11-14'].map(
    (date, index) => ({
      word_id: `w-${index}`,
      dutch_lemma: `woord-${index}`,
      easiness_factor: 2.5,
      interval_days: 95,
      next_review_date: date,
      repetition_count: 5,
      collection_id: collection.collection_id,
      translations: { en: ['word'] },
      article: null,
      dutch_original: null,
      part_of_speech: 'noun',
    })
  )
  const data = makeData(
    words.map(word =>
      makeWord(word.word_id, 'word', {
        nextReviewDate: word.next_review_date,
        repetitionCount: 5,
      })
    )
  )
  const original = JSON.stringify({ words, data })
  const view = async (dateKey: string) => {
    const calendar = {
      dateKey,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    jest.mocked(getReviewCalendar).mockResolvedValue(calendar)
    jest
      .mocked(listCollectionOverviews)
      .mockResolvedValue(
        buildCollectionOverviews(
          [collection],
          words,
          calendarReferenceDate(dateKey)
        )
      )
    const collectionsPage = await CollectionsPage()
    return (
      <ReviewCalendarProvider calendar={calendar}>
        <div data-testid="collections">{collectionsPage}</div>
        <div data-testid="review">
          <ReviewWorkspace
            canUseAi={false}
            userId="owner"
            data={data}
            initialScope="all-due"
            initialCollectionId={null}
          />
        </div>
        <div data-testid="insights">
          <InsightsDashboard data={{ collections: data.collections, words }} />
        </div>
      </ReviewCalendarProvider>
    )
  }
  const assertCounts = (due: number, overdue: number) => {
    const collections = within(screen.getByTestId('collections'))
    expect(
      collections.getByRole('link', { name: `Start review · ${due}` })
    ).toBeInTheDocument()
    expect(collections.getByText('Mastered').parentElement).toHaveTextContent(
      '3'
    )
    const review = within(screen.getByTestId('review'))
    expect(
      review.getByRole('button', { name: new RegExp(`Start · ${due}`) })
    ).toBeInTheDocument()
    const insights = within(screen.getByTestId('insights'))
    expect(
      insights.getByText('Due today').nextElementSibling
    ).toHaveTextContent('1')
    expect(insights.getByText('Overdue').nextElementSibling).toHaveTextContent(
      String(overdue)
    )
    expect(insights.getByText('Mastered').nextElementSibling).toHaveTextContent(
      '3'
    )
  }
  try {
    const { rerender } = render(await view('2026-11-13'))
    assertCounts(2, 1)
    jest.setSystemTime(new Date(2026, 10, 14, 0, 0, 0))
    rerender(await view('2026-11-14'))
    assertCounts(3, 2)
    expect(JSON.stringify({ words, data })).toBe(original)
  } finally {
    jest.useRealTimers()
  }
})
