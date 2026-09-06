import { act, fireEvent, render, screen } from '@testing-library/react'
import { ReviewWorkspace } from './ReviewWorkspace'
import { ReviewDetails } from './ReviewDetails'
import { makeData, makeWord, successfulResult } from './__fixtures__/session'
import { submitReviewAssessment } from './actions'
import { loadReviewWordDetails } from './details-action'
import { submitReviewCorrection } from './correction-actions'
import { loadReviewCorrectionState } from './correction-refresh'
import { useWebSettings } from '@/features/settings/useWebSettings'
import { DEFAULT_WEB_SETTINGS } from '@/features/settings/settings-storage'
import type { WordDetail } from '@/features/words/word-detail'
import type { ReviewSubmissionResult } from './types'

jest.mock('./actions', () => ({ submitReviewAssessment: jest.fn() }))
jest.mock('./correction-actions', () => ({ submitReviewCorrection: jest.fn() }))
jest.mock('./correction-refresh', () => ({
  loadReviewCorrectionState: jest.fn(),
}))
jest.mock('./details-action', () => ({ loadReviewWordDetails: jest.fn() }))
jest.mock('@/features/settings/useWebSettings', () => ({
  useWebSettings: jest.fn(),
}))

const persist = jest.mocked(submitReviewAssessment)
const details = jest.mocked(loadReviewWordDetails)
const update = jest.fn()
const renderWorkspace = (data = makeData(), userId = 'test-user') =>
  render(
    <ReviewWorkspace
      data={data}
      userId={userId}
      initialScope="all-due"
      initialCollectionId={null}
    />
  )
const start = () =>
  fireEvent.click(screen.getByRole('button', { name: /Start ·/ }))
const flush = async () => {
  await act(async () => {})
}
const tick = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-06T12:00:00Z'))
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
  persist
    .mockReset()
    .mockImplementation(async input => successfulResult(input.wordId))
  details
    .mockReset()
    .mockResolvedValue({ status: 'error', message: 'Details unavailable' })
  jest.mocked(submitReviewCorrection).mockReset()
  jest.mocked(loadReviewCorrectionState).mockReset()
  jest.mocked(useWebSettings).mockReturnValue({
    isHydrated: true,
    settings: DEFAULT_WEB_SETTINGS,
    update,
  })
})
afterEach(() => {
  jest.useRealTimers()
})

async function openCorrectionHistory() {
  renderWorkspace({ ...makeData(), correctionsAvailable: true })
  start()
  fireEvent.click(screen.getByRole('button', { name: /house/ }))
  await flush()
  tick(600)
  fireEvent.click(screen.getByRole('button', { name: 'Previous word' }))
}

