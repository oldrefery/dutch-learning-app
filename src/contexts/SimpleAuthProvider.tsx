import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { router, type Href } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ROUTES } from '@/constants/Routes'
import type { LoginCredentials, SignupCredentials } from '@/types/AuthTypes'
import { Sentry } from '@/lib/sentry'
import { initiateGoogleOAuth } from '@/lib/googleAuth'
import { initiateAppleSignIn } from '@/lib/appleAuth'
import { isNetworkAvailable } from '@/utils/network'
import {
  createPasswordRecoveryClient,
  type PasswordRecoveryClient,
} from '@/lib/passwordRecoveryClient'
import type { AuthCallbackTokens } from '@/lib/authDeepLink'

interface SimpleAuthState {
  loading: boolean
  error: string | null
}

interface SimpleAuthActions {
  testSignUp: (credentials: SignupCredentials) => Promise<void>
  testSignIn: (
    credentials: LoginCredentials,
    redirectUrl?: Href
  ) => Promise<void>
  signInWithGoogle: (redirectUrl?: Href) => Promise<void>
  signInWithApple: (redirectUrl?: Href) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  preparePasswordRecovery: (tokens: AuthCallbackTokens) => Promise<void>
  cancelPasswordRecovery: () => Promise<void>
  resetPassword: (newPassword: string) => Promise<void>
  clearError: () => void
}

type SimpleAuthContextType = SimpleAuthState & SimpleAuthActions

const SimpleAuthContext = createContext<SimpleAuthContextType | null>(null)

const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred. Please try again.',
} as const

const PASSWORD_RESET_COOLDOWN_MS = 60_000
const PASSWORD_RESET_THROTTLE_PATTERNS = [
  'rate limit',
  'too many requests',
  'security purposes',
  'try again later',
]

const isPasswordResetThrottled = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const status = (error as { status?: unknown }).status
  if (status === 429) return true

  const message = (error as { message?: unknown }).message
  if (typeof message !== 'string') return false

  const normalizedMessage = message.toLowerCase()
  return PASSWORD_RESET_THROTTLE_PATTERNS.some(pattern =>
    normalizedMessage.includes(pattern)
  )
}

const getRemainingCooldownSeconds = (cooldownUntil: number): number =>
  Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000))

export function useSimpleAuth() {
  const context = useContext(SimpleAuthContext)
  if (!context) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider')
  }
  return context
}

