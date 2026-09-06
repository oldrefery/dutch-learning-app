import { act, fireEvent, render, screen } from '@testing-library/react'
import { ReviewWorkspace } from './ReviewWorkspace'
import { ReviewDetails } from './ReviewDetails'
import { makeData, makeWord, successfulResult } from './__fixtures__/session'
import { submitReviewAssessment } from './actions'
import { loadReviewWordDetails } from './details-action'
import { useWebSettings } from '@/features/settings/useWebSettings'
import { DEFAULT_WEB_SETTINGS } from '@/features/settings/settings-storage'
import type { WordDetail } from '@/features/words/word-detail'
import type { ReviewSubmissionResult } from './types'

jest.mock('./actions', () => ({ submitReviewAssessment: jest.fn() }))
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
  jest.mocked(useWebSettings).mockReturnValue({
    isHydrated: true,
    settings: DEFAULT_WEB_SETTINGS,
    update,
  })
})
afterEach(() => {
  jest.useRealTimers()
})

test.each(['light', 'dark'])(
  'fast review and read-only history render in %s theme',
  async theme => {
    document.documentElement.dataset.theme = theme
    renderWorkspace()
    start()
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
