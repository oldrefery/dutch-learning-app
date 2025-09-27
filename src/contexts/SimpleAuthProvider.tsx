import React, { createContext, useContext, useState, useEffect } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ROUTES } from '@/constants/Routes'
import type { LoginCredentials, SignupCredentials } from '@/types/AuthTypes'

interface SimpleAuthState {
  loading: boolean
  error: string | null
}

interface SimpleAuthActions {
  testSignUp: (credentials: SignupCredentials) => Promise<void>
  testSignIn: (
    credentials: LoginCredentials,
    redirectUrl?: string | { pathname: string; params?: any }
  ) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

type SimpleAuthContextType = SimpleAuthState & SimpleAuthActions

const SimpleAuthContext = createContext<SimpleAuthContextType | null>(null)

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
  const initializeApp = useApplicationStore(state => state.initializeApp)

  // Check for the existing session on app start
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        console.log('🔍 [SimpleAuthProvider] Checking for existing session...')
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error(
            '❌ [SimpleAuthProvider] Session check error:',
            sessionError
          )
          return
        }

        if (session?.user?.id) {
          console.log(
            '✅ [SimpleAuthProvider] Found existing session, initializing app...',
            {
              userId: session.user.id,
            }
          )
          await initializeApp(session.user.id)
        } else {
          console.log('ℹ️ [SimpleAuthProvider] No existing session found')
          // Initialize with no user to clear any stale data
          await initializeApp()
        }
      } catch (error) {
        console.error('❌ [SimpleAuthProvider] Error checking session:', error)
        // Initialize with no user to clear any stale data
        await initializeApp()
      }
    }

    checkExistingSession()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 [SimpleAuthProvider] Auth state changed:', {
        event,
        userId: session?.user?.id,
      })

      if (event === 'SIGNED_OUT' || !session?.user?.id) {
        console.log(
          '🚪 [SimpleAuthProvider] User signed out, clearing app data'
        )
        await initializeApp() // Clear user data
      } else if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log(
          '🚪 [SimpleAuthProvider] User signed in, initializing app data'
        )
        await initializeApp(session.user.id)
      }
    })

    return () => {
      subscription.unsubscribe()
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
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const testSignIn = async (
    credentials: LoginCredentials,
    redirectUrl?: string | { pathname: string; params?: any }
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
          router.replace(redirectUrl as any)
        } else {
          // Navigate to the main app
          router.replace(ROUTES.TABS.ROOT)
        }
      } else {
        setError('Login successful! (Session created but not stored)')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🚪 [SimpleAuthProvider] Signing out user...')

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('❌ [SimpleAuthProvider] Sign out error:', error)
        setError('Failed to sign out. Please try again.')
        return
      }

      console.log('✅ [SimpleAuthProvider] User signed out successfully')
      // The onAuthStateChange listener will handle clearing the app data
      router.replace(ROUTES.AUTH.LOGIN)
    } catch (error) {
      console.error('❌ [SimpleAuthProvider] Unexpected sign out error:', error)
      setError('An unexpected error occurred during sign out.')
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
    signOut,
    clearError,
  }

  return (
    <SimpleAuthContext.Provider value={contextValue}>
      {children}
    </SimpleAuthContext.Provider>
  )
}
