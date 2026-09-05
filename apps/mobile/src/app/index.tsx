import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { supabase } from '@/lib/supabaseClient'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { LoadingScreen } from '@/components/LoadingScreen'

// Main app entry point - check auth state first
export default function Index() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const initializeApp = useApplicationStore(state => state.initializeApp)

  useEffect(() => {
    let active = true
    void supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (error || !session) return false
        await initializeApp(session.user.id)
        return true
      })
      .then(authenticated => {
        if (active) {
          setIsAuthenticated(authenticated)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setIsAuthenticated(false)
          setIsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [initializeApp])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />
  } else {
    return <Redirect href="/(auth)/login" />
  }
}
