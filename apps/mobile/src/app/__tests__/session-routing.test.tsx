import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Text as MockText, View as MockView } from 'react-native'
import Index from '../index'
import TabLayout from '../(tabs)/_layout'
import { useReviewWordsCount } from '@/hooks/useReviewWordsCount'
import { useSessionGate } from '@/hooks/useSessionGate'
import { useApplicationStore } from '@/stores/useApplicationStore'

jest.mock('@/hooks/useSessionGate')
jest.mock('@/hooks/useSyncManager', () => ({ useSyncManager: jest.fn() }))
jest.mock('@/hooks/useReviewWordsCount', () => ({
  useReviewWordsCount: jest.fn(),
}))
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  Redirect: ({ href }: { href: string }) => <MockText>{href}</MockText>,
}))
jest.mock('expo-router/native-tabs', () => {
  const Container = ({
    children,
    hidden,
  }: {
    children: React.ReactNode
    hidden?: boolean
  }) => (hidden ? null : <MockView>{children}</MockView>)
  const Icon = () => null
  const Trigger = Object.assign(Container, {
    Label: MockText,
    Icon,
    Badge: MockText,
  })
  return {
    NativeTabs: Object.assign(
      ({ children }: { children: React.ReactNode }) => (
        <MockView testID="native-tabs">{children}</MockView>
      ),
      { Trigger }
    ),
  }
})

describe('startup and tab session routing', () => {
  const originalStore = useApplicationStore.getState()
  const initializeApp = jest.fn<Promise<void>, [string?]>()
  const retry = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useReviewWordsCount).mockReturnValue({
      reviewWordsCount: 0,
      isLoading: false,
      refreshCount: jest.fn(),
    })
    initializeApp.mockImplementation(userId => {
      useApplicationStore.setState({ currentUserId: userId ?? null })
      return new Promise(() => {}) // Access/network initialization never resolves.
    })
    useApplicationStore.setState({
      currentUserId: null,
      userAccessLevel: null,
      initializeApp,
    })
    jest
      .mocked(useSessionGate)
      .mockReturnValue({ status: 'signed-in', userId: 'qa-router', retry })
  })
  afterEach(() => useApplicationStore.setState(originalStore))

  it('opens the app without waiting for network initialization', async () => {
    const screen = await render(<Index />)
    expect(screen.getByText('/(tabs)')).toBeTruthy()
    expect(initializeApp).toHaveBeenCalledWith('qa-router')
  })

  it('renders read-only tabs while access remains unknown', async () => {
    const screen = await render(<TabLayout />)
    expect(screen.getByTestId('native-tabs')).toBeTruthy()
    expect(screen.queryByText('Add Word')).toBeNull()
  })

  it('shows Add Word for full access and caps the review badge', async () => {
    useApplicationStore.setState({ userAccessLevel: 'full_access' })
    jest.mocked(useReviewWordsCount).mockReturnValue({
      reviewWordsCount: 120,
      isLoading: false,
      refreshCount: jest.fn(),
    })
    const screen = await render(<TabLayout />)
    expect(screen.getByText('Add Word')).toBeTruthy()
    expect(screen.getByText('99+')).toBeTruthy()
  })

  it.each([Index, TabLayout])(
    'shows a retry screen, not a login redirect, when auth is unavailable',
    async Screen => {
      jest
        .mocked(useSessionGate)
        .mockReturnValue({ status: 'unavailable', userId: null, retry })
      const screen = await render(<Screen />)
      expect(screen.getByTestId('session-unavailable')).toBeTruthy()
      await fireEvent.press(screen.getByTestId('retry-session-button'))
      expect(retry).toHaveBeenCalledTimes(1)
      expect(initializeApp).not.toHaveBeenCalled()
      expect(screen.queryByTestId('native-tabs')).toBeNull()
      expect(screen.queryByText('/(auth)/login')).toBeNull()
    }
  )

  it.each([Index, TabLayout])(
    'redirects a confirmed missing session to login',
    async Screen => {
      jest
        .mocked(useSessionGate)
        .mockReturnValue({ status: 'signed-out', userId: null, retry })
      expect((await render(<Screen />)).getByText('/(auth)/login')).toBeTruthy()
    }
  )
})