export function SimpleAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordResetCooldownUntil, setPasswordResetCooldownUntil] = useState<
    number | null
  >(null)
  const passwordRecoveryTokensRef = useRef<AuthCallbackTokens | null>(null)
  const passwordRecoveryClientRef = useRef<PasswordRecoveryClient | null>(null)
  const initializeApp = useApplicationStore(state => state.initializeApp)

  const discardPasswordRecovery = useCallback(async () => {
    const recoveryClient = passwordRecoveryClientRef.current
    passwordRecoveryClientRef.current = null
    passwordRecoveryTokensRef.current = null

    if (!recoveryClient) {
      return
    }

    try {
      const { error: signOutError } = await recoveryClient.auth.signOut({
        scope: 'local',
      })
      if (signOutError) {
        Sentry.captureException(signOutError, {
          tags: { operation: 'discardPasswordRecovery' },
        })
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'discardPasswordRecovery' },
      })
    }
  }, [])

  const preparePasswordRecovery = useCallback(
    async (tokens: AuthCallbackTokens) => {
      await discardPasswordRecovery()
      passwordRecoveryTokensRef.current = tokens
    },
    [discardPasswordRecovery]
  )

  // Check for the existing session on app start and handle OAuth deep links
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          Sentry.captureException(sessionError, {
            tags: { operation: 'simpleAuthProviderSessionCheck' },
            extra: { message: 'Session check error' },
          })
          return
        }

        if (session?.user?.id) {
          await initializeApp(session.user.id)
        } else {
          // Initialize with no user to clear any stale data
          await initializeApp()
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { operation: 'simpleAuthProviderCheckSession' },
          extra: { message: 'Error checking session' },
        })
        // Initialize with no user to clear any stale data
        await initializeApp()
      }
    }

    checkExistingSession()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      Sentry.addBreadcrumb({
        category: 'auth',
        level: 'info',
        message: '[SimpleAuthProvider] onAuthStateChange',
        data: {
          event,
          hasSession: Boolean(session?.user?.id),
        },
      })

      // Fire initializeApp without blocking - this prevents setSession() from hanging
      if (event === 'SIGNED_OUT' || !session?.user?.id) {
        initializeApp() // Clear user data (fire and forget)
      } else if (event === 'SIGNED_IN' && session?.user?.id) {
        initializeApp(session.user.id) // Initialize with the user (fire and forget)
      }
    })

    // Manage auto-refresh based on app state
    // Guard with network check to avoid clearing session when offline (GitHub #36906)
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const hasNetwork = await isNetworkAvailable()
        if (hasNetwork) {
          // Force immediate session refresh if JWT expired in background
          try {
            await supabase.auth.getSession()
          } catch {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'getSession failed on foreground resume',
              level: 'warning',
            })
          }
          supabase.auth.startAutoRefresh()
        }
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    )

    return () => {
      subscription.unsubscribe()
      appStateSubscription.remove()
    }
  }, [initializeApp])

  const testSignUp = async (credentials: SignupCredentials) => {
    try {
      setLoading(true)
      setError(null)

      // Basic validation
      if (credentials.password !== credentials.confirmPassword) {
        setError('Passwords do not match.')
        return
      }

      if (credentials.password.length < 6) {
        setError('Password must be at least 6 characters long.')
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      })

      if (error) {
        // User-friendly error messages
        if (error.message.includes('already registered')) {
          setError(
            'An account with this email already exists. Try signing in instead.'
          )
        } else if (error.message.includes('password')) {
          setError('Password must be at least 6 characters long.')
        } else if (error.message.includes('email')) {
          setError('Please enter a valid email address.')
        } else {
          setError(`Registration failed: ${error.message}`)
        }
        return
      }

      if (!data.session) {
        setError(
          'Registration successful! Please check your email and click the confirmation link to complete your registration.'
        )
      } else {
        setError('Registration successful! You can now sign in.')
      }
    } catch {
      setError(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setLoading(false)
    }
  }

  const testSignIn = async (
    credentials: LoginCredentials,
    redirectUrl?: Href
  ) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      })

      if (error) {
        // User-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link.')
        } else {
          setError(`Login failed: ${error.message}`)
        }
        return
      }

      if (data.session) {
        // Session is automatically saved by a Supabase client to SecureStore
        // Initialize app store with user data
        await initializeApp(data.user?.id)

        // Handle deferred deep linking
        if (redirectUrl) {
          router.replace(redirectUrl)
        } else {
          // Navigate to the main app
          router.replace(ROUTES.TABS.ROOT)
        }
      } else {
        setError('Login successful! (Session created but not stored)')
      }
    } catch {
      setError(ERROR_MESSAGES.UNEXPECTED)
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async (redirectUrl?: Href) => {
    try {
      setLoading(true)
      setError(null)

      const result = await initiateGoogleOAuth()

      if (result.type === 'success') {
        // Wait a moment for auth state change to propagate
        await new Promise(resolve => setTimeout(resolve, 300))

        // Get the current session (should be set by googleAuth)
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user?.id) {
          await initializeApp(session.user.id)

          // Handle deferred deep linking
          if (redirectUrl) {
            router.replace(redirectUrl)
          } else {
            router.replace(ROUTES.TABS.ROOT)
          }
        } else {
          setError('Failed to create session. Please try again.')
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setError('Google sign-in was cancelled.')
      }
    } catch (error) {
      setError('Failed to sign in with Google. Please try again.')
      Sentry.captureException(error, {
        tags: { operation: 'signInWithGoogle' },
        extra: { message: 'Google OAuth failed' },
      })
    } finally {
      setLoading(false)
    }
  }

  const signInWithApple = async (redirectUrl?: Href) => {
    try {
      setLoading(true)
      setError(null)

      const result = await initiateAppleSignIn()

      if (result.type === 'success') {
        // Wait a moment for auth state change to propagate
        await new Promise(resolve => setTimeout(resolve, 300))

        // Get the current session (should be set by appleAuth)
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user?.id) {
          await initializeApp(session.user.id)

          // Handle deferred deep linking
          if (redirectUrl) {
            router.replace(redirectUrl)
          } else {
            router.replace(ROUTES.TABS.ROOT)
          }
        } else {
          setError('Failed to create session. Please try again.')
        }
      } else if (result.type === 'cancel') {
        setError('Apple sign-in was cancelled.')
      } else if (result.type === 'error') {
        setError(
          result.error?.message ||
            'Failed to sign in with Apple. Please try again.'
        )
      }
    } catch (error) {
      setError('Failed to sign in with Apple. Please try again.')
      Sentry.captureException(error, {
        tags: { operation: 'signInWithApple' },
        extra: { message: 'Apple Sign-In failed' },
      })
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signOut()

      if (error) {
        setError('Failed to sign out. Please try again.')
        Sentry.captureException(error, {
          tags: { operation: 'simpleAuthProviderSignOut' },
          extra: { message: 'Sign out error' },
        })

        return
      }

      // The onAuthStateChange listener will handle clearing the app data
      router.replace(ROUTES.AUTH.LOGIN)
    } catch (error) {
      setError(ERROR_MESSAGES.UNEXPECTED)
      Sentry.captureException(error, {
        tags: { operation: 'simpleAuthProviderSignOut' },
        extra: { message: 'Unexpected sign out error' },
      })
    } finally {
      setLoading(false)
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      setLoading(true)
      setError(null)

      if (
        passwordResetCooldownUntil &&
        Date.now() < passwordResetCooldownUntil
      ) {
        const remainingSeconds = getRemainingCooldownSeconds(
          passwordResetCooldownUntil
        )
        setError(
          `For security, please wait ${remainingSeconds} seconds before requesting another reset email.`
        )
        return
      }

      // Generate deep link URL for password reset
      const redirectUrl = Linking.createURL('(auth)/reset-password')

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: redirectUrl,
        }
      )

      if (error) {
        if (isPasswordResetThrottled(error)) {
          const cooldownUntil = Date.now() + PASSWORD_RESET_COOLDOWN_MS
          const remainingSeconds = getRemainingCooldownSeconds(cooldownUntil)
          setPasswordResetCooldownUntil(cooldownUntil)
          setError(
            `For security, please wait ${remainingSeconds} seconds before requesting another reset email.`
          )

          Sentry.addBreadcrumb({
            category: 'auth.password_reset',
            message: 'Password reset request throttled',
            level: 'warning',
            data: {
              email,
              cooldownSeconds: remainingSeconds,
            },
          })
          return
        }

        setError(`Failed to send reset email: ${error.message}`)
        Sentry.captureException(error, {
          tags: { operation: 'requestPasswordReset' },
          extra: { email, redirectUrl },
        })
        return
      }

      setPasswordResetCooldownUntil(Date.now() + PASSWORD_RESET_COOLDOWN_MS)
      setError('Password reset email sent! Please check your inbox.')
    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
      Sentry.captureException(error, {
        tags: { operation: 'requestPasswordReset' },
      })
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (newPassword: string) => {
    try {
      setLoading(true)
      setError(null)

      let recoveryClient = passwordRecoveryClientRef.current
      if (!recoveryClient) {
        const recoveryTokens = passwordRecoveryTokensRef.current
        if (!recoveryTokens) {
          setError(
            'This password reset link is invalid or expired. Please request a new one.'
          )
          return
        }

        recoveryClient = createPasswordRecoveryClient()
        passwordRecoveryClientRef.current = recoveryClient
        passwordRecoveryTokensRef.current = null

        let sessionError: unknown = null
        try {
          const sessionResult = await recoveryClient.auth.setSession({
            access_token: recoveryTokens.accessToken,
            refresh_token: recoveryTokens.refreshToken,
          })
          sessionError = sessionResult.error
        } catch (error) {
          sessionError = error
        }

        if (sessionError) {
          await discardPasswordRecovery()
          setError('Failed to authenticate. Please request a new reset link.')
          Sentry.captureException(sessionError, {
            tags: { operation: 'resetPasswordSetSession' },
          })
          return
        }
      }

      const { error: updateError } = await recoveryClient.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(`Failed to reset password: ${updateError.message}`)
        Sentry.captureException(updateError, {
          tags: { operation: 'resetPassword' },
        })
        return
      }

      let sessionCleanupFailed = false

      try {
        const { error: recoverySignOutError } =
          await recoveryClient.auth.signOut({
            scope: 'global',
          })

        if (recoverySignOutError) {
          sessionCleanupFailed = true
          Sentry.captureException(recoverySignOutError, {
            tags: { operation: 'resetPasswordRecoverySignOut' },
          })
          await recoveryClient.auth.signOut({ scope: 'local' })
        }
      } catch (signOutError) {
        sessionCleanupFailed = true
        Sentry.captureException(signOutError, {
          tags: { operation: 'resetPasswordRecoverySignOut' },
        })
      }

      passwordRecoveryClientRef.current = null
      passwordRecoveryTokensRef.current = null

      try {
        const { error: primarySignOutError } = await supabase.auth.signOut({
          scope: 'local',
        })

        if (primarySignOutError) {
          sessionCleanupFailed = true
          Sentry.captureException(primarySignOutError, {
            tags: { operation: 'resetPasswordPrimarySignOut' },
          })
        }
      } catch (signOutError) {
        sessionCleanupFailed = true
        Sentry.captureException(signOutError, {
          tags: { operation: 'resetPasswordPrimarySignOut' },
        })
      }

      await initializeApp()

      if (sessionCleanupFailed) {
        setError(
          'Password reset, but session cleanup failed. Please close and reopen the app before signing in.'
        )
        return
      }

      setError('Password successfully reset! You can now sign in.')

      setTimeout(() => {
        router.replace(ROUTES.AUTH.LOGIN)
      }, 2000)
    } catch (error) {
      setError(ERROR_MESSAGES.UNEXPECTED)
      Sentry.captureException(error, {
        tags: { operation: 'resetPassword' },
      })
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => {
    setError(null)
  }

  const contextValue = {
    loading,
    error,
    testSignUp,
    testSignIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    requestPasswordReset,
    preparePasswordRecovery,
    cancelPasswordRecovery: discardPasswordRecovery,
    resetPassword,
    clearError,
  }

  return (
    <SimpleAuthContext.Provider value={contextValue}>
      {children}
    </SimpleAuthContext.Provider>
  )
}