test('changing a history rating updates its label without submitting another review', async () => {
  jest.mocked(submitReviewCorrection).mockImplementation(async input => ({
    status: 'success',
    correctionId: input.correctionId,
    eventId: input.eventId,
    acceptedRevision: 1,
    effectiveRevision: 1,
    assessment: input.assessment,
    update: {
      ...successfulResult(input.wordId).update,
      repetitionCount: 0,
      intervalDays: 0,
    },
  }))
  await openCorrectionHistory()
  fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
  await flush()
  fireEvent.click(screen.getByRole('button', { name: 'Change to Again' }))
  await flush()
  expect(screen.getByText(/Previously reviewed/)).toHaveTextContent('again')
  expect(screen.getByRole('button', { name: 'Change to Again' })).toBeDisabled()
  expect(
    screen.getByText('Assessment corrected. No extra review was added.')
  ).toBeInTheDocument()
  expect(persist).toHaveBeenCalledTimes(1)
  expect(details).toHaveBeenCalledTimes(2)
  fireEvent.click(
    screen.getByRole('button', { name: 'Return to current question' })
  )
  expect(screen.queryByText(/Assessment corrected/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Previous word' }))
  expect(screen.getByText(/Assessment corrected/)).toBeInTheDocument()
})

test('uncertain corrections expose only same-edit retry and block new answers', async () => {
  jest.mocked(submitReviewCorrection).mockRejectedValue(new Error('Offline'))
  await openCorrectionHistory()
  fireEvent.click(screen.getByRole('button', { name: 'Change to Hard' }))
  await flush()
  const original = jest.mocked(submitReviewCorrection).mock.calls[0][0]
  expect(
    screen.queryByRole('button', { name: 'Keep server version' })
  ).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Return to current question' })
  )
  expect(screen.getByRole('button', { name: /\btree\b/ })).toBeDisabled()
  fireEvent.keyDown(document.body, { key: '2' })
  expect(persist).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Retry same correction' }))
  await flush()
  expect(jest.mocked(submitReviewCorrection).mock.calls[1][0]).toBe(original)
})

test('late reconciliation notices belong only to the corrected history event', async () => {
  jest.mocked(submitReviewCorrection).mockResolvedValue({
    status: 'conflict',
    message: 'Changed on another device',
  })
  jest.mocked(loadReviewCorrectionState).mockImplementation(async input => ({
    status: 'success',
    ...input,
    correctionsAvailable: true,
    progress: successfulResult(input.wordId).update,
    event: { assessment: 'easy', revision: 2 },
  }))
  await openCorrectionHistory()
  fireEvent.click(screen.getByRole('button', { name: 'Change to Again' }))
  await flush()
  fireEvent.click(
    screen.getByRole('button', { name: 'Return to current question' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Keep server version' }))
  await flush()
  const notice = /Your requested again edit was not confirmed/
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /\btree\b/ }))
  await flush()
  fireEvent.click(screen.getByRole('button', { name: /^Good ·/ }))
  await flush()
  fireEvent.click(screen.getByRole('button', { name: 'Previous word' }))
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Previous word' }))
  expect(screen.getByText(notice)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
  await flush()
  expect(screen.getByText(notice)).toBeInTheDocument()
  expect(persist).toHaveBeenCalledTimes(2)
})

test('conflict requires Keep server version and refreshes the effective rating', async () => {
  jest.mocked(submitReviewCorrection).mockResolvedValue({
    status: 'conflict',
    message: 'Changed on another device',
  })
  jest.mocked(loadReviewCorrectionState).mockImplementation(async input => ({
    status: 'success',
    userId: input.userId,
    wordId: input.wordId,
    eventId: input.eventId,
    correctionsAvailable: true,
    progress: successfulResult(input.wordId).update,
    event: { assessment: 'easy', revision: 2 },
  }))
  await openCorrectionHistory()
  fireEvent.click(screen.getByRole('button', { name: 'Change to Again' }))
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Changed on another device'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Keep server version' }))
  await flush()
  expect(screen.getByText(/Previously reviewed/)).toHaveTextContent('easy')
  expect(
    screen.queryByRole('button', { name: 'Change to Good' })
  ).not.toBeInTheDocument()
  expect(
    screen.getByText(/Your requested again edit was not confirmed/)
  ).toBeInTheDocument()
  expect(persist).toHaveBeenCalledTimes(1)
})

test.each(['light', 'dark'])(
  'fast review and read-only history render in %s theme',
  async theme => {
    document.documentElement.dataset.theme = theme
    renderWorkspace()
    start()
    expect(screen.getByRole('button', { name: 'Exit review' })).toHaveAttribute(
      'aria-label',
      'Exit review'
    )
    expect(screen.getByRole('button', { name: 'Full details' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /house/ }))
    await flush()
    expect(screen.getByText('Correct · Saved')).toBeInTheDocument()
    tick(600)
    expect(
      screen.getByRole('heading', { name: 'woord-word-2' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Review content')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Previous word' }))
    expect(screen.getByText(/Previously reviewed/)).toHaveTextContent('good')
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to current question' })
    )
    expect(
      screen.getByRole('heading', { name: 'woord-word-2' })
    ).toBeInTheDocument()
    expect(persist).toHaveBeenCalledTimes(1)
  }
)

test('wrong answer loads full details and Continue records only Again', async () => {
  renderWorkspace()
  start()
  fireEvent.click(screen.getByRole('button', { name: /\btree\b/ }))
  await flush()
  expect(details).toHaveBeenCalledWith({
    userId: 'test-user',
    wordId: 'word-1',
  })
  expect(screen.getByRole('alert')).toHaveTextContent('Details unavailable')
  expect(persist).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: /^Good/ })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue · Again' }))
  await flush()
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({ assessment: 'again', answeredCorrectly: false })
  )
  expect(
    screen.getByRole('heading', { name: 'woord-word-2' })
  ).toBeInTheDocument()
})

