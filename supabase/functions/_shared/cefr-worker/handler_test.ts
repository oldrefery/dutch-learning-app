import { assertEquals } from '@std/assert'
import {
  createCefrWorkerHandler,
  type CefrWorkerConfiguration,
  type CefrWorkerStore,
  type ReservedCefrJob,
} from './handler.ts'
import { type CefrAttemptResult, type CefrProvider } from './evaluate.ts'
import { syntheticWorker } from './synthetic-fixtures.ts'

const SECRET = 'TEST_ONLY_' + 'a'.repeat(54)
const URL = 'https://example.invalid/cefr-worker'
const request = (options: RequestInit = {}) =>
  new Request(URL, {
    method: 'POST',
    headers: { 'x-cefr-worker-secret': SECRET },
    ...options,
  })
const setup = async () => {
  const fixture = await syntheticWorker()
  const job: ReservedCefrJob = {
    ...fixture.job,
    reservation_id: crypto.randomUUID(),
    reservation_utc_day: new Date().toISOString().slice(0, 10),
  }
  const events: string[] = [],
    results: CefrAttemptResult[] = []
  const config: CefrWorkerConfiguration = {
    enabled: true,
    workerSecret: SECRET,
    policyId: crypto.randomUUID(),
    profile: fixture.inputs.profile,
    qualification: fixture.qualified,
    timeoutMs: 100,
  }
  const store: CefrWorkerStore = {
    start: (_policy, runId) => {
      events.push('start')
      return Promise.resolve({ status: 'running', run_id: runId, jobs: [job] })
    },
    authorize: () => {
      events.push('authorize')
      return Promise.resolve({ allowed: true })
    },
    finish: (_job, result) => {
      events.push('finish')
      results.push(result)
      return Promise.resolve({ status: 'completed' })
    },
    summarize: runId => {
      events.push('summary')
      return Promise.resolve({ run_id: runId, completed: results.length })
    },
  }
  const provider: CefrProvider = r => {
    events.push('provider')
    return {
      kind: 'response',
      body: JSON.stringify({
        job_id: r.job_id,
        input_sha256: r.input_sha256,
        profile_sha256: r.profile_sha256,
        candidate: { level: 'A2', confidence: 0.9 },
      }),
    }
  }
  return { fixture, job, events, results, config, store, provider }
}

Deno.test(
  'public keys, ordinary JWTs, missing and wrong credentials make zero privileged calls',
  async () => {
    const x = await setup(),
      handler = await createCefrWorkerHandler(x.config, x)
    const credentials: HeadersInit[] = [
      {},
      { apikey: SECRET },
      { authorization: 'Bearer ordinary-user-jwt' },
      { 'x-cefr-worker-secret': 'wrong' },
      { 'x-cefr-worker-secret': 'x'.repeat(201) },
    ]
    for (const headers of credentials) {
      const reply = await handler(request({ headers }))
      assertEquals(reply.status, 403)
      assertEquals(await reply.json(), { status: 'forbidden' })
    }
    assertEquals(x.events, [])
  }
)

Deno.test(
  'default disabled and missing server configuration do not claim or call the provider',
  async () => {
    const x = await setup()
    for (const patch of [
      { enabled: undefined },
      { enabled: false },
      { workerSecret: undefined },
      { workerSecret: 'short' },
    ]) {
      const handler = await createCefrWorkerHandler(
        { ...x.config, ...patch },
        x
      )
      const reply = await handler(request())
      assertEquals(
        reply.status,
        patch.workerSecret !== undefined || Object.hasOwn(patch, 'workerSecret')
          ? 503
          : 200
      )
    }
    assertEquals(x.events, [])
  }
)

Deno.test(
  'request method, body and query cannot choose profile, budget or provider',
  async () => {
    const x = await setup(),
      handler = await createCefrWorkerHandler(x.config, x)
    assertEquals((await handler(request({ method: 'GET' }))).status, 405)
    assertEquals(
      (
        await handler(
          request({
            body: JSON.stringify({
              policyId: crypto.randomUUID(),
              provider: 'forged',
            }),
          })
        )
      ).status,
      400
    )
    assertEquals(
      (
        await handler(
          new Request(URL + '?policyId=forged', {
            method: 'POST',
            headers: { 'x-cefr-worker-secret': SECRET },
          })
        )
      ).status,
      400
    )
    assertEquals(x.events, [])
  }
)

Deno.test(
  'fabricated qualification, changed profile and invalid timeout fail before reservation',
  async () => {
    const x = await setup()
    for (const patch of [
      { qualification: null },
      { qualification: { ...x.config.qualification! } },
      { timeoutMs: 0 },
      { timeoutMs: 5001 },
      { profile: { ...x.fixture.inputs.profile, prompt_revision: 'changed' } },
      { policyId: 'invalid' },
    ]) {
      const handler = await createCefrWorkerHandler(
        { ...x.config, ...patch },
        x
      )
      assertEquals((await handler(request())).status, 503)
    }
    assertEquals(x.events, [])
  }
)

