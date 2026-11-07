import assert from 'node:assert/strict'
import { createGeminiTransport } from './geminiTransport.ts'
import { type PreparedGeminiRequest, sha256 } from './protectedInput.ts'
import {
  logProviderObservation,
  type ProviderObservation,
  type TransportReason,
} from './providerObservation.ts'

const secret = 'private-key-prompt-response-and-exception'
const attempt = `synthetic-invocation:${secret}`
const request: PreparedGeminiRequest = {
  model: 'gemini-fixture',
  body: JSON.stringify({ contents: secret }),
  input_sha256: 'a'.repeat(64),
}

const cases: {
  name: string
  response: () => Response
  status: number
  reason: TransportReason
  outcome: ProviderObservation['outcome']
  googleStatus?: string
}[] = [
  {
    name: 'complete envelope',
    response: () => Response.json({ responseId: secret, content: secret }),
    status: 200,
    reason: 'response-received',
    outcome: 'returned',
  },
  {
    name: 'malformed JSON still returns for durable rejection',
    response: () => new Response(secret),
    status: 200,
    reason: 'response-received',
    outcome: 'returned',
  },
  {
    name: 'explicit client rejection',
    response: () =>
      Response.json(
        { error: { status: 'INVALID_ARGUMENT', message: secret } },
        { status: 400 }
      ),
    status: 400,
    reason: 'http-error',
    outcome: 'provider-failed',
    googleStatus: 'INVALID_ARGUMENT',
  },
  {
    name: 'server error stays uncertain',
    response: () =>
      Response.json(
        { error: { status: 'UNAVAILABLE', message: secret } },
        {
          status: 503,
        }
      ),
    status: 503,
    reason: 'http-error',
    outcome: 'provider-outcome-unknown',
    googleStatus: 'UNAVAILABLE',
  },
  {
    name: 'unrecognized provider status',
    response: () =>
      Response.json(
        { error: { status: secret, message: secret } },
        {
          status: 408,
        }
      ),
    status: 408,
    reason: 'http-error',
    outcome: 'provider-outcome-unknown',
  },
  {
    name: 'missing body',
    response: () => new Response(null, { status: 204 }),
    status: 204,
    reason: 'missing-response-body',
    outcome: 'provider-outcome-unknown',
  },
  ...[200, 503].map(status => ({
    name: `oversized body at HTTP ${status}`,
    response: () => new Response(secret.repeat(1000), { status }),
    status,
    reason: 'response-too-large' as const,
    outcome: 'provider-outcome-unknown' as const,
  })),
  {
    name: 'body stream failure',
    response: () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error(secret))
          },
        })
      ),
    status: 200,
    reason: 'response-read-failed',
    outcome: 'provider-outcome-unknown',
  },
  {
    name: 'invalid UTF-8',
    response: () => new Response(new Uint8Array([0xff])),
    status: 200,
    reason: 'response-decode-failed',
    outcome: 'provider-outcome-unknown',
  },
]

for (const item of cases) {
  Deno.test(`operator observation: ${item.name}`, async () => {
    const observations: ProviderObservation[] = []
    let calls = 0
    const transport = createGeminiTransport({
      apiKey: secret,
      fetch: () => {
        calls++
        return Promise.resolve(item.response())
      },
      observe: event => observations.push(event),
    })
    const result = await transport.invoke(request, attempt)
    assert.equal(result.kind, item.outcome)
    assert.equal(calls, 1)
    assert.equal(observations.length, 1)
    const event = observations[0]
    assert.deepEqual(
      { ...event, elapsed_ms: 0 },
      {
        attempt_sha256: await sha256(attempt),
        outcome: item.outcome,
        reason: item.reason,
        http_status: item.status,
        google_status: item.googleStatus ?? null,
        elapsed_ms: 0,
      }
    )
    assert.ok(Number.isSafeInteger(event.elapsed_ms) && event.elapsed_ms >= 0)
    assert.equal(JSON.stringify(event).includes(secret), false)
    assert.equal('attempt_sha256' in result, false)
    assert.equal('reason' in result, false)
  })
}

for (const mode of ['network', 'fetch-timeout', 'body-timeout'] as const) {
  Deno.test(
    `operator observation distinguishes ${mode} without logging errors or retrying`,
    async () => {
      const observations: ProviderObservation[] = []
      let calls = 0
      const transport = createGeminiTransport({
        apiKey: secret,
        timeoutMs: 5,
        fetch: (_url, init) => {
          calls++
          if (mode === 'network') return Promise.reject(new Error(secret))
          if (mode === 'body-timeout') {
            return Promise.resolve(
              new Response(
                new ReadableStream({
                  start(controller) {
                    init?.signal?.addEventListener(
                      'abort',
                      () => controller.error(new Error(secret)),
                      { once: true }
                    )
                  },
                })
              )
            )
          }
          return new Promise((_resolve, reject) =>
            init?.signal?.addEventListener(
              'abort',
              () => reject(new Error(secret)),
              { once: true }
            )
          )
        },
        observe: event => observations.push(event),
      })
      assert.deepEqual(await transport.invoke(request, attempt), {
        kind: 'provider-outcome-unknown',
        evidence_sha256: null,
      })
      assert.equal(calls, 1)
      assert.equal(observations.length, 1)
      assert.equal(
        observations[0].reason,
        mode === 'network' ? 'fetch-failed' : 'timeout'
      )
      assert.equal(
        observations[0].http_status,
        mode === 'body-timeout' ? 200 : null
      )
      assert.equal(JSON.stringify(observations).includes(secret), false)
    }
  )
}

Deno.test(
  'observer failure cannot replace a result or retry a paid request',
  async () => {
    for (const status of [200, 400, 503]) {
      let calls = 0
      const transport = createGeminiTransport({
        apiKey: secret,
        fetch: () => {
          calls++
          return Promise.resolve(new Response('{}', { status }))
        },
        observe: () => {
          throw new Error(secret)
        },
      })
      const result = await transport.invoke(request, attempt)
      assert.equal(
        result.kind,
        status === 200
          ? 'returned'
          : status === 400
            ? 'provider-failed'
            : 'provider-outcome-unknown'
      )
      assert.equal(calls, 1)
    }
  }
)

Deno.test(
  'operator log uses only an explicit projection and never passes an object to console',
  async () => {
    const lines: unknown[][] = []
    const original = console.info
    console.info = (...args: unknown[]) => {
      lines.push(args)
    }
    try {
      for (const workflow of ['analysis', 'creation'] as const) {
        logProviderObservation(workflow, {
          attempt_sha256: await sha256(attempt),
          outcome: 'provider-outcome-unknown',
          reason: 'timeout',
          http_status: null,
          google_status: null,
          elapsed_ms: 60000,
          ...{ unexpected: secret },
        })
      }
    } finally {
      console.info = original
    }
    assert.equal(lines.length, 2)
    for (const [line] of lines) {
      assert.equal(typeof line, 'string')
      assert.equal(String(line).includes(secret), false)
      assert.ok(String(line).length < 1000)
      assert.equal(
        JSON.parse(String(line)).event,
        'dictionary-provider-transport-v1'
      )
    }
  }
)
