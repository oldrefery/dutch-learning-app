import { useEffect, useState, useCallback } from 'react'
import { Redirect } from 'expo-router'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { LoadingScreen } from '@/components/LoadingScreen'

// Main app entry point - check auth state first
export default function Index() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const initializeApp = useApplicationStore(state => state.initializeApp)

  const checkAuthState = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        setIsAuthenticated(false)
      } else if (session) {
        // Initialize app with user data
        await initializeApp(session.user.id)
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
      }
    } catch {
      setIsAuthenticated(false)
    }

    setIsLoading(false)
  }, [initializeApp])

  useEffect(() => {
    checkAuthState()
  }, [checkAuthState])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  } else {
    return <Redirect href="/(auth)/login" />
  }
}
