import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { LearningGuideContent } from '../LearningGuideContent'
import {
  LEARNING_GUIDE_SECTIONS,
  LEARNING_GUIDE_VERSION,
  shouldShowLearningGuideIntroduction,
} from '../content'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

const mockUseNormalizedColorScheme =
  useNormalizedColorScheme as jest.MockedFunction<
    typeof useNormalizedColorScheme
  >

describe.each(['light', 'dark'] as const)('%s LearningGuideContent', theme => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue(theme)
  })

  it('renders every section in accessible reading order inside a scroll view', () => {
    const { getByTestId, getByLabelText } = render(
      <LearningGuideContent onComplete={jest.fn()} onNavigate={jest.fn()} />
    )

    expect(getByTestId('learning-guide-scroll-view')).toBeTruthy()
    LEARNING_GUIDE_SECTIONS.forEach((section, index) => {
      expect(getByTestId(`learning-guide-section-${section.id}`)).toBeTruthy()
      expect(
        getByLabelText(
          `Section ${index + 1} of ${LEARNING_GUIDE_SECTIONS.length}: ${section.title}`
        ).props.accessibilityRole
      ).toBe('header')
    })
  })
})

describe('LearningGuideContent actions', () => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue('light')
  })

  it('only reports safe navigation intent when a section action is pressed', () => {
    const onNavigate = jest.fn()
    const onComplete = jest.fn()
    const { getByTestId } = render(
      <LearningGuideContent onComplete={onComplete} onNavigate={onNavigate} />
    )

    fireEvent.press(getByTestId('learning-guide-action-start-learning'))

    expect(onNavigate).toHaveBeenCalledWith('/(tabs)/add-word')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('requires an explicit completion action', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(
      <LearningGuideContent onComplete={onComplete} onNavigate={jest.fn()} />
    )

    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.press(getByTestId('complete-learning-guide-button'))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('allows system font scaling and keeps all content scrollable', () => {
    const { getByText, getByTestId } = render(
      <LearningGuideContent onComplete={jest.fn()} onNavigate={jest.fn()} />
    )

    expect(getByText('How Learning Works').props.allowFontScaling).not.toBe(
      false
    )
    expect(getByTestId('learning-guide-scroll-view')).toBeTruthy()
  })
})

describe('learning guide version policy', () => {
  it('shows each new guide version once without clearing other settings', () => {
    expect(shouldShowLearningGuideIntroduction(0)).toBe(true)
    expect(shouldShowLearningGuideIntroduction(LEARNING_GUIDE_VERSION)).toBe(
      false
    )
    expect(
      shouldShowLearningGuideIntroduction(
        LEARNING_GUIDE_VERSION,
        LEARNING_GUIDE_VERSION + 1
      )
    ).toBe(true)
  })
})
