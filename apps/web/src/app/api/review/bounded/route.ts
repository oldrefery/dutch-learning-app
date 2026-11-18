import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@woordenaar/supabase-contracts'
import * as Sentry from '@sentry/nextjs'
import { getReviewCalendar } from '@/lib/review-calendar/server'
import { requireAuthenticatedIdentity } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { mapReviewSnapshot } from '@/features/review/repository'
import {
  isBoundedReviewEnabled,
  REVIEW_SESSION_LIMIT,
} from '@/features/review/bounded-review-config'
import { isUuid } from '@/features/words/word-detail'
import type { BoundedReviewPayload } from '@/features/review/useBoundedReview'

type BoundedReviewDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      get_web_review_bounded_snapshot: {
        Args: {
          p_today: string
          p_scope: string
          p_collection_id?: string
          p_limit: number
        }
        Returns: Json
      }
    }
  }
}

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  if (!isBoundedReviewEnabled()) return new Response(null, { status: 404 })
  await requireAuthenticatedIdentity()
  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')
  const collectionId = searchParams.get('collectionId')
  if (
    (scope !== 'all-due' &&
      scope !== 'collection-due' &&
      scope !== 'difficult-due') ||
    (collectionId !== null &&
      (scope !== 'collection-due' || !isUuid(collectionId)))
  )
    return new Response(null, { status: 400, headers: noStore })

  const { dateKey } = await getReviewCalendar()
  if (searchParams.get('day') !== dateKey)
    return new Response(null, { status: 409, headers: noStore })

  const client =
    (await createClient()) as unknown as SupabaseClient<BoundedReviewDatabase>
  const { data, error } = await client.rpc('get_web_review_bounded_snapshot', {
    p_today: dateKey,
    p_scope: scope,
    ...(collectionId === null ? {} : { p_collection_id: collectionId }),
    p_limit: REVIEW_SESSION_LIMIT,
  })
  try {
    if (error) throw new Error('Bounded Review RPC failed')
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.protocolVersion !== 3 ||
      typeof data.dueCount !== 'number' ||
      !Number.isSafeInteger(data.dueCount) ||
      data.dueCount < 0
    )
      throw new Error('Invalid bounded Review response')
    const workspace = mapReviewSnapshot(data)
    if (
      workspace.words.length !== Math.min(REVIEW_SESSION_LIMIT, data.dueCount)
    )
      throw new Error('Bounded Review response length mismatch')
    const payload: BoundedReviewPayload = {
      dateKey,
      dueCount: data.dueCount,
      workspace,
    }
    return Response.json(payload, { headers: noStore })
  } catch (failure) {
    Sentry.captureException(failure, {
      tags: {
        operation: 'get_web_review_bounded_snapshot',
        supabase_error_code: error?.code ?? 'invalid_response',
      },
    })
    return new Response(null, { status: 503, headers: noStore })
  }
}
