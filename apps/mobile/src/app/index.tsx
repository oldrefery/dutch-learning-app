import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { LoadingScreen } from '@/components/LoadingScreen'
import { SessionUnavailableScreen } from '@/components/SessionUnavailableScreen'
import { useSessionGate } from '@/hooks/useSessionGate'

// Main app entry point - check auth state first
export default function Index() {
  const session = useSessionGate()
  const initializeApp = useApplicationStore(state => state.initializeApp)
  const currentUserId = useApplicationStore(state => state.currentUserId)

  useEffect(() => {
    if (session.userId) {
      // initializeApp sets identity synchronously. Network access lookup must
      // not hold the entry screen while local collections are already readable.
      void initializeApp(session.userId)
    }
  }, [initializeApp, session.userId])

  if (session.status === 'unavailable') {
    return <SessionUnavailableScreen onRetry={session.retry} />
  }
  if (
    session.status === 'checking' ||
    (session.userId && currentUserId !== session.userId)
  ) {
    return <LoadingScreen />
  }

  if (session.status === 'signed-in') {
    return <Redirect href="/(tabs)" />
  } else {
    return <Redirect href="/(auth)/login" />
  }
}
