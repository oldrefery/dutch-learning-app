import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { SimpleAuthProvider, useSimpleAuth } from '../SimpleAuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry'

jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
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
      setSession: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      signOut: jest.fn(),
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

    expect(result.current.error).toContain('Too many reset attempts')
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Password reset request throttled',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          operation: 'requestPasswordReset',
          expected_error: 'rate_limit',
        }),
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
    expect(result.current.error).toContain('Please wait')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
