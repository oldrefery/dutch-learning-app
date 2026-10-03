import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadDiagnosticBundle } from './diagnostic-bundle.ts'
import { runDiagnostic } from './diagnostic.ts'
import { probeGeminiControls } from './diagnostic-controls.ts'
import {
  openRun,
  claimLease,
  releaseLease,
  reserveControl,
  captureControl,
} from './diagnostic-store.ts'
import {
  createGeminiTestAdapter,
  prepareGeminiRequest,
  parseGeminiGeneration,
  GEMINI_BASE,
  GEMINI_MODEL,
  type TestHttp,
} from './diagnostic-gemini.ts'
const evidence = 'docs/tasks/shared-dictionary-cefr/evidence/'
const bundle = loadDiagnosticBundle({
  worklist: `${evidence}D11-pilot-review-worklist.json`,
  reference: `${evidence}D11-pilot-provisional-reference.json`,
  profile: `${evidence}D11-pilot-profile.proposed.json`,
  prompt: `${evidence}D11-pilot-prompt.txt`,
  proposal: `${evidence}D11-pilot-proposal-summary.json`,
})
const runId = '11111111-1111-4111-8111-111111111111'
const request = prepareGeminiRequest(bundle, 'pilot-01', runId)
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
const metadata = () => ({
  name: `models/${GEMINI_MODEL}`,
  baseModelId: GEMINI_MODEL,
  version: '3.5',
  inputTokenLimit: 1_000_000,
  outputTokenLimit: 65536,
  thinking: true,
  supportedGenerationMethods: ['generateContent', 'countTokens'],
})
const generation = () => ({
  responseId: 'fake-response-01',
  modelVersion: GEMINI_MODEL,
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [{ text: '{"candidate":{"level":"A1","confidence":0.5}}' }],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 20,
    thoughtsTokenCount: 10,
    totalTokenCount: 130,
    serviceTier: 'standard',
  },
})
const adapter = (http: TestHttp, timeoutMs = 5000) =>
  createGeminiTestAdapter({ mode: 'test-only', http, timeoutMs })
