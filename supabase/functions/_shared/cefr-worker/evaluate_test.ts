import { assertEquals, assertRejects } from '@std/assert'
import {
  evaluateCefrLeases,
  type CefrProvider,
  type CefrProviderRequest,
} from './evaluate.ts'
import { syntheticWorker } from './synthetic-fixtures.ts'

const response = (
  request: CefrProviderRequest,
  candidate: unknown = { level: 'A2', confidence: 0.9 }
) => ({
  kind: 'response' as const,
  body: JSON.stringify({
    job_id: request.job_id,
    input_sha256: request.input_sha256,
    profile_sha256: request.profile_sha256,
    ambiguous: false,
    candidate,
  }),
})
const setup = async () => {
  const fixture = await syntheticWorker()
  return {
    ...fixture,
    options: {
      enabled: true,
      qualification: fixture.qualified,
      timeoutMs: 100,
      provider: (request => response(request)) as CefrProvider,
    },
  }
}

Deno.test('disabled and empty queues make zero provider calls', async () => {
  const { job, options } = await setup()
  let calls = 0
  options.provider = request => {
    calls++
    return response(request)
  }
  for (const enabled of [undefined, false])
    assertEquals(await evaluateCefrLeases([job], { ...options, enabled }), [])
  assertEquals(await evaluateCefrLeases([], options), [])
  assertEquals(calls, 0)
})

Deno.test(
  'unqualified, changed, expired, malformed or oversized inputs stop before provider work',
  async () => {
    const { job, options } = await setup()
    let calls = 0
    options.provider = request => {
      calls++
      return response(request)
    }
    const invalid = [
      { ...job, content: { ...job.content, usage_notes: 'changed' } },
      { ...job, content: { ...job.content, usage_notes: 'x'.repeat(65536) } },
      { ...job, profile: { ...job.profile, prompt_revision: 'changed' } },
      { ...job, profile_sha256: 'a'.repeat(64) },
      { ...job, qualification_sha256: 'a'.repeat(64) },
      { ...job, lease_expires_at: 'invalid' },
      { ...job, lease_expires_at: new Date(0).toISOString() },
      { ...job, content: null },
    ]
    for (const value of invalid)
      assertEquals(
        (await evaluateCefrLeases([value], options))[0].outcome,
        'failed'
      )
    for (const qualification of [null, { ...options.qualification }])
      assertEquals(
        (await evaluateCefrLeases([job], { ...options, qualification }))[0]
          .outcome,
        'failed'
      )
    assertEquals(calls, 0)
  }
)

Deno.test(
  'qualified responses stay estimates and provider fields cannot promote trust',
  async () => {
    const { job, options } = await setup()
    options.provider = request => {
      assertEquals(
        request.canonical_input.includes('assessment_schema_version'),
        true
      )
      assertEquals(Object.hasOwn(request, 'lease_token'), false)
      return response(request, {
        level: 'A2',
        confidence: 0.9,
        status: 'reviewed',
        locked: true,
        source_id: 'forged',
      })
    }
    assertEquals(await evaluateCefrLeases([job], options), [
      { outcome: 'estimated', level: 'A2', confidence: 0.9 },
    ])
  }
)

Deno.test(
  'missing or malformed ambiguity cannot authorize an estimate or discard usage',
  async () => {
    const { job, options } = await setup()
    const usage = {
      provider_request_id: 'synthetic-ambiguity-receipt',
      input_tokens: 10,
      output_tokens: 5,
      reasoning_tokens: 0,
    }
    const results = []
    for (const ambiguous of [undefined, null, 'true', 'false', 0, {}, true]) {
      const [result] = await evaluateCefrLeases([job], {
        ...options,
        provider: request => ({
          kind: 'response',
          body: JSON.stringify({
            ...JSON.parse(response(request).body),
            ambiguous,
          }),
          usage,
        }),
      })
      results.push(result)
    }
    assertEquals(
      results,
      Array.from({ length: 7 }, () => ({
        outcome: 'unknown',
        reason: 'ambiguous_input',
        usage,
      }))
    )
  }
)

Deno.test(
  'invalid, low confidence, abstaining, ambiguous and mismatched responses need review',
  async () => {
    const { job, options } = await setup()
    const providers: CefrProvider[] = [
      r => response(r, { level: 'A2', confidence: 0.5 }),
      r => response(r, { level: null, confidence: null }),
      r => response(r, { level: 'A9', confidence: 1 }),
      r => ({
        kind: 'response',
        body: JSON.stringify({
          ...JSON.parse(response(r).body),
          ambiguous: true,
        }),
      }),
      r => response({ ...r, job_id: 'different' }),
      r => response({ ...r, input_sha256: 'a'.repeat(64) }),
      r => response({ ...r, profile_sha256: 'a'.repeat(64) }),
      () => ({ kind: 'response', body: 'invalid json' }),
      () => ({ kind: 'response', body: 'x'.repeat(4097) }),
    ]
    for (const provider of providers)
      assertEquals(
        (await evaluateCefrLeases([job], { ...options, provider }))[0].outcome,
        'unknown'
      )
  }
)

Deno.test(
  '429, 5xx and transport errors retry; permanent rejection does not spin',
  async () => {
    const { job, options } = await setup()
    for (const status of [429, 500, 503, 599, 400, 401, 403, 404]) {
      const [result] = await evaluateCefrLeases([job], {
        ...options,
        provider: () => ({
          kind: 'http_error',
          status,
          retryAfterSeconds: 99999,
        }),
      })
      assertEquals(
        result.outcome,
        status === 429 || status >= 500 ? 'retry' : 'failed'
      )
      if (result.outcome === 'retry')
        assertEquals(result.retryAfterSeconds, 3600)
    }
    for (const provider of [
      () => ({ kind: 'transport_error' as const }),
      () => {
        throw new Error('private provider text')
      },
    ])
      assertEquals(await evaluateCefrLeases([job], { ...options, provider }), [
        { outcome: 'retry', reason: 'transport' },
      ])
  }
)

Deno.test(
  'timeout returns even when a provider ignores abort; late result cannot settle',
  async () => {
    const { job, options } = await setup()
    let signal: AbortSignal | undefined
    let release:
      ((value: Awaited<ReturnType<CefrProvider>>) => void) | undefined
    const [result] = await evaluateCefrLeases([job], {
      ...options,
      timeoutMs: 5,
      provider: (_request, context) => {
        signal = context.signal
        return new Promise(resolve => {
          release = resolve
        })
      },
    })
    assertEquals(result, { outcome: 'retry', reason: 'timeout' })
    assertEquals(signal?.aborted, true)
    release?.({ kind: 'response', body: '{}' })
  }
)

Deno.test(
  'oversized batches fail before calls and provider cannot mutate captured binding',
  async () => {
    const { job, options } = await setup()
    await assertRejects(
      () => evaluateCefrLeases(Array(9).fill(job), options),
      Error,
      'concurrency bound'
    )
    await assertRejects(
      () => evaluateCefrLeases([job, job], options),
      Error,
      'Duplicate CEFR lease'
    )
    options.provider = r => {
      r.input_sha256 = 'a'.repeat(64)
      return response(r)
    }
    assertEquals(
      (await evaluateCefrLeases([job], options))[0].outcome,
      'unknown'
    )
  }
)
