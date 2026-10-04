import React from 'react'
import { act, render } from '@testing-library/react-native'
import WordDetailModal from '../WordDetailModal'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { createMockWord } from '@/__tests__/helpers/factories'
import type { Word } from '@/types/database'

type NativeModule = typeof import('react-native')

function mockNativeModule(): NativeModule {
  return jest.requireActual<NativeModule>('react-native')
}

jest.mock('@/lib/supabaseClient')
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
const renderDetails = () =>
  render(<WordDetailModal visible onClose={jest.fn()} word={selectedWord} />)

beforeEach(() => {
  useApplicationStore.setState({
    currentUserId: selectedWord.user_id,
    words: [selectedWord],
  })
})

it('refreshes open details after choosing server content without changing the selected snapshot', () => {
  const screen = renderDetails()
  expect(screen.getByText(LOCAL_VERSION)).toBeTruthy()
  act(() => {
    useApplicationStore.setState({
      words: [{ ...selectedWord, translations: { en: ['server version'] } }],
    })
  })
  expect(screen.getByText('server version')).toBeTruthy()
  expect(screen.queryByText(LOCAL_VERSION)).toBeNull()
})

it.each(['account change', 'deletion'])(
  'hides stale details after %s',
  cause => {
    const screen = renderDetails()
    act(() => {
      useApplicationStore.setState(
        cause === 'deletion' ? { words: [] } : { currentUserId: 'other-owner' }
      )
    })
    expect(screen.queryByText(LOCAL_VERSION)).toBeNull()
  }
)
