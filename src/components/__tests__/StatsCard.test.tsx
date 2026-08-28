import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { StatsCard } from '../StatsCard'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

const mockUseNormalizedColorScheme =
  useNormalizedColorScheme as jest.MockedFunction<
    typeof useNormalizedColorScheme
  >

const stats = {
  totalWords: 24,
  masteredWords: 8,
  wordsForReview: 5,
  streakDays: 3,
}

describe.each(['light', 'dark'] as const)('%s StatsCard', theme => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue(theme)
  })

  it('opens review insights and matches the theme snapshot', () => {
    const onOpenInsights = jest.fn()
    const screen = render(
      <StatsCard stats={stats} onOpenInsights={onOpenInsights} />
    )

    fireEvent.press(screen.getByTestId('stats-card-open-insights'))

    expect(onOpenInsights).toHaveBeenCalledTimes(1)
    expect(screen.toJSON()).toMatchSnapshot()
  })
})
