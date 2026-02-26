import React, { createContext, useContext, useState, useEffect } from 'react'
import { router, type Href } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ROUTES } from '@/constants/Routes'
import type { LoginCredentials, SignupCredentials } from '@/types/AuthTypes'
import { Sentry } from '@/lib/sentry'
import { initiateGoogleOAuth, handleOAuthCallback } from '@/lib/googleAuth'
import { initiateAppleSignIn } from '@/lib/appleAuth'

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
  resetPassword: (
    newPassword: string,
    accessToken?: string,
    refreshToken?: string
  ) => Promise<void>
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
  const initializeApp = useApplicationStore(state => state.initializeApp)

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

    // Handle OAuth deep links
    const handleDeepLink = async (event: { url: string }) => {
      const handled = await handleOAuthCallback(event.url)
      if (handled) {
        // OAuth callback was handled, session will be set
        // The onAuthStateChange listener will handle the navigation
      }
    }

    // Listen for deep links
    const deepLinkSubscription = Linking.addEventListener('url', handleDeepLink)

    // Check if app was opened with a deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink({ url })
      }
    })

    return () => {
      subscription.unsubscribe()
      deepLinkSubscription.remove()
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
          `Please wait ${remainingSeconds} seconds before requesting another reset email.`
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
            `Too many reset attempts. Please wait ${remainingSeconds} seconds and try again.`
          )

          Sentry.captureMessage('Password reset request throttled', {
            level: 'warning',
            tags: {
              operation: 'requestPasswordReset',
              expected_error: 'rate_limit',
            },
            extra: {
              email,
              redirectUrl,
              message: (error as { message?: string }).message,
              cooldownSeconds: remainingSeconds,
            },
            fingerprint: ['requestPasswordReset', 'rate_limit'],
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

  const resetPassword = async (
    newPassword: string,
    accessToken?: string,
    refreshToken?: string
  ) => {
    try {
      setLoading(true)
      setError(null)

      // If tokens are provided, set the session first
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          setError('Failed to authenticate. Please request a new reset link.')
          Sentry.captureException(sessionError, {
            tags: { operation: 'resetPasswordSetSession' },
          })
          return
        }
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setError(`Failed to reset password: ${error.message}`)
        Sentry.captureException(error, {
          tags: { operation: 'resetPassword' },
        })
        return
      }

      // Initialize app with the user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.id) {
        await initializeApp(user.id)
      }

      setError('Password successfully reset! You can now sign in.')

      // Navigate to log in after a short delay
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
    resetPassword,
    clearError,
  }

  return (
    <SimpleAuthContext.Provider value={contextValue}>
      {children}
    </SimpleAuthContext.Provider>
  )
}
