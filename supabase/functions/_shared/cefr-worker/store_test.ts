import { assertEquals, assertRejects } from '@std/assert'
import { createCefrRpcStore, type CefrRpcName } from './store.ts'
import { syntheticWorker } from './synthetic-fixtures.ts'

Deno.test(
  'RPC store uses generated contracts and only server-owned reservation identity',
  async () => {
    const fixture = await syntheticWorker()
    const job = {
      ...fixture.job,
      reservation_id: crypto.randomUUID(),
      reservation_utc_day: new Date().toISOString().slice(0, 10),
    }
    const calls: { name: CefrRpcName; args: Record<string, unknown> }[] = []
    const store = createCefrRpcStore((name, args) => {
      calls.push({ name, args })
      return Promise.resolve({ data: { status: 'ok' }, error: null })
    })
    const run = crypto.randomUUID(),
      policy = crypto.randomUUID()
    await store.start(policy, run)
    await store.authorize(job)
    await store.finish(job, {
      outcome: 'estimated',
      level: 'A2',
      confidence: 0.9,
      usage: {
        provider_request_id: 'TEST-ONLY-request',
        input_tokens: 10,
        output_tokens: 5,
        reasoning_tokens: 0,
      },
    })
    await store.finish(job, {
      outcome: 'retry',
      reason: 'provider_unavailable',
      retryAfterSeconds: 3600,
    })
    await store.summarize(run)
    assertEquals(
      calls.map(call => call.name),
      [
        'start_dictionary_cefr_run_v1',
        'authorize_dictionary_cefr_dispatch_v1',
        'finish_dictionary_cefr_attempt_v1',
        'finish_dictionary_cefr_attempt_v1',
        'finish_dictionary_cefr_run_v1',
      ]
    )
    assertEquals(calls[0].args, { p_policy_id: policy, p_run_id: run })
    assertEquals(calls[1].args, {
      p_reservation_id: job.reservation_id,
      p_lease_token: job.lease_token,
    })
    assertEquals(calls[2].args.p_usage, {
      provider_request_id: 'TEST-ONLY-request',
      input_tokens: 10,
      output_tokens: 5,
      reasoning_tokens: 0,
    })
    assertEquals(Object.hasOwn(calls[3].args, 'p_level'), false)
    assertEquals(Object.hasOwn(calls[3].args, 'p_usage'), false)
  }
)

Deno.test(
  'RPC failures hide raw credentials and malformed missing data',
  async () => {
    for (const reply of [
      { data: null, error: null },
      { data: {}, error: { message: 'private credentials' } },
      { data: undefined, error: null },
    ]) {
      const store = createCefrRpcStore(() => Promise.resolve(reply))
      await assertRejects(
        () => store.start(crypto.randomUUID(), crypto.randomUUID()),
        Error,
        'CEFR persistence failed'
      )
    }
  }
)

Deno.test(
  'RPC timeout and parent cancellation abort adapters even if they ignore cancellation',
  async () => {
    let signal: AbortSignal | undefined
    const store = createCefrRpcStore((_name, _args, current) => {
      signal = current
      return new Promise(() => {})
    }, 5)
    await assertRejects(
      () => store.start(crypto.randomUUID(), crypto.randomUUID()),
      Error,
      'CEFR persistence failed'
    )
    assertEquals(signal?.aborted, true)
    const fixture = await syntheticWorker()
    const job = {
      ...fixture.job,
      reservation_id: crypto.randomUUID(),
      reservation_utc_day: new Date().toISOString().slice(0, 10),
    }
    const controller = new AbortController()
    const long = createCefrRpcStore((_name, _args, current) => {
      signal = current
      return new Promise(() => {})
    })
    const pending = long.authorize(job, controller.signal)
    controller.abort()
    await assertRejects(() => pending, Error, 'CEFR persistence failed')
    assertEquals(signal?.aborted, true)
  }
)
