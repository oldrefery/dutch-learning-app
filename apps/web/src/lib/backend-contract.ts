import type { Database } from '@woordenaar/supabase-contracts'

type PublicTable = keyof Database['public']['Tables']

export const REQUIRED_PUBLIC_TABLES = [
  'collections',
  'review_events',
  'user_access_levels',
  'user_progress',
  'words',
] as const satisfies readonly PublicTable[]
