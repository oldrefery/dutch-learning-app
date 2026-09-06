import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabaseClient'

/** Session metadata is for display only, never for authorization. */
export function useSessionUser(currentUserId: string | null): User | null {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let active = true
    // INITIAL_SESSION supplies the stored session; getUser would require network
    // and could overwrite this value when Settings opens offline.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return user?.id === currentUserId ? user : null
}
