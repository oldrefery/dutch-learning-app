import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { SimpleAuthProvider, useSimpleAuth } from '../SimpleAuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry'
import { router } from 'expo-router'
import { ROUTES } from '@/constants/Routes'

jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}))
jest.mock('@/lib/googleAuth', () => ({
  initiateGoogleOAuth: jest.fn(),
  handleOAuthCallback: jest.fn().mockResolvedValue(false),
}))
jest.mock('@/lib/appleAuth', () => ({
  initiateAppleSignIn: jest.fn(),
}))
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}))
jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'dutchlearning://reset-password'),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn().mockResolvedValue(null),
}))

describe('SimpleAuthProvider requestPasswordReset', () => {
  const TEST_EMAIL = 'user@example.com'
  const mockInitializeApp = jest.fn().mockResolvedValue(undefined)
  const mockUnsubscribe = jest.fn()

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SimpleAuthProvider>{children}</SimpleAuthProvider>
  )

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useApplicationStore as unknown as jest.Mock).mockImplementation(
      (
        selector: (state: {
          initializeApp: typeof mockInitializeApp
        }) => unknown
      ) =>
        selector({
          initializeApp: mockInitializeApp,
        })
    )
    ;(supabase as any).auth = {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({
        error: null,
      }),
      setSession: jest.fn().mockResolvedValue({
        error: null,
      }),
      updateUser: jest.fn().mockResolvedValue({
        error: null,
      }),
      getUser: jest.fn(),
      signOut: jest.fn().mockResolvedValue({
        error: null,
      }),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
    }
  })

  it('should report password reset throttling as warning message (not exception)', async () => {
    ;(supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      error: {
        status: 429,
        message:
          'For security purposes, you can only request this once every 60 seconds',
      },
    })

    const { result } = renderHook(() => useSimpleAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.requestPasswordReset(TEST_EMAIL)
    })

    expect(result.current.error).toContain('For security')
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'auth.password_reset',
        message: 'Password reset request throttled',
        level: 'warning',
      })
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should apply local cooldown and skip repeated reset requests', async () => {
    const { result } = renderHook(() => useSimpleAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.requestPasswordReset(TEST_EMAIL)
    })

    expect(result.current.error).toBe(
      'Password reset email sent! Please check your inbox.'
    )

    await act(async () => {
      await result.current.requestPasswordReset(TEST_EMAIL)
    })

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
    expect(result.current.error).toContain('For security')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('should sign out globally after successful password reset', async () => {
    jest.useFakeTimers()

    const { result } = renderHook(() => useSimpleAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    mockInitializeApp.mockClear()

    await act(async () => {
      await result.current.resetPassword(
        'new-password',
        'access-token',
        'refresh-token'
      )
    })

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'new-password',
    })
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(mockInitializeApp).toHaveBeenCalledWith()
    expect(mockInitializeApp).not.toHaveBeenCalledWith(expect.any(String))
    expect(result.current.error).toBe(
      'Password successfully reset! You can now sign in.'
    )

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(router.replace).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN)

    jest.useRealTimers()
  })
})
