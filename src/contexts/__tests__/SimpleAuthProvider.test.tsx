import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { SimpleAuthProvider, useSimpleAuth } from '../SimpleAuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { createPasswordRecoveryClient } from '@/lib/passwordRecoveryClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry'
import { ROUTES } from '@/constants/Routes'

jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/passwordRecoveryClient', () => ({
  createPasswordRecoveryClient: jest.fn(),
}))
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}))
jest.mock('@/lib/googleAuth', () => ({
  initiateGoogleOAuth: jest.fn(),
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
}))

const NEW_PASSWORD = 'new-password'
const RECOVERY_ACCESS_TOKEN = 'access-token'
const RECOVERY_REFRESH_TOKEN = 'refresh-token'
const RESOLVED_ERROR_CASE_NAME = 'resolved error'
const REJECTED_PROMISE_CASE_NAME = 'rejected promise'

describe('SimpleAuthProvider', () => {
  const TEST_EMAIL = 'user@example.com'
  const mockInitializeApp = jest.fn().mockResolvedValue(undefined)
  const mockUnsubscribe = jest.fn()
  const recoveryAuth = {
    setSession: jest.fn(),
    updateUser: jest.fn(),
    signOut: jest.fn(),
  }

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SimpleAuthProvider>{children}</SimpleAuthProvider>
  )

  const renderAuth = async () => {
    const hook = renderHook(() => useSimpleAuth(), { wrapper })

    await waitFor(() => {
      expect(hook.result.current.loading).toBe(false)
    })
    mockInitializeApp.mockClear()

    return hook
  }

  const prepareRecovery = async (result: {
    current: ReturnType<typeof useSimpleAuth>
  }) => {
    await act(async () => {
      await result.current.preparePasswordRecovery({
        accessToken: RECOVERY_ACCESS_TOKEN,
        refreshToken: RECOVERY_REFRESH_TOKEN,
      })
    })
  }

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

    Object.assign(supabase.auth, {
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
      signOut: jest.fn().mockResolvedValue({
        error: null,
      }),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    })

    recoveryAuth.setSession.mockResolvedValue({ error: null })
    recoveryAuth.updateUser.mockResolvedValue({ error: null })
    recoveryAuth.signOut.mockResolvedValue({ error: null })
    ;(createPasswordRecoveryClient as jest.Mock).mockReturnValue({
      auth: recoveryAuth,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('reports password reset throttling as a warning message', async () => {
    ;(supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      error: {
        status: 429,
        message:
          'For security purposes, you can only request this once every 60 seconds',
      },
    })

    const { result } = await renderAuth()

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

  it('applies a local cooldown to repeated reset requests', async () => {
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.requestPasswordReset(TEST_EMAIL)
    })

    await act(async () => {
      await result.current.requestPasswordReset(TEST_EMAIL)
    })

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
    expect(result.current.error).toContain('For security')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('requires a prepared recovery callback', async () => {
    const { result } = await renderAuth()

    await act(async () => {
      await result.current.resetPassword(NEW_PASSWORD)
    })

    expect(result.current.error).toContain('invalid or expired')
    expect(createPasswordRecoveryClient).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('uses an isolated recovery client and clears the primary session', async () => {
    jest.useFakeTimers()
    const { result } = await renderAuth()
    await prepareRecovery(result)

    await act(async () => {
      await result.current.resetPassword(NEW_PASSWORD)
    })

    expect(recoveryAuth.setSession).toHaveBeenCalledWith({
      access_token: RECOVERY_ACCESS_TOKEN,
      refresh_token: RECOVERY_REFRESH_TOKEN,
    })
    expect(recoveryAuth.updateUser).toHaveBeenCalledWith({
      password: NEW_PASSWORD,
    })
    expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(mockInitializeApp).toHaveBeenCalledWith()
    expect(mockInitializeApp).not.toHaveBeenCalledWith(expect.any(String))
    expect(result.current.error).toBe(
      'Password successfully reset! You can now sign in.'
    )

    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(router.replace).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN)
  })

  it.each([
    {
      name: RESOLVED_ERROR_CASE_NAME,
      configure: () =>
        recoveryAuth.setSession.mockResolvedValue({
          error: new Error('Invalid recovery session'),
        }),
    },
    {
      name: REJECTED_PROMISE_CASE_NAME,
      configure: () =>
        recoveryAuth.setSession.mockRejectedValue(
          new Error('Recovery network failure')
        ),
    },
  ])(
    'handles setSession $name and discards the client',
    async ({ configure }) => {
      configure()
      const { result } = await renderAuth()
      await prepareRecovery(result)

      await act(async () => {
        await result.current.resetPassword(NEW_PASSWORD)
      })

      expect(recoveryAuth.updateUser).not.toHaveBeenCalled()
      expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(result.current.error).toContain('request a new reset link')
      expect(Sentry.captureException).toHaveBeenCalled()
    }
  )

  it.each([
    {
      name: RESOLVED_ERROR_CASE_NAME,
      configure: () =>
        recoveryAuth.updateUser.mockResolvedValue({
          error: new Error('Password rejected'),
        }),
      expectedError: 'password rejected',
    },
    {
      name: REJECTED_PROMISE_CASE_NAME,
      configure: () =>
        recoveryAuth.updateUser.mockRejectedValue(
          new Error('Password update network failure')
        ),
      expectedError: 'unexpected error',
    },
  ])(
    'handles updateUser $name without reporting success',
    async ({ configure, expectedError }) => {
      configure()
      const { result } = await renderAuth()
      await prepareRecovery(result)

      await act(async () => {
        await result.current.resetPassword(NEW_PASSWORD)
      })

      expect(recoveryAuth.signOut).not.toHaveBeenCalledWith({ scope: 'global' })
      expect(supabase.auth.signOut).not.toHaveBeenCalled()
      expect(result.current.error?.toLowerCase()).toContain(expectedError)
      expect(router.replace).not.toHaveBeenCalled()
    }
  )

  it('discards an active recovery session when the flow is cancelled', async () => {
    recoveryAuth.updateUser.mockResolvedValue({
      error: new Error('Password rejected'),
    })
    const { result } = await renderAuth()
    await prepareRecovery(result)

    await act(async () => {
      await result.current.resetPassword(NEW_PASSWORD)
      await result.current.cancelPasswordRecovery()
    })

    expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: RESOLVED_ERROR_CASE_NAME,
      configure: () =>
        recoveryAuth.signOut.mockResolvedValue({
          error: new Error('Global sign out failed'),
        }),
    },
    {
      name: REJECTED_PROMISE_CASE_NAME,
      configure: () =>
        recoveryAuth.signOut.mockRejectedValueOnce(
          new Error('Global sign out network failure')
        ),
    },
  ])(
    'handles recovery signOut $name after updating the password',
    async ({ configure }) => {
      configure()
      const { result } = await renderAuth()
      await prepareRecovery(result)

      await act(async () => {
        await result.current.resetPassword(NEW_PASSWORD)
      })

      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(mockInitializeApp).toHaveBeenCalledWith()
      expect(result.current.error).toContain('session cleanup failed')
      expect(router.replace).not.toHaveBeenCalled()
    }
  )

  it.each([
    {
      name: RESOLVED_ERROR_CASE_NAME,
      configure: () =>
        (supabase.auth.signOut as jest.Mock).mockResolvedValue({
          error: new Error('Primary sign out failed'),
        }),
    },
    {
      name: REJECTED_PROMISE_CASE_NAME,
      configure: () =>
        (supabase.auth.signOut as jest.Mock).mockRejectedValue(
          new Error('Primary sign out network failure')
        ),
    },
  ])(
    'handles primary signOut $name after updating the password',
    async ({ configure }) => {
      configure()
      const { result } = await renderAuth()
      await prepareRecovery(result)

      await act(async () => {
        await result.current.resetPassword(NEW_PASSWORD)
      })

      expect(recoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'global' })
      expect(mockInitializeApp).toHaveBeenCalledWith()
      expect(result.current.error).toContain('session cleanup failed')
      expect(router.replace).not.toHaveBeenCalled()
    }
  )
})
