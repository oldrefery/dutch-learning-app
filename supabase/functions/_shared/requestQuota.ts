import { createClient } from '@supabase/supabase-js'

export type EdgeFunctionCapability = 'gemini-analysis' | 'image-search'

interface QuotaRecord {
  allowed: boolean
  remaining: number
  retry_after_seconds: number
}

export interface RequestQuotaDependencies {
  consume: (
    userId: string,
    capability: EdgeFunctionCapability,
    limit: number,
    windowSeconds: number
  ) => Promise<{ record: QuotaRecord | null; error: unknown }>
}

export type RequestQuotaResult =
  | { ok: true; remaining: number }
  | {
      ok: false
      status: 429 | 500
      code: 'rate_limit_exceeded' | 'quota_unavailable'
      message: string
      retryAfterSeconds?: number
    }

export const consumeRequestQuota = async (
  userId: string,
  capability: EdgeFunctionCapability,
  limit: number,
  windowSeconds: number,
  dependencies: RequestQuotaDependencies
): Promise<RequestQuotaResult> => {
  const { record, error } = await dependencies.consume(
    userId,
    capability,
    limit,
    windowSeconds
  )

  if (error || !record) {
    return {
      ok: false,
      status: 500,
      code: 'quota_unavailable',
      message: 'Unable to verify request quota',
    }
  }

  if (!record.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'rate_limit_exceeded',
      message: 'Too many requests. Please try again shortly.',
      retryAfterSeconds: Math.max(1, record.retry_after_seconds),
    }
  }

  return { ok: true, remaining: Math.max(0, record.remaining) }
}

export const consumeRequestQuotaWithServiceRole = async (
  userId: string,
  capability: EdgeFunctionCapability,
  limit: number,
  windowSeconds: number
): Promise<RequestQuotaResult> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      code: 'quota_unavailable',
      message: 'Request quota service is not configured',
    }
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return consumeRequestQuota(userId, capability, limit, windowSeconds, {
    consume: async (
      quotaUserId,
      quotaCapability,
      quotaLimit,
      quotaWindowSeconds
    ) => {
      const { data, error } = await client.rpc('consume_edge_function_quota', {
        p_user_id: quotaUserId,
        p_capability: quotaCapability,
        p_limit: quotaLimit,
        p_window_seconds: quotaWindowSeconds,
      })
      const records = data as QuotaRecord[] | null

      return { record: records?.[0] ?? null, error }
    },
  })
}
