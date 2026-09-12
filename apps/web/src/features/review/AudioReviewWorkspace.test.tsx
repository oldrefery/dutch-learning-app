import { render, screen } from '@testing-library/react'
import { AudioReviewWorkspace } from './AudioReviewWorkspace'
import { makeData } from './__fixtures__/session'
import { useReviewSession } from './useReviewSession'

jest.mock('./useReviewSession', () => ({ useReviewSession: jest.fn() }))
jest.mock('./useAudioReviewPlayback', () => ({
  useAudioReviewPlayback: () => ({
    isPaused: false,
    isPlaying: false,
    playbackMessage: null,
    play: jest.fn(),
    stop: jest.fn(),
    togglePause: jest.fn(),
  }),
}))

const session = {
  cancelPreparation: jest.fn(),
  dueCount: 1,
  dueWords: [],
  preparation: { status: 'idle' as const },
  stage: 'setup' as const,
  start: jest.fn(),
}

beforeEach(() => {
  jest
    .mocked(useReviewSession)
    .mockReset()
    .mockReturnValue(session as never)
})

test('uses the authenticated account and explicit Meaning recall mode', () => {
  render(<AudioReviewWorkspace data={makeData()} userId="account-a" />)

  expect(useReviewSession).toHaveBeenCalledWith(
    expect.anything(),
    'all-due',
    null,
    'account-a',
    'meaning-recall'
  )
  expect(
    screen.getByRole('button', { name: 'Start Audio Review' })
  ).toBeEnabled()
})
