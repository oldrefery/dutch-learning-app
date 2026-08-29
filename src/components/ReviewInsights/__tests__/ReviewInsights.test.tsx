import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { buildReviewInsights } from '@/utils/reviewInsights'
import { DifficultWordRow } from '../DifficultWordRow'
import {
  ReviewInsightsEmptyState,
  ReviewInsightsSummary,
} from '../ReviewInsightsSummary'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

const mockUseNormalizedColorScheme =
  useNormalizedColorScheme as jest.MockedFunction<
    typeof useNormalizedColorScheme
  >

const referenceDate = new Date(2026, 7, 28, 12)
const insights = buildReviewInsights(
  [
    createMockWord({
      word_id: 'difficult-due',
      dutch_original: 'het huis',
      easiness_factor: 2.1,
      repetition_count: 3,
      next_review_date: '2026-08-28',
    }),
    createMockWord({
      word_id: 'standard-tomorrow',
      dutch_original: 'de tafel',
      easiness_factor: 2.5,
      interval_days: 8,
      next_review_date: '2026-08-29',
    }),
  ],
  referenceDate
)

describe.each(['light', 'dark'] as const)('%s ReviewInsightsSummary', theme => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue(theme)
  })

  it('renders an accessible forecast and matches the theme snapshot', () => {
    const screen = render(
      <ReviewInsightsSummary
        insights={insights}
        isStartingReview={false}
        onStartDifficultReview={jest.fn()}
      />
    )

    expect(
      screen.getByTestId('forecast-accessible-summary').props.accessibilityLabel
    ).toContain('Review forecast')
    expect(screen.toJSON()).toMatchSnapshot()
  })
})

describe('ReviewInsights interactions and empty state', () => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue('light')
  })

  it('starts a due difficult review from the explicit action', () => {
    const onStartDifficultReview = jest.fn()
    const { getByTestId } = render(
      <ReviewInsightsSummary
        insights={insights}
        isStartingReview={false}
        onStartDifficultReview={onStartDifficultReview}
      />
    )

    fireEvent.press(getByTestId('review-due-difficult-words'))

    expect(onStartDifficultReview).toHaveBeenCalledTimes(1)
  })

  it('renders a refreshable empty state', () => {
    const onRefresh = jest.fn()
    const { getByRole, getByTestId } = render(
      <ReviewInsightsEmptyState onRefresh={onRefresh} />
    )

    expect(getByTestId('review-insights-empty-state')).toBeTruthy()
    fireEvent.press(getByRole('button', { name: 'Refresh review insights' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('renders an explicit load error when no cached words exist', () => {
    const { getByTestId, getByText } = render(
      <ReviewInsightsEmptyState
        onRefresh={jest.fn()}
        errorMessage="Local cache is unavailable"
      />
    )

    expect(
      getByTestId('review-insights-empty-state').props.accessibilityRole
    ).toBe('alert')
    expect(getByText('Could not load insights')).toBeTruthy()
    expect(getByText('Local cache is unavailable')).toBeTruthy()
  })

  it('opens a difficult word without invoking review logic', () => {
    const onPress = jest.fn()
    const word = insights.difficultWords[0]
    const { getByTestId } = render(
      <DifficultWordRow word={word} onPress={onPress} />
    )

    fireEvent.press(getByTestId(`difficult-word-${word.word_id}`))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
