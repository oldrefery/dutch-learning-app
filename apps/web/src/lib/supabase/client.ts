'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@woordenaar/supabase-contracts'
import { getSupabasePublicConfig } from '@/lib/env'

export const createClient = () => {
  const { url, publishableKey } = getSupabasePublicConfig()
  return createBrowserClient<Database>(url, publishableKey)
}