Deno.test(
  'successful dispatch orders reservation, permission, provider and fenced persistence',
  async () => {
    const x = await setup(),
      handler = await createCefrWorkerHandler(x.config, x)
    const reply = await handler(request())
    assertEquals(reply.status, 200)
    assertEquals((await reply.json()).summary.completed, 1)
    assertEquals(x.events, [
      'start',
      'authorize',
      'provider',
      'finish',
      'summary',
    ])
    assertEquals(x.results, [
      { outcome: 'estimated', level: 'A2', confidence: 0.9 },
    ])
    assertEquals(reply.headers.get('cache-control'), 'no-store')
  }
)

Deno.test(
  'empty and budget/kill-switch stopped runs make zero provider calls',
  async () => {
    for (const status of [
      'no_work',
      'budget_stop',
      'disabled',
      'unqualified',
      'day_changed',
      'duplicate_run',
    ]) {
      const x = await setup()
      x.store.start = (_policy, runId) =>
        Promise.resolve({ status, run_id: runId, jobs: [] })
      const handler = await createCefrWorkerHandler(x.config, x)
      assertEquals((await (await handler(request())).json()).status, status)
      assertEquals(x.events, ['summary'])
    }
  }
)

Deno.test(
  'malformed, duplicated and misbound reserved jobs never reach the provider',
  async () => {
    const x = await setup()
    for (const jobs of [
      [{ ...x.job, reservation_id: 'invalid' }],
      [{ ...x.job, profile_sha256: 'a'.repeat(64) }],
      [{ ...x.job, qualification_sha256: 'a'.repeat(64) }],
      [x.job, x.job],
      Array(9).fill(x.job),
    ]) {
      x.store.start = (_policy, runId) =>
        Promise.resolve({ status: 'running', run_id: runId, jobs })
      const handler = await createCefrWorkerHandler(x.config, x)
      assertEquals((await handler(request())).status, 503)
    }
    assertEquals(x.events, [])
  }
)

Deno.test(
  'dispatch permission denial or a changed UTC day never calls the provider',
  async () => {
    for (const oldDay of [false, true]) {
      const x = await setup()
      if (oldDay) x.job.reservation_utc_day = '2000-01-01'
      else x.store.authorize = () => Promise.resolve({ allowed: false })
      const handler = await createCefrWorkerHandler(x.config, x)
      assertEquals((await handler(request())).status, 200)
      assertEquals(x.events.includes('provider'), false)
      assertEquals(x.results[0].outcome, 'retry')
    }
  }
)

Deno.test(
  'timeout during dispatch authorization prevents a late provider call',
  async () => {
    const x = await setup()
    x.config.timeoutMs = 5
    let release: ((value: { allowed: boolean }) => void) | undefined
    x.store.authorize = () =>
      new Promise(resolve => {
        release = resolve
      })
    const handler = await createCefrWorkerHandler(x.config, x)
    const reply = await handler(request())
    assertEquals(reply.status, 200)
    assertEquals(x.results, [{ outcome: 'retry', reason: 'timeout' }])
    release?.({ allowed: true })
    await new Promise<void>(resolve => queueMicrotask(resolve))
    assertEquals(x.events.includes('provider'), false)
  }
)

Deno.test(
  'partial persistence failure settles other leases and hides raw errors',
  async () => {
    const x = await setup()
    const second = {
      ...x.job,
      job_id: crypto.randomUUID(),
      reservation_id: crypto.randomUUID(),
    }
    x.store.start = (_policy, runId) =>
      Promise.resolve({
        status: 'running',
        run_id: runId,
        jobs: [x.job, second],
      })
    x.store.finish = (job, result) => {
      if (job.job_id === x.job.job_id)
        return Promise.reject(new Error('private provider body ' + SECRET))
      x.results.push(result)
      return Promise.resolve({ status: 'completed' })
    }
    const handler = await createCefrWorkerHandler(x.config, x)
    const reply = await handler(request())
    assertEquals(reply.status, 503)
    assertEquals(x.results.length, 1)
    assertEquals((await reply.text()).includes(SECRET), false)
  }
)

Deno.test(
  'caller configuration mutation cannot change a captured server profile',
  async () => {
    const x = await setup()
    x.job.profile = structuredClone(x.job.profile)
    const handler = await createCefrWorkerHandler(x.config, x)
    x.config.enabled = false
    x.fixture.inputs.profile.prompt_revision = 'changed-by-caller'
    assertEquals((await handler(request())).status, 200)
    assertEquals(x.events.includes('provider'), true)
  }
)

Deno.test(
  'only separate transport usage is forwarded; model-generated billing fields are ignored',
  async () => {
    const x = await setup()
    const receipt = {
      provider_request_id: 'TEST-ONLY-request',
      input_tokens: 10,
      output_tokens: 5,
      reasoning_tokens: 0,
    }
    x.provider = r => ({
      kind: 'response',
      body: JSON.stringify({
        job_id: r.job_id,
        input_sha256: r.input_sha256,
        profile_sha256: r.profile_sha256,
        candidate: { level: 'A2', confidence: 0.9 },
        usage: { input_tokens: 0 },
      }),
      usage: receipt,
    })
    const handler = await createCefrWorkerHandler(x.config, x)
    await handler(request())
    assertEquals(x.results[0].usage, receipt)
  }
)
