import React from 'react'
import { Alert } from 'react-native'
import { act, render } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import SwipeableWordItem from './SwipeableWordItem'

let mockPanEnd: (event: { translationX: number }) => void = () => {}

jest.mock('react-native-gesture-handler', () => {
  const createGesture = (pan = false) => {
    const gesture = {
      maxDistance: () => gesture,
      maxDuration: () => gesture,
      minDuration: () => gesture,
      activeOffsetX: () => gesture,
      failOffsetY: () => gesture,
      maxPointers: () => gesture,
      onUpdate: () => gesture,
      onStart: () => gesture,
      onEnd: (handler: typeof mockPanEnd) => {
        if (pan) mockPanEnd = handler
        return gesture
      },
    }
    return gesture
  }
  return {
    Gesture: {
      Tap: () => createGesture(),
      LongPress: () => createGesture(),
      Pan: () => createGesture(true),
      Exclusive: jest.fn(),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  }
})

jest.mock('react-native-reanimated', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => {
      let value = initial
      return {
        get: () => value,
        set: (next: number) => {
          value = next
        },
      }
    },
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    withSpring: (value: number, _config?: unknown, complete?: () => void) => {
      complete?.()
      return value
    },
  }
})
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: <Args extends unknown[]>(
    callback: (...args: Args) => void,
    ...args: Args
  ) => callback(...args),
}))

it('opens each long-swipe dialog once and deletes only after confirmation', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const onDelete = jest.fn()
  const onMoveToCollection = jest.fn()
  const word = createMockWord()
  const props = {
    word,
    index: 0,
    onPress: jest.fn(),
    onDelete,
    onMoveToCollection,
    highlighted: false,
  }
  const { rerender } = render(<SwipeableWordItem {...props} />)
  act(() => mockPanEnd({ translationX: 170 }))
  expect(onMoveToCollection).toHaveBeenCalledTimes(1)
  expect(onMoveToCollection).toHaveBeenCalledWith(word.word_id)
  rerender(
    <SwipeableWordItem
      {...props}
      moveModalVisible
      wordBeingMoved={word.word_id}
    />
  )
  rerender(<SwipeableWordItem {...props} moveModalVisible={false} />)
  expect(onMoveToCollection).toHaveBeenCalledTimes(1)
  act(() => mockPanEnd({ translationX: -170 }))
  expect(alert).toHaveBeenCalledTimes(1)
  expect(onDelete).not.toHaveBeenCalled()
  act(() =>
    alert.mock.calls[0][2]
      ?.find(button => button.text === 'Delete')
      ?.onPress?.()
  )
  expect(onDelete).toHaveBeenCalledWith(word.word_id)
  alert.mockRestore()
})
