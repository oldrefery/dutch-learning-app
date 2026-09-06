import React, { useEffect } from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { NativeReviewSession } from '../NativeReviewSession'
import { createNativeReviewPersistence } from '@/features/review/persistence'
import {
  makeSession,
  userId,
  vocabulary,
} from '@/features/review/__tests__/fixtures'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

jest.mock('@/features/review/persistence', () => ({
  createNativeReviewPersistence: jest.fn(),
}))
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }))
jest.mock('react-native-gesture-handler', () => ({
  Pressable: jest.requireActual('react-native').Pressable,
}))
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({ playAudio: jest.fn(), isPlaying: false }),
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

// Exercise the real controller/timer with the native route focus boundary simulated.
Object.assign(jest.requireMock('expo-router'), {
  useFocusEffect: (effect: () => void | (() => void)) =>
    useEffect(effect, [effect]),
})
const persist = jest.fn()
const SECOND_WORD = 'Word 2 / 3'
const EXAMPLE_TRANSLATION = /The house is big\./
const GOOD_BUTTON = 'srs-good-button'
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-06T12:00:00Z'))
  AppState.currentState = 'active'
  persist.mockReset().mockResolvedValue(undefined)
  jest.mocked(createNativeReviewPersistence).mockReturnValue(persist)
  useSettingsStore.setState({ manualRecognitionByUser: {} })
  useApplicationStore.setState({ currentUserId: userId, words: vocabulary })
})
afterEach(() => jest.useRealTimers())

describe.each(['light', 'dark'] as const)(
  'native review in %s theme',
  theme => {
    beforeEach(() =>
      jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    )
    it('advances correct answers, opens history/details, and restores the exact pending question', async () => {
      const session = makeSession()
      const screen = render(
        <NativeReviewSession session={session} userId={userId} />
      )
      fireEvent.press(screen.getByLabelText('house'))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(600)
      })
      expect(screen.getByText(SECOND_WORD)).toBeTruthy()
      fireEvent.press(screen.getByLabelText('Previous word'))
      expect(screen.getByText('History 1 / 1')).toBeTruthy()
      fireEvent.press(screen.getByLabelText('Full details'))
      expect(screen.getByText(EXAMPLE_TRANSLATION)).toBeTruthy()
      expect(screen.queryByTestId(GOOD_BUTTON)).toBeNull()
      fireEvent.press(screen.getByLabelText('Return to current question'))
      expect(screen.getByText(SECOND_WORD)).toBeTruthy()
      expect(screen.getByLabelText('chair')).toBeTruthy()
      expect(persist).toHaveBeenCalledTimes(1)
      expect(screen.toJSON()).toMatchSnapshot()
    })
  }
)

it('reveals the entire card after an incorrect answer and requires Continue', async () => {
  const screen = render(
    <NativeReviewSession session={makeSession()} userId={userId} />
  )
  fireEvent.press(screen.getByLabelText('chair'))
  expect(screen.getByText(EXAMPLE_TRANSLATION)).toBeTruthy()
  expect(persist).not.toHaveBeenCalled()
  fireEvent.press(screen.getByLabelText('Continue'))
  await act(async () => {})
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({ assessment: 'again' })
  )
  expect(screen.getByText(SECOND_WORD)).toBeTruthy()
})

it('offers only Again or Skip after an early full-card peek', async () => {
  const screen = render(
    <NativeReviewSession session={makeSession()} userId={userId} />
  )
  fireEvent.press(screen.getByLabelText('Full details'))
  expect(screen.queryByTestId(GOOD_BUTTON)).toBeNull()
  expect(screen.getByTestId('srs-again-button')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Skip without rating'))
  expect(screen.getByText('0 reviewed · 1 skipped')).toBeTruthy()
  expect(persist).not.toHaveBeenCalled()
})

it('shows manual ratings when opted in and retains history after completion', async () => {
  useSettingsStore.setState({ manualRecognitionByUser: { [userId]: true } })
  const session = { ...makeSession(), words: vocabulary.slice(0, 1) }
  const screen = render(
    <NativeReviewSession session={session} userId={userId} />
  )
  fireEvent.press(screen.getByLabelText('house'))
  expect(persist).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId('srs-easy-button'))
  await act(async () => {})
  expect(screen.getByText('Session Complete!')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Previous word'))
  expect(screen.getByText('Recorded: easy')).toBeTruthy()
  expect(persist).toHaveBeenCalledTimes(1)
})

it('keeps a session across a route remount without recording another answer', async () => {
  const session = makeSession()
  const first = render(
    <NativeReviewSession session={session} userId={userId} />
  )
  fireEvent.press(first.getByLabelText('house'))
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600)
  })
  first.unmount()
  const second = render(
    <NativeReviewSession session={session} userId={userId} />
  )
  expect(second.getByText(SECOND_WORD)).toBeTruthy()
  expect(persist).toHaveBeenCalledTimes(1)
})

it('reveals recall by tapping the card without treating it as an assisted peek', async () => {
  const screen = render(
    <NativeReviewSession
      session={makeSession('meaning-recall')}
      userId={userId}
    />
  )
  fireEvent.press(screen.getByLabelText('Reveal meaning'))
  expect(screen.getByText(EXAMPLE_TRANSLATION)).toBeTruthy()
  fireEvent.press(screen.getByTestId(GOOD_BUTTON))
  await act(async () => {})
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({
      assessment: 'good',
      reviewMode: 'meaning-recall',
      answeredCorrectly: null,
    })
  )
})
