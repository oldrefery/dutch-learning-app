import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  consumeRequestQuota,
  type RequestQuotaDependencies,
} from './requestQuota.ts'

const dependenciesWithRecord = (
  record: {
    allowed: boolean
    remaining: number
    retry_after_seconds: number
  } | null,
  error: unknown = null
): RequestQuotaDependencies => ({
  consume: () => Promise.resolve({ record, error }),
})

Deno.test('consumeRequestQuota returns remaining quota', async () => {
  const result = await consumeRequestQuota(
    'user-1',
    'gemini-analysis',
    10,
    60,
    dependenciesWithRecord({
      allowed: true,
      remaining: 8,
      retry_after_seconds: 0,
    })
  )

  assertEquals(result, { ok: true, remaining: 8 })
})

Deno.test(
  'consumeRequestQuota returns a retry delay when exhausted',
  async () => {
    const result = await consumeRequestQuota(
      'user-1',
      'image-search',
      30,
      60,
      dependenciesWithRecord({
        allowed: false,
        remaining: 0,
        retry_after_seconds: 17,
      })
    )

    assertEquals(result, {
      ok: false,
      status: 429,
      code: 'rate_limit_exceeded',
      message: 'Too many requests. Please try again shortly.',
      retryAfterSeconds: 17,
    })
  }
)

Deno.test('consumeRequestQuota fails closed when the RPC fails', async () => {
  const result = await consumeRequestQuota(
    'user-1',
    'gemini-analysis',
    10,
    60,
    dependenciesWithRecord(null, new Error('database unavailable'))
  )

  assertEquals(result, {
    ok: false,
    status: 500,
    code: 'quota_unavailable',
    message: 'Unable to verify request quota',
  })
})
