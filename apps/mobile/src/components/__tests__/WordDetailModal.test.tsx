import React from 'react'
import { act, render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import WordDetailModal from '../WordDetailModal'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { createMockWord } from '@/__tests__/helpers/factories'
import type { Word } from '@/types/database'

type NativeModule = typeof import('react-native')

function mockNativeModule(): NativeModule {
  return jest.requireActual<NativeModule>('react-native')
}

jest.mock('@/lib/supabaseClient')
const mockSafeAreaInsets = jest.fn(() => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets(),
}))
jest.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({ playWord: jest.fn(), isPlaying: false }),
}))
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }))
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Native: jest.fn(),
    Pan: () => ({
      onUpdate: () => ({
        onEnd: () => ({ simultaneousWithExternalGesture: jest.fn() }),
      }),
    }),
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('react-native-reanimated', () => {
  const native = mockNativeModule()
  return {
    __esModule: true,
    default: { View: native.View, ScrollView: native.ScrollView },
    useSharedValue: () => ({ get: jest.fn(), set: jest.fn() }),
    useAnimatedStyle: jest.fn(),
    useAnimatedScrollHandler: jest.fn(),
    withSpring: jest.fn(),
    withTiming: jest.fn(),
    interpolate: jest.fn(),
    Extrapolation: { CLAMP: 'clamp' },
  }
})
jest.mock('@/components/UniversalWordCard', () => {
  const { Text } = mockNativeModule()
  return {
    UniversalWordCard: ({ word }: { word: Word }) => (
      <Text>{word.translations.en[0]}</Text>
    ),
    WordCardPresets: { modal: { config: {}, actions: {} } },
  }
})
jest.mock('../WordDetailModal/components', () => ({
  WordDetailHeader: () => null,
}))

const LOCAL_VERSION = 'local version'
const selectedWord = createMockWord({ translations: { en: [LOCAL_VERSION] } })
const renderDetails = async () =>
  render(<WordDetailModal visible onClose={jest.fn()} word={selectedWord} />)

beforeEach(() => {
  useApplicationStore.setState({
    currentUserId: selectedWord.user_id,
    words: [selectedWord],
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  mockSafeAreaInsets.mockClear()
})

it.each([
  ['android', 48, 48],
  ['android', 0, 0],
  ['ios', 34, 0],
] as const)(
  'positions the sheet for %s with a bottom inset of %s',
  async (platform, bottom, expected) => {
    jest.replaceProperty(Platform, 'OS', platform)
    mockSafeAreaInsets.mockReturnValueOnce({
      top: 0,
      right: 0,
      bottom,
      left: 0,
    })

    expect(
      (await renderDetails()).getByTestId('word-detail-sheet')
    ).toHaveStyle({
      bottom: expected,
    })
  }
)

it('refreshes open details after choosing server content without changing the selected snapshot', async () => {
  const screen = await renderDetails()
  expect(screen.getByText(LOCAL_VERSION)).toBeTruthy()
  await act(() => {
    useApplicationStore.setState({
      words: [{ ...selectedWord, translations: { en: ['server version'] } }],
    })
  })
  expect(screen.getByText('server version')).toBeTruthy()
  expect(screen.queryByText(LOCAL_VERSION)).toBeNull()
})

it.each(['account change', 'deletion'])(
  'hides stale details after %s',
  async cause => {
    const screen = await renderDetails()
    await act(() => {
      useApplicationStore.setState(
        cause === 'deletion' ? { words: [] } : { currentUserId: 'other-owner' }
      )
    })
    expect(screen.queryByText(LOCAL_VERSION)).toBeNull()
  }
)
