import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { ReviewCorrectionDatabase } from './correction-contract'

export async function createCorrectionClient() {
  // This uses the existing request's authenticated client, never service-role credentials.
  return (await createClient()) as unknown as SupabaseClient<ReviewCorrectionDatabase>
}

export async function readCorrectionCapability(
  client: Awaited<ReturnType<typeof createCorrectionClient>>
): Promise<boolean> {
  const { data, error } = await client.rpc('review_correction_protocol')
  if (error?.code === 'PGRST202' || error?.code === '42883') return false
  if (error) throw new Error('Could not verify review correction support.')
  return data === 1
}

export function reviewEventsSource(
  client: Awaited<ReturnType<typeof createCorrectionClient>>,
  correctionsAvailable: boolean
) {
  return correctionsAvailable
    ? client.from('effective_review_events')
    : client.from('review_events')
}