const temporary = async (work: (runDir: string) => Promise<void>) => {
  const root = mkdtempSync(join(tmpdir(), 'd11-gemini-test-'))
  try {
    await work(join(root, 'run'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('countTokens receives the exact full generation body and no reference data', async () => {
  const sent: { url: string; body: unknown }[] = []
  const client = adapter(async (url, init) => {
    assert.equal(init.redirect, 'error')
    assert.equal(
      (init.headers as Record<string, string>)['x-goog-api-key'],
      'TEST-ONLY-NOT-A-CREDENTIAL'
    )
    assert.equal(new URL(url).search, '')
    sent.push({ url, body: JSON.parse(String(init.body)) as unknown })
    return json(
      url.endsWith(':countTokens') ? { totalTokens: 100 } : generation()
    )
  })
  assert.equal(await client.countTokens(request), 100)
  const result = await client.generate(request, null)
  assert.equal(result.kind, 'response')
  assert.deepEqual(
    (sent[0].body as { generateContentRequest: unknown })
      .generateContentRequest,
    sent[1].body
  )
  const raw = JSON.parse(request.body) as Record<string, unknown>
  assert.equal(raw.serviceTier, 'standard')
  assert.equal(raw.store, false)
  for (const field of ['reference', 'split', 'slices', 'expected_levels'])
    assert.equal(request.body.includes(`"${field}"`), false)
  assert.equal(
    prepareGeminiRequest(bundle, 'pilot-01', runId).sha256,
    request.sha256
  )
  assert.equal(sent[0].url, `${GEMINI_BASE}:countTokens`)
})

test('unvalidated requests, bundles and unsupported activation cannot dispatch', async () => {
  let calls = 0
  const client = adapter(async () => {
    calls++
    return json({ totalTokens: 100 })
  })
  await assert.rejects(client.countTokens({ ...request }), /unprepared_request/)
  assert.throws(
    () => prepareGeminiRequest({ ...bundle }, 'pilot-01', runId),
    /unvalidated_bundle/
  )
  assert.throws(
    () =>
      createGeminiTestAdapter({
        mode: 'live' as 'test-only',
        http: async () => json({}),
      }),
    /test_http_required/
  )
  assert.equal(calls, 0)
})

test('usage separates answer and thinking and verifies the sum', () => {
  const reply = parseGeminiGeneration(generation(), GEMINI_MODEL)
  assert.equal(reply.kind, 'response')
  if (reply.kind !== 'response') assert.fail()
  assert.deepEqual(reply.usage, {
    input_tokens: 100,
    output_tokens: 20,
    reasoning_tokens: 10,
  })
  const raw = generation()
  delete (raw.usageMetadata as Partial<typeof raw.usageMetadata>)
    .thoughtsTokenCount
  raw.usageMetadata.totalTokenCount = 120
  const omittedZero = parseGeminiGeneration(raw, null)
  assert.equal(
    omittedZero.kind === 'response' && omittedZero.usage?.reasoning_tokens,
    0
  )
})

for (const [name, mutate] of [
  [
    'usage sum',
    (raw: ReturnType<typeof generation>) => {
      raw.usageMetadata.totalTokenCount++
    },
  ],
  [
    'combined output bound',
    (raw: ReturnType<typeof generation>) => {
      Object.assign(raw.usageMetadata, {
        candidatesTokenCount: 2000,
        thoughtsTokenCount: 100,
        totalTokenCount: 2200,
      })
    },
  ],
  [
    'price tier',
    (raw: ReturnType<typeof generation>) => {
      raw.usageMetadata.serviceTier = 'priority'
    },
  ],
  [
    'missing tier',
    (raw: ReturnType<typeof generation>) => {
      delete (raw.usageMetadata as Partial<typeof raw.usageMetadata>)
        .serviceTier
    },
  ],
  [
    'model family',
    (raw: ReturnType<typeof generation>) => {
      raw.modelVersion = 'gemini-3.8-flash'
    },
  ],
  [
    'input cap',
    (raw: ReturnType<typeof generation>) => {
      raw.usageMetadata.promptTokenCount = 2001
    },
  ],
] as const) {
  test(`invalid ${name} is a receipt error rather than a retriable answer`, async () => {
    const raw = generation()
    mutate(raw)
    const client = adapter(async () => json(raw))
    assert.deepEqual(await client.generate(request, null), {
      kind: 'receipt_error',
    })
  })
}

test('resolved model version must remain exact and is not metadata.version', () => {
  assert.throws(
    () => parseGeminiGeneration(generation(), '3.5'),
    /model_version_changed/
  )
  const raw = generation()
  raw.modelVersion = `${GEMINI_MODEL}-002`
  assert.throws(
    () => parseGeminiGeneration(raw, `${GEMINI_MODEL}-001`),
    /model_version_changed/
  )
})

test('malformed, blocked, incomplete and oversized candidate retain verified receipts', () => {
  for (const candidates of [
    [],
    [null],
    [{ finishReason: 'MAX_TOKENS' }],
    [
      {
        finishReason: 'STOP',
        content: { parts: [{ functionCall: { name: 'unexpected' } }] },
      },
    ],
    [
      {
        finishReason: 'STOP',
        content: { parts: [{ text: 'x'.repeat(5000) }] },
      },
    ],
  ]) {
    const reply = parseGeminiGeneration({ ...generation(), candidates }, null)
    assert.equal(reply.kind, 'response')
    if (reply.kind !== 'response') assert.fail()
    assert.equal(reply.response_id, 'fake-response-01')
    assert.equal(reply.usage?.reasoning_tokens, 10)
  }
})

test('HTTP failures dispatch once and never expose a provider body', async () => {
  for (const status of [401, 429, 503]) {
    let calls = 0
    const client = adapter(async () => {
      calls++
      return new Response('SECRET-BODY', { status })
    })
    assert.deepEqual(await client.generate(request, null), {
      kind: 'http_error',
      status,
    })
    assert.equal(calls, 1)
  }
})

test('stream byte bound cancels oversized responses before full buffering', async () => {
  let cancelled = false,
    pulls = 0
  const client = adapter(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            pulls++
            controller.enqueue(new Uint8Array(9000))
          },
          cancel() {
            cancelled = true
          },
        }),
        { headers: { 'content-type': 'application/json' } }
      )
  )
  await assert.rejects(
    client.countTokens(request),
    /transport or envelope rejected/
  )
  assert.equal(cancelled, true)
  assert.ok(pulls <= 3)
})

