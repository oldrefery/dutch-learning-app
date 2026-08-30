import { createServerClient } from '@supabase/ssr'
import type { Database } from '@woordenaar/supabase-contracts'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from '@/lib/env'

export const createClient = async () => {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabasePublicConfig()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: cookiesToSet => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          return
        }
      },
    },
  })
}
