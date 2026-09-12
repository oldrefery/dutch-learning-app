import 'server-only'

import type { AccessLevel } from '@woordenaar/domain'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AuthContext {
  userId: string
  email: string | null
  accessLevel: AccessLevel
}

export interface AuthenticatedIdentity {
  email: string | null
  userId: string
}

const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return error ? null : user
})

export const requireAuthenticatedIdentity = cache(
  async (): Promise<AuthenticatedIdentity> => {
    const user = await getAuthenticatedUser()

    if (!user) {
      redirect('/login')
    }

    return { userId: user.id, email: user.email ?? null }
  }
)

export const requireAuthContext = cache(async (): Promise<AuthContext> => {
  const identity = await requireAuthenticatedIdentity()

  const supabase = await createClient()
  const { data } = await supabase
    .from('user_access_levels')
    .select('access_level')
    .eq('user_id', identity.userId)
    .maybeSingle()

  const accessLevel: AccessLevel =
    data?.access_level === 'full_access' ? 'full_access' : 'read_only'

  return {
    userId: identity.userId,
    email: identity.email,
    accessLevel,
  }
})
