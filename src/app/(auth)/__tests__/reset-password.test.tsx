import React from 'react'
import {
  Pressable as MockPressable,
  Text as MockText,
  TextInput as MockTextInput,
  View as MockView,
} from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Linking from 'expo-linking'
import { useSimpleAuth } from '@/contexts/SimpleAuthProvider'
import ResetPasswordScreen from '../reset-password'

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
}))

jest.mock('expo-router', () => ({
  Color: {
    android: {
      dynamic: {
        primary: '#6200EE',
        onPrimary: '#FFFFFF',
        secondary: '#03DAC6',
        onSecondary: '#000000',
        surface: '#FFFFFF',
        onSurface: '#000000',
        background: '#FFFFFF',
        onBackground: '#000000',
        error: '#B00020',
        onError: '#FFFFFF',
      },
    },
    ios: {
      label: '#000000',
      secondaryLabel: '#3C3C43',
      tertiaryLabel: '#3C3C4399',
      systemBackground: '#FFFFFF',
      secondarySystemBackground: '#F2F2F7',
      systemBlue: '#007AFF',
      systemRed: '#FF3B30',
      systemGreen: '#34C759',
    },
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocalSearchParams: jest.fn(() => ({})),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <MockView>{children}</MockView>
  ),
}))

jest.mock('@/components/Themed', () => ({
  ViewThemed: ({
    children,
    ...props
  }: {
    children?: React.ReactNode
    [key: string]: unknown
  }) => <MockView {...props}>{children}</MockView>,
  TextThemed: ({
    children,
    ...props
  }: {
    children?: React.ReactNode
    [key: string]: unknown
  }) => <MockText {...props}>{children}</MockText>,
}))

jest.mock('@/components/auth/AuthInput', () => ({
  AuthInput: ({
    value,
    onChangeText,
    placeholder,
    testID,
  }: {
    value: string
    onChangeText: (value: string) => void
    placeholder: string
    testID: string
  }) => (
    <MockTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      testID={testID}
    />
  ),
}))

jest.mock('@/components/auth/AuthButton', () => ({
  AuthButton: ({
    title,
    onPress,
    testID,
  }: {
    title: string
    onPress: () => void
    testID: string
  }) => (
    <MockPressable onPress={onPress} testID={testID}>
      <MockText>{title}</MockText>
    </MockPressable>
  ),
}))

jest.mock('@/contexts/SimpleAuthProvider')

describe('ResetPasswordScreen', () => {
  const resetPassword = jest.fn()
  const clearError = jest.fn()
  const newPassword = 'new-password'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSimpleAuth as jest.Mock).mockReturnValue({
      resetPassword,
      loading: false,
      error: null,
      clearError,
    })
    ;(Linking.getInitialURL as jest.Mock).mockResolvedValue(
      'dutchlearning://reset-password#access_token=access-secret&refresh_token=refresh-secret'
    )
  })

  it('parses reset tokens without logging URL or token material', async () => {
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)

    const { getByTestId } = render(<ResetPasswordScreen />)

    await waitFor(() => {
      expect(Linking.getInitialURL).toHaveBeenCalled()
    })

    fireEvent.changeText(getByTestId('reset-password-input'), newPassword)
    fireEvent.changeText(
      getByTestId('reset-confirm-password-input'),
      newPassword
    )
    fireEvent.press(getByTestId('reset-password-button'))

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith(
        newPassword,
        'access-secret',
        'refresh-secret'
      )
    })

    const loggedOutput = consoleLogSpy.mock.calls.flat().join(' ')
    expect(loggedOutput).not.toContain('access-secret')
    expect(loggedOutput).not.toContain('refresh-secret')
    expect(consoleLogSpy).not.toHaveBeenCalled()

    consoleLogSpy.mockRestore()
  })
})
