import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { REVIEW_MODE } from '@/constants/ReviewConstants'
import { ReviewSessionCard } from '../ReviewSessionCard'

type ReactNativeModule = typeof import('react-native')
const mockReactNativeModuleName = 'react-native'

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Exclusive: jest.fn(() => ({})),
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('@/components/GestureErrorBoundary', () => ({
  GestureErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}))

jest.mock('@/components/glass/GlassHeader', () => ({
  GlassHeader: ({
    title,
    leftSlot,
    rightSlot,
  }: {
    title?: string
    leftSlot?: React.ReactNode
    rightSlot?: React.ReactNode
  }) => {
    const mockReact = jest.requireActual<typeof import('react')>('react')
    const { Text: MockText, View: MockView } =
      jest.requireActual<ReactNativeModule>(mockReactNativeModuleName)
    return mockReact.createElement(
      MockView,
      null,
      leftSlot,
      mockReact.createElement(MockText, null, title),
      rightSlot
    )
  },
}))

jest.mock('@/components/UniversalWordCard', () => ({
  WordCardPresets: {
    review: { config: {}, actions: { showDeleteButton: true } },
  },
  UniversalWordCard: ({
    actions,
    onPlayPronunciation,
    onChangeImage,
  }: {
    actions: { onDelete?: () => void; onReanalyze?: () => void }
    onPlayPronunciation?: (url: string) => void
    onChangeImage?: () => void
  }) => {
    const mockReact = jest.requireActual<typeof import('react')>('react')
    const { Pressable: MockPressable, View: MockView } =
      jest.requireActual<ReactNativeModule>(mockReactNativeModuleName)
    return mockReact.createElement(
      MockView,
      null,
      mockReact.createElement(MockPressable, {
        testID: 'mock-audio',
        onPress: () => onPlayPronunciation?.('audio'),
      }),
      mockReact.createElement(MockPressable, {
        testID: 'mock-image',
        onPress: onChangeImage,
      }),
      mockReact.createElement(MockPressable, {
        testID: 'mock-delete',
        onPress: actions.onDelete,
      }),
      mockReact.createElement(MockPressable, {
        testID: 'mock-reanalyze',
        onPress: actions.onReanalyze,
      })
    )
  },
}))

describe('ReviewSessionCard revealed actions', () => {
  it('keeps detail, audio, image, delete, and re-analysis actions available', () => {
    const callbacks = {
      onPlayAudio: jest.fn(),
      onOpenDetails: jest.fn(),
      onDelete: jest.fn(),
      onReanalyze: jest.fn(),
      onChangeImage: jest.fn(),
    }
    const { getByTestId } = render(
      <ReviewSessionCard
        word={createMockWord({ word_id: 'revealed-word' })}
        configuredMode={REVIEW_MODE.MEANING_RECALL}
        effectiveMode={REVIEW_MODE.MEANING_RECALL}
        preferredTranslation="house"
        recognitionOptions={null}
        selectedRecognitionOption={null}
        isFlipped
        isPlayingAudio={false}
        isReanalyzing={false}
        tapGesture={{} as never}
        panGesture={{} as never}
        lockedGesture={{} as never}
        tapGestureRef={{ current: undefined }}
        pronunciationRef={{ current: null }}
        onSelectRecognitionOption={jest.fn()}
        onFlip={jest.fn()}
        {...callbacks}
      />
    )

    fireEvent.press(getByTestId('review-details-button'))
    fireEvent.press(getByTestId('mock-audio'))
    fireEvent.press(getByTestId('mock-image'))
    fireEvent.press(getByTestId('mock-delete'))
    fireEvent.press(getByTestId('mock-reanalyze'))

    expect(callbacks.onOpenDetails).toHaveBeenCalledTimes(1)
    expect(callbacks.onPlayAudio).toHaveBeenCalledWith('audio')
    expect(callbacks.onChangeImage).toHaveBeenCalledTimes(1)
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1)
    expect(callbacks.onReanalyze).toHaveBeenCalledTimes(1)
  })
})