test('unexpected redirects, content types and malformed UTF-8 fail closed', async () => {
  const redirect = json({ totalTokens: 100 })
  Object.defineProperty(redirect, 'redirected', { value: true })
  for (const response of [
    redirect,
    new Response('100'),
    new Response(new Uint8Array([255]), {
      headers: { 'content-type': 'application/json' },
    }),
  ]) {
    await assert.rejects(
      adapter(async () => response).countTokens(request),
      /rejected/
    )
  }
})

test('token counting timeout aborts even a test transport that never resolves', async () => {
  let signal: AbortSignal | null = null,
    calls = 0
  const client = adapter(async (_, init) => {
    signal = init.signal as AbortSignal
    calls++
    return new Promise<Response>(() => {})
  }, 5)
  await assert.rejects(client.countTokens(request), /rejected/)
  assert.equal((signal as AbortSignal | null)?.aborted, true)
  assert.equal(calls, 1)
})

test('durable preflight uses 24 counts and one model read; resume sends nothing', async () =>
  temporary(async runDir => {
    let calls = 0
    const client = adapter(async url => {
      calls++
      return json(url === GEMINI_BASE ? metadata() : { totalTokens: 100 })
    })
    const first = await probeGeminiControls({ runDir, bundle, adapter: client })
    const second = await probeGeminiControls({
      runDir,
      bundle,
      adapter: client,
    })
    assert.deepEqual(second, first)
    assert.equal(calls, 25)
    assert.equal(Object.keys(first.tokens).length, 24)
    assert.equal(first.liveReady, false)
    assert.equal(first.billingVerified, false)
  }))

test('crash before control dispatch leaves a reservation and prevents replay', async () =>
  temporary(async runDir => {
    let calls = 0
    const client = adapter(async () => {
      calls++
      return json(metadata())
    })
    await assert.rejects(
      probeGeminiControls({
        runDir,
        bundle,
        adapter: client,
        onReserved: () => {
          throw new Error('injected crash')
        },
      }),
      /injected crash/
    )
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /control_outcome_unknown/
    )
    assert.equal(calls, 0)
  }))

test('failed control is not retried after restart', async () =>
  temporary(async runDir => {
    let calls = 0
    const client = adapter(async url => {
      calls++
      return url === GEMINI_BASE ? json(metadata()) : json({}, 429)
    })
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /HTTP failure/
    )
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /control_outcome_unknown/
    )
    assert.equal(calls, 2)
  }))

test('UTC rollover captures the control receipt and stops before next dispatch', async () =>
  temporary(async runDir => {
    let now = new Date('2026-10-03T23:59:59Z'),
      calls = 0
    const client = adapter(async () => {
      calls++
      now = new Date('2026-10-04T00:00:00Z')
      return json(metadata())
    })
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client, now: () => now }),
      /Control day changed/
    )
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client, now: () => now }),
      /resume_binding_or_day/
    )
    assert.equal(calls, 1)
  }))

test('fake collector cannot accept the Gemini test adapter as a generation transport', async () =>
  temporary(async runDir => {
    const client = adapter(async () => json(generation()))
    // Runtime guard is intentional; the compile-time contract also excludes this adapter.
    await assert.rejects(
      runDiagnostic({
        runDir,
        bundle,
        transport: client as unknown as Parameters<
          typeof runDiagnostic
        >[0]['transport'],
      }),
      /only_fake_transport_available/
    )
  }))

