import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import StarterPackScreen from '../starter-pack'

const mockApplicationState = { currentUserId: 'qa-user-a' }
const mockMutatePackStateTestId = 'mutate-pack-state'

jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(),
}))

jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: typeof mockApplicationState) => unknown
  ) => selector(mockApplicationState),
}))

jest.mock('@/hooks/useStarterPackImport', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react')

  return {
    useStarterPackImport: ({ packId }: { packId?: string }) => {
      const [state, setState] = ReactModule.useState(
        () =>
          `${packId ?? 'bundled'}:selection=fresh,target=fresh,success=empty`
      )
      return {
        error: state,
        handleGoBack: jest.fn(),
        loading: false,
        manifest: null,
        previewData: null,
        retryRemotePack: () =>
          setState(
            `${packId}:selection=changed,target=pack-a,success=complete`
          ),
      }
    },
  }
})

jest.mock('@/components/SharedCollectionErrorScreen', () => ({
  SharedCollectionErrorScreen: (() => {
    const ReactModule = jest.requireActual<typeof import('react')>('react')
    const {
      Pressable: NativePressable,
      Text: NativeText,
      View: NativeView,
    } = jest.requireActual<typeof import('react-native')>('react-native')

    return ({ error, onRetry }: { error: string; onRetry?: () => void }) =>
      ReactModule.createElement(
        NativeView,
        null,
        ReactModule.createElement(NativeText, null, error),
        ReactModule.createElement(
          NativePressable,
          { onPress: onRetry, testID: mockMutatePackStateTestId },
          ReactModule.createElement(NativeText, null, 'Mutate pack state')
        )
      )
  })(),
}))

const mockUseLocalSearchParams = jest.mocked(useLocalSearchParams)

it('remounts all pack-bound state when route identity changes rapidly', () => {
  mockUseLocalSearchParams.mockReturnValue({
    packId: 'dutch-a2-01',
    version: '1.0.0',
  })
  const screen = render(<StarterPackScreen />)

  fireEvent.press(screen.getByTestId(mockMutatePackStateTestId))
  expect(
    screen.getByText(
      'dutch-a2-01:selection=changed,target=pack-a,success=complete'
    )
  ).toBeTruthy()

  mockUseLocalSearchParams.mockReturnValue({
    packId: 'dutch-b1-01',
    version: '1.0.0',
  })
  screen.rerender(<StarterPackScreen />)

  expect(
    screen.getByText('dutch-b1-01:selection=fresh,target=fresh,success=empty')
  ).toBeTruthy()
  expect(screen.queryByText(/selection=changed/)).toBeNull()
})

it('resets personal import state when the signed-in account changes', () => {
  mockApplicationState.currentUserId = 'qa-user-a'
  mockUseLocalSearchParams.mockReturnValue({
    packId: 'dutch-a2-01',
    version: '1.0.0',
  })
  const screen = render(<StarterPackScreen />)

  fireEvent.press(screen.getByTestId(mockMutatePackStateTestId))
  expect(screen.getByText(/selection=changed/)).toBeTruthy()

  mockApplicationState.currentUserId = 'qa-user-b'
  screen.rerender(<StarterPackScreen />)

  expect(
    screen.getByText('dutch-a2-01:selection=fresh,target=fresh,success=empty')
  ).toBeTruthy()
  expect(screen.queryByText(/selection=changed/)).toBeNull()
})
