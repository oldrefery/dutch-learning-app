import React, { useEffect } from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { ReviewSessionLoader } from '../ReviewSessionLoader'
import { loadNativeReviewSession } from '@/features/review/session'
import { makeSession, userId } from '@/features/review/__tests__/fixtures'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'

jest.mock('@/features/review/session', () => ({
  loadNativeReviewSession: jest.fn(),
}))
jest.mock('../NativeReviewSession', () => ({ NativeReviewSession: () => null }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
Object.assign(jest.requireMock('expo-router'), {
  useFocusEffect: (effect: () => void | (() => void)) =>
    useEffect(effect, [effect]),
})
const load = jest.mocked(loadNativeReviewSession)
beforeEach(() => {
  load.mockReset()
  useSettingsStore.setState({ manualRecognitionByUser: {} })
})

it.each([undefined, false, true])(
  'passes a boolean manual preference when the saved value is %s',
  preference => {
    useSettingsStore.setState({
      manualRecognitionByUser:
        preference === undefined ? {} : { [userId]: preference },
    })
    load.mockReturnValue(new Promise(() => {}))
    render(<ReviewSessionLoader session={makeSession()} userId={userId} />)
    expect(load.mock.calls[0][2]).toBe(preference ?? false)
  }
)

it('renders progress and keeps cancellation available before preparation finishes', async () => {
  const session = makeSession()
  useApplicationStore.setState({
    currentUserId: userId,
    reviewSession: session,
  })
  load.mockReturnValue(new Promise(() => {}))
  const screen = render(
    <ReviewSessionLoader session={session} userId={userId} />
  )
  expect(screen.getByText('Preparing review: 0 / 3')).toBeTruthy()
  act(() => load.mock.calls[0][4](2))
  expect(screen.getByText('Preparing review: 2 / 3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Cancel preparation'))
  expect(useApplicationStore.getState().reviewSession).toBeNull()
  screen.unmount()
  expect(load.mock.calls[0][3].aborted).toBe(true)
})

it('shows a recoverable error and allows a fresh attempt', async () => {
  load
    .mockRejectedValueOnce(new Error('Invalid fixture'))
    .mockReturnValueOnce(new Promise(() => {}))
  const screen = render(
    <ReviewSessionLoader session={makeSession()} userId={userId} />
  )
  await act(async () => {})
  expect(screen.getByText(/Could not prepare review/)).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Retry preparation'))
  expect(load).toHaveBeenCalledTimes(2)
  expect(screen.getByText('Preparing review: 0 / 3')).toBeTruthy()
  expect(load.mock.calls[0][3].aborted).toBe(true)
})

it('does not cancel another user or a replacement session', () => {
  const session = makeSession()
  const replacement = makeSession()
  useApplicationStore.setState({
    currentUserId: userId,
    reviewSession: replacement,
  })
  load.mockReturnValue(new Promise(() => {}))
  const screen = render(
    <ReviewSessionLoader session={session} userId={userId} />
  )
  fireEvent.press(screen.getByLabelText('Cancel preparation'))
  expect(useApplicationStore.getState().reviewSession).toBe(replacement)
})
