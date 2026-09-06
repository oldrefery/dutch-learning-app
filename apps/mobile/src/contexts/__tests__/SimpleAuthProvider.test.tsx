import React from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import { SimpleAuthProvider, useSimpleAuth } from '../SimpleAuthProvider'
import { supabase } from '@/lib/supabaseClient'
import { createPasswordRecoveryClient } from '@/lib/passwordRecoveryClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry'
import { ROUTES } from '@/constants/Routes'
import { isNetworkAvailable } from '@/utils/network'

jest.mock('@/utils/network', () => ({ isNetworkAvailable: jest.fn() }))

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
    jest.mocked(isNetworkAvailable).mockReset().mockResolvedValue(true)
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
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it.each([
    ['network', 'background'],
    ['network', 'inactive'],
    ['network', 'unmounted'],
    ['session', 'background'],
    ['session', 'inactive'],
    ['session', 'unmounted'],
  ] as const)(
    'ignores late %s completion after becoming %s',
    async (phase, destination) => {
      const listen = jest.spyOn(AppState, 'addEventListener')
      const { unmount } = await renderAuth()
      const change = listen.mock.calls.find(([event]) => event === 'change')![1]
      let finish: () => void = () => {}
      const getSession = jest.mocked(supabase.auth.getSession)
      getSession.mockClear()
      if (phase === 'network') {
        jest.mocked(isNetworkAvailable).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              finish = () => resolve(true)
            })
        )
      } else {
        getSession.mockImplementationOnce(
          () =>
            new Promise(resolve => {
              finish = () => resolve({ data: { session: null }, error: null })
            })
        )
      }
      await act(async () => {
        void change('active')
      })
      if (destination === 'unmounted') unmount()
      else
        await act(async () => {
          void change(destination)
        })
      await act(async () => finish())
      expect(supabase.auth.startAutoRefresh).not.toHaveBeenCalled()
      expect(getSession).toHaveBeenCalledTimes(phase === 'network' ? 0 : 1)
      if (destination !== 'unmounted')
        expect(supabase.auth.stopAutoRefresh).toHaveBeenCalledTimes(1)
    }
  )

  it.each([false, true])(
    'checks foreground session only when online (%s)',
    async online => {
      const listen = jest.spyOn(AppState, 'addEventListener')
      await renderAuth()
      const change = listen.mock.calls.find(([event]) => event === 'change')![1]
      jest.mocked(supabase.auth.getSession).mockClear()
      jest.mocked(isNetworkAvailable).mockResolvedValue(online)
      await act(async () => {
        void change('active')
      })
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(online ? 1 : 0)
      expect(supabase.auth.startAutoRefresh).toHaveBeenCalledTimes(
        online ? 1 : 0
      )
    }
  )

  it('ignores an older foreground check after a newer foreground transition', async () => {
    const listen = jest.spyOn(AppState, 'addEventListener')
    await renderAuth()
    const change = listen.mock.calls.find(([event]) => event === 'change')![1]
    const finish: (() => void)[] = []
    jest.mocked(supabase.auth.getSession).mockImplementation(
      () =>
        new Promise(resolve => {
          finish.push(() => resolve({ data: { session: null }, error: null }))
        })
    )
    for (const state of [
      'active',
      'background',
      'active',
    ] as AppStateStatus[]) {
      await act(async () => {
        void change(state)
      })
    }
    expect(finish).toHaveLength(2)
    await act(async () => finish[0]())
    expect(supabase.auth.startAutoRefresh).not.toHaveBeenCalled()
    await act(async () => finish[1]())
    expect(supabase.auth.startAutoRefresh).toHaveBeenCalledTimes(1)
  })

  it('keeps local identity when the initial session check throws offline', async () => {
    jest
      .mocked(supabase.auth.getSession)
      .mockRejectedValue(new Error('Offline'))
    renderHook(() => useSimpleAuth(), { wrapper })
    await act(async () => {})
    expect(mockInitializeApp).not.toHaveBeenCalled()
  })

  it('does not clear local state for an empty INITIAL_SESSION after refresh failure', async () => {
    jest
      .mocked(supabase.auth.getSession)
      .mockImplementation(() => new Promise(() => {}))
    renderHook(() => useSimpleAuth(), { wrapper })
    const callback = jest.mocked(supabase.auth.onAuthStateChange).mock
      .calls[0][0]
    await act(async () => callback('INITIAL_SESSION', null))
    expect(mockInitializeApp).not.toHaveBeenCalled()
    await act(async () => callback('SIGNED_OUT', null))
    expect(mockInitializeApp).toHaveBeenCalledWith()
  })

  it('ignores an old absent-session response after refresh restores a user', async () => {
    let finish: () => void = () => {}
    jest.mocked(supabase.auth.getSession).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ data: { session: null }, error: null })
        })
    )
    renderHook(() => useSimpleAuth(), { wrapper })
    const callback = jest.mocked(supabase.auth.onAuthStateChange).mock
      .calls[0][0]
    await act(async () =>
      callback('TOKEN_REFRESHED', { user: { id: 'qa-restored' } } as Session)
    )
    await act(async () => finish())
    expect(mockInitializeApp).toHaveBeenCalledTimes(1)
    expect(mockInitializeApp).toHaveBeenCalledWith('qa-restored')
  })

  it('does not initialize from a session response after unmount', async () => {
    let finish: () => void = () => {}
    jest.mocked(supabase.auth.getSession).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ data: { session: null }, error: null })
        })
    )
    const { unmount } = renderHook(() => useSimpleAuth(), { wrapper })
    unmount()
    await act(async () => finish())
    expect(mockInitializeApp).not.toHaveBeenCalled()
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