test('control reservations bind the entire request and capture is immutable', async () =>
  temporary(async runDir => {
    const now = new Date(),
      db = openRun(runDir, bundle, now),
      owner = 'test-owner'
    const key = {
      id: 'pilot-01',
      kind: 'count_tokens' as const,
      requestSha256: request.sha256,
    }
    try {
      claimLease(db, owner)
      assert.equal(reserveControl(db, bundle, key, owner, now), null)
      captureControl(db, key, '100', owner)
      assert.equal(reserveControl(db, bundle, key, owner, now), '100')
      assert.throws(
        () =>
          reserveControl(
            db,
            bundle,
            { ...key, requestSha256: '0'.repeat(64) },
            owner,
            now
          ),
        /control_request_changed/
      )
      assert.throws(
        () => captureControl(db, key, '101', owner),
        /control_capture_conflict/
      )
      assert.throws(
        () =>
          reserveControl(
            db,
            bundle,
            { ...key, id: 'not-in-worklist' },
            owner,
            now
          ),
        /invalid_control_key/
      )
    } finally {
      releaseLease(db, owner)
      db.close()
    }
  }))

test('overlapping control probes cannot dispatch against one run', async () =>
  temporary(async runDir => {
    let unblock: (response: Response) => void = () => assert.fail('not waiting')
    let entered: () => void = () => assert.fail('not initialized')
    const ready = new Promise<void>(resolve => {
      entered = resolve
    })
    let calls = 0
    const client = adapter(async url => {
      calls++
      if (url !== GEMINI_BASE) return json({ totalTokens: 100 })
      entered()
      return new Promise<Response>(resolve => {
        unblock = resolve
      })
    })
    const first = probeGeminiControls({ runDir, bundle, adapter: client })
    await ready
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /run_already_active/
    )
    assert.equal(calls, 1)
    unblock(json(metadata()))
    await first
    assert.equal(calls, 25)
  }))

test('metadata rejection and invalid bundles stop before any token counting', async () =>
  temporary(async runDir => {
    let calls = 0
    const client = adapter(async () => {
      calls++
      return json({ ...metadata(), baseModelId: 'wrong-model' })
    })
    await assert.rejects(
      probeGeminiControls({ runDir, bundle: { ...bundle }, adapter: client }),
      /Prepared bundle required/
    )
    assert.equal(calls, 0)
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /model_metadata_mismatch/
    )
    assert.equal(calls, 1)
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /control_outcome_unknown/
    )
    assert.equal(calls, 1)
  }))

test('live draft binds the frozen pilot but has no approval or total cost claim', () => {
  const draft = JSON.parse(
    readFileSync(`${evidence}D11-gemini-live-request.proposed.json`, 'utf8')
  ) as {
    approved: boolean
    live_ready: boolean
    artifact_binding: { bundle_sha256: string; profile_sha256: string }
    inputs: { item_id: string; input_sha256: string }[]
    wire_template: { example_body_sha256: string }
    budget: {
      generation_reservation_microusd: number
      total_cost_max_microusd: null
      control_billing_verified: boolean
    }
    provider: { account_ref: null }
    authorization: { approval_ref: null }
    implementation: { live_cli_available: boolean }
  }
  assert.equal(draft.approved, false)
  assert.equal(draft.live_ready, false)
  assert.equal(draft.artifact_binding.bundle_sha256, bundle.bindingSha256)
  assert.equal(draft.artifact_binding.profile_sha256, bundle.profileSha256)
  assert.deepEqual(
    draft.inputs.map((item: { item_id: string; input_sha256: string }) => [
      item.item_id,
      item.input_sha256,
    ]),
    bundle.meanings.map(item => [item.id, item.inputHash])
  )
  assert.equal(draft.wire_template.example_body_sha256, request.sha256)
  assert.equal(
    draft.budget.generation_reservation_microusd,
    bundle.maxRequests * bundle.costPerAttempt
  )
  assert.equal(draft.budget.total_cost_max_microusd, null)
  assert.equal(draft.budget.control_billing_verified, false)
  assert.equal(draft.provider.account_ref, null)
  assert.equal(draft.authorization.approval_ref, null)
  assert.equal(draft.implementation.live_cli_available, false)
})

test('over-limit countTokens leaves an unknown control and stops before generation', async () =>
  temporary(async runDir => {
    let calls = 0
    const client = adapter(async url => {
      calls++
      return json(url === GEMINI_BASE ? metadata() : { totalTokens: 2001 })
    })
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /token_bound/
    )
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter: client }),
      /control_outcome_unknown/
    )
    assert.equal(calls, 2)
  }))