test('D opens details before answering and Skip does not submit', async () => {
  renderWorkspace()
  start()
  fireEvent.keyDown(document.body, { key: 'd' })
  await flush()
  expect(screen.getByText(/Answer viewed/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Skip without review' }))
  expect(persist).not.toHaveBeenCalled()
  expect(
    screen.getByRole('heading', { name: 'woord-word-2' })
  ).toBeInTheDocument()
})

test('manual-rating switch persists and keyboard ratings work after correct choice', async () => {
  renderWorkspace()
  fireEvent.click(
    screen.getByRole('checkbox', { name: /Rate correct recognition/ })
  )
  expect(update).toHaveBeenCalledWith({ manualRecognition: true })
  start()
  fireEvent.click(screen.getByRole('button', { name: /house/ }))
  tick(1000)
  expect(persist).not.toHaveBeenCalled()
  fireEvent.keyDown(document.body, { key: '2' })
  await flush()
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({ assessment: 'hard' })
  )
})

test('history is still accessible after the final word', async () => {
  renderWorkspace(makeData([makeWord('word-1', 'house')]))
  start()
  fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Good/ }))
  await flush()
  expect(
    screen.getByRole('heading', { name: 'Session complete' })
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Previous word' }))
  expect(screen.getByRole('button', { name: 'Full details' })).toBeEnabled()
  expect(
    screen.queryByRole('button', { name: /^Good/ })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Return to summary' }))
  expect(
    screen.getByRole('heading', { name: 'Session complete' })
  ).toBeInTheDocument()
  expect(persist).toHaveBeenCalledTimes(1)
})

test('a new account remounts the session and late saves cannot restore old data', async () => {
  let resolve!: (value: ReviewSubmissionResult) => void
  persist.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const data = makeData()
  const view = renderWorkspace(data)
  start()
  fireEvent.click(screen.getByRole('button', { name: /house/ }))
  view.rerender(
    <ReviewWorkspace
      data={makeData([makeWord('other', 'other')])}
      userId="other-user"
      initialScope="all-due"
      initialCollectionId={null}
    />
  )
  await act(async () => resolve(successfulResult('word-1')))
  start()
  expect(
    screen.getByRole('heading', { name: 'woord-other' })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('option', { name: /woord-word-1/ })
  ).not.toBeInTheDocument()
})

test('detail failures are retryable without changing learning progress', async () => {
  details.mockRejectedValueOnce(new Error('Offline'))
  render(<ReviewDetails userId="test-user" wordId="word-1" />)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not load the full card'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Retry full details' }))
  await flush()
  expect(details).toHaveBeenCalledTimes(2)
  expect(persist).not.toHaveBeenCalled()
})

test('old full-card requests cannot replace a newly selected word', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof loadReviewWordDetails>>
  ) => void
  details.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const view = render(
    <ReviewDetails key="one" userId="test-user" wordId="word-1" />
  )
  view.rerender(<ReviewDetails key="two" userId="test-user" wordId="word-2" />)
  await flush()
  await act(async () =>
    resolve({ status: 'error', message: 'Stale first request' })
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Details unavailable')
  expect(screen.queryByText('Stale first request')).not.toBeInTheDocument()
})

test('full details render the actual complete card without leaving the session', async () => {
  const word: WordDetail = {
    ...makeWord('word-1', 'house'),
    translations: { en: ['house'], ru: ['дом'] },
    analysisNotes: null,
    antonyms: [],
    conjugation: null,
    createdAt: '2026-09-06',
    examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.', ru: null }],
    expressionType: null,
    isExpression: false,
    isIrregular: false,
    isReflexive: false,
    isSeparable: false,
    plural: 'huizen',
    prefixPart: null,
    preposition: null,
    register: null,
    rootVerb: null,
    synonyms: [],
    updatedAt: null,
    usageNotes: null,
  }
  details.mockResolvedValue({ status: 'success', word })
  renderWorkspace()
  start()
  fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
  await flush()
  expect(screen.getByText('huizen')).toBeInTheDocument()
  expect(screen.getByText('Dit is mijn huis.')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Back to question' })
  ).toBeInTheDocument()
  expect(persist).not.toHaveBeenCalled()
})
