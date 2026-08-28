import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { REVIEW_MODE } from '@/constants/ReviewConstants'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { DutchProductionCard } from '../DutchProductionCard'
import { MeaningRecallCard } from '../MeaningRecallCard'
import { RecognitionCard } from '../RecognitionCard'
import { ReviewAssessmentControls } from '../ReviewAssessmentControls'
import type { RecognitionOption } from '@/utils/reviewDistractors'
import { ReviewModeSelector } from '@/components/ReviewModeSelector'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

const mockUseNormalizedColorScheme =
  useNormalizedColorScheme as jest.MockedFunction<
    typeof useNormalizedColorScheme
  >

const word = createMockWord({
  word_id: 'word-house',
  dutch_lemma: 'huis',
  article: 'het',
  tts_url: null,
  translations: { en: ['house'] },
})

const options: RecognitionOption[] = [
  { id: 'word-house', label: 'house', isCorrect: true },
  { id: 'word-table', label: 'table', isCorrect: false },
  { id: 'word-chair', label: 'chair', isCorrect: false },
]

const noOp = jest.fn()
const SRS_GOOD_BUTTON = 'srs-good-button'

describe.each(['light', 'dark'] as const)('%s review mode snapshots', theme => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue(theme)
  })

  it('renders Recognition', () => {
    const tree = render(
      <RecognitionCard
        word={word}
        options={options}
        selectedOptionId={null}
        isPlayingAudio={false}
        onPlayPronunciation={noOp}
        onSelectOption={noOp}
      />
    ).toJSON()

    expect(tree).toMatchSnapshot()
  })

  it('renders Meaning Recall', () => {
    const tree = render(
      <MeaningRecallCard
        word={word}
        isPlayingAudio={false}
        onPlayPronunciation={noOp}
      />
    ).toJSON()

    expect(tree).toMatchSnapshot()
  })

  it('renders Dutch Production', () => {
    const tree = render(<DutchProductionCard prompt="house" />).toJSON()

    expect(tree).toMatchSnapshot()
  })
})

describe('RecognitionCard', () => {
  beforeEach(() => {
    mockUseNormalizedColorScheme.mockReturnValue('light')
  })

  it('reports a selected option without advancing the session', () => {
    const onSelectOption = jest.fn()
    const onAssessment = jest.fn()
    const { getByTestId } = render(
      <RecognitionCard
        word={word}
        options={options}
        selectedOptionId={null}
        isPlayingAudio={false}
        onPlayPronunciation={noOp}
        onSelectOption={onSelectOption}
      />
    )

    fireEvent.press(getByTestId('recognition-option-0'))

    expect(onSelectOption).toHaveBeenCalledWith(options[0])
    expect(onAssessment).not.toHaveBeenCalled()
  })

  it('exposes the selected option to assistive technology', () => {
    const { getByTestId } = render(
      <RecognitionCard
        word={word}
        options={options}
        selectedOptionId="word-table"
        isPlayingAudio={false}
        onPlayPronunciation={noOp}
        onSelectOption={noOp}
      />
    )

    expect(
      getByTestId('recognition-option-1').props.accessibilityState
    ).toEqual({ selected: true })
  })
})

describe('ReviewModeSelector', () => {
  it('selects a mode and starts with the persisted selection', () => {
    const onSelectMode = jest.fn()
    const onStart = jest.fn()
    const { getByTestId } = render(
      <ReviewModeSelector
        selectedMode={REVIEW_MODE.RECOGNITION}
        onSelectMode={onSelectMode}
        onStart={onStart}
      />
    )

    fireEvent.press(getByTestId('review-mode-dutch-production'))
    expect(onSelectMode).toHaveBeenCalledWith(REVIEW_MODE.DUTCH_PRODUCTION)

    fireEvent.press(getByTestId('start-review-button'))
    expect(onStart).toHaveBeenCalledWith(REVIEW_MODE.RECOGNITION)
  })
})

describe('ReviewAssessmentControls', () => {
  const handlers = {
    onReveal: jest.fn(),
    onAgain: jest.fn(),
    onHard: jest.fn(),
    onGood: jest.fn(),
    onEasy: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows only Again continuation after a wrong recognition answer', () => {
    const { getByTestId, queryByTestId } = render(
      <ReviewAssessmentControls
        isRevealed
        effectiveMode={REVIEW_MODE.RECOGNITION}
        recognitionResult={false}
        disabled={false}
        {...handlers}
      />
    )

    expect(queryByTestId('srs-hard-button')).toBeNull()
    expect(queryByTestId(SRS_GOOD_BUTTON)).toBeNull()
    expect(queryByTestId('srs-easy-button')).toBeNull()

    fireEvent.press(getByTestId('recognition-continue-button'))
    expect(handlers.onAgain).toHaveBeenCalledTimes(1)
  })

  it('requires an explicit SRS rating after a correct recognition answer', () => {
    const { getByTestId, queryByTestId } = render(
      <ReviewAssessmentControls
        isRevealed
        effectiveMode={REVIEW_MODE.RECOGNITION}
        recognitionResult
        disabled={false}
        {...handlers}
      />
    )

    expect(queryByTestId('srs-again-button')).toBeNull()
    expect(handlers.onGood).not.toHaveBeenCalled()

    fireEvent.press(getByTestId(SRS_GOOD_BUTTON))
    expect(handlers.onGood).toHaveBeenCalledTimes(1)
  })

  it('hides all SRS ratings until a recall answer is revealed', () => {
    const { getByTestId, queryByTestId } = render(
      <ReviewAssessmentControls
        isRevealed={false}
        effectiveMode={REVIEW_MODE.MEANING_RECALL}
        recognitionResult={null}
        disabled={false}
        {...handlers}
      />
    )

    expect(queryByTestId(SRS_GOOD_BUTTON)).toBeNull()
    fireEvent.press(getByTestId('reveal-answer-button'))
    expect(handlers.onReveal).toHaveBeenCalledTimes(1)
  })
})
