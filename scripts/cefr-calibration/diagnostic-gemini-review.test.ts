import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { loadDiagnosticBundle } from './diagnostic-bundle.ts'
import { probeGeminiControls } from './diagnostic-controls.ts'
import {
  createGeminiTestAdapter,
  GEMINI_MODEL,
  parseGeminiGeneration,
  prepareGeminiRequest,
} from './diagnostic-gemini.ts'
import { openRun } from './diagnostic-store.ts'

const evidence = 'docs/tasks/shared-dictionary-cefr/evidence/'
const paths = {
  worklist: `${evidence}D11-pilot-review-worklist.json`,
  reference: `${evidence}D11-pilot-provisional-reference.json`,
  profile: `${evidence}D11-pilot-profile.proposed.json`,
  prompt: `${evidence}D11-pilot-prompt.txt`,
  proposal: `${evidence}D11-pilot-proposal-summary.json`,
}
const bundle = loadDiagnosticBundle(paths)
const request = prepareGeminiRequest(
  bundle,
  'pilot-01',
  '11111111-1111-4111-8111-111111111111'
)
const metadata = () => ({
  name: `models/${GEMINI_MODEL}`,
  baseModelId: GEMINI_MODEL,
  version: '3.5',
  inputTokenLimit: 1_000_000,
  outputTokenLimit: 65536,
  thinking: true,
  supportedGenerationMethods: ['generateContent', 'countTokens'],
})
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  })
const temporary = async (work: (root: string) => Promise<void>) => {
  const root = mkdtempSync(join(tmpdir(), 'd11-gemini-review-'))
  try {
    await work(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
const stalledBody = () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true
    },
  })
  return { body, cancelled: () => cancelled }
}

test('review: timeout cancels an already received stalled response body', async () => {
  const stream = stalledBody()
  const response = new Response(stream.body, {
    headers: { 'content-type': 'application/json' },
  })
  const client = createGeminiTestAdapter({
    mode: 'test-only',
    timeoutMs: 5,
    http: async () => response,
  })
  await assert.rejects(client.countTokens(request), /rejected/)
  assert.equal(stream.cancelled(), true)
  assert.equal(response.body?.locked, false)
})

test('review: a response arriving after timeout is cancelled without reading', async () => {
  const stream = stalledBody()
  const response = new Response(stream.body, {
    headers: { 'content-type': 'application/json' },
  })
  let finish: (response: Response) => void = () => assert.fail('not started')
  const client = createGeminiTestAdapter({
    mode: 'test-only',
    timeoutMs: 5,
    http: async () =>
      new Promise<Response>(resolve => {
        finish = resolve
      }),
  })
  await assert.rejects(client.countTokens(request), /rejected/)
  finish(response)
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(stream.cancelled(), true)
  assert.equal(response.body?.locked, false)
})

for (const reason of ['content_type', 'redirect'] as const) {
  test(`review: ${reason} rejection releases the unread body`, async () => {
    const stream = stalledBody()
    const response = new Response(stream.body, {
      headers: {
        'content-type':
          reason === 'content_type' ? 'text/plain' : 'application/json',
      },
    })
    if (reason === 'redirect')
      Object.defineProperty(response, 'redirected', { value: true })
    const client = createGeminiTestAdapter({
      mode: 'test-only',
      http: async () => response,
    })
    await assert.rejects(client.countTokens(request), /rejected/)
    assert.equal(stream.cancelled(), true)
  })
}

for (const [reason, response] of [
  [
    'malformed JSON',
    () =>
      new Response('{', { headers: { 'content-type': 'application/json' } }),
  ],
  ['oversized envelope', () => json('x'.repeat(17000))],
  [
    'malformed UTF-8',
    () =>
      new Response(new Uint8Array([255]), {
        headers: { 'content-type': 'application/json' },
      }),
  ],
  [
    'unsupported media type',
    () =>
      new Response(
        JSON.stringify({
          responseId: 'test',
          modelVersion: GEMINI_MODEL,
          usageMetadata: {
            promptTokenCount: 100,
            totalTokenCount: 100,
            serviceTier: 'standard',
          },
          candidates: [],
        }),
        { headers: { 'content-type': 'application/jsonp' } }
      ),
  ],
] as const) {
  test(`review: ${reason} is a receipt stop, not a transport retry`, async () => {
    const client = createGeminiTestAdapter({
      mode: 'test-only',
      http: async () => response(),
    })
    assert.deepEqual(await client.generate(request, null), {
      kind: 'receipt_error',
    })
  })
}

test('review: a real read failure remains a transport error', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error('private network detail'))
    },
  })
  const client = createGeminiTestAdapter({
    mode: 'test-only',
    http: async () =>
      new Response(body, { headers: { 'content-type': 'application/json' } }),
  })
  assert.deepEqual(await client.generate(request, null), {
    kind: 'transport_error',
  })
})

test('review: an unsupported prepared profile fails before metadata reservation or HTTP', async () =>
  temporary(async root => {
    const profile = JSON.parse(readFileSync(paths.profile, 'utf8')) as Record<
      string,
      unknown
    >
    profile.requested_model = 'gemini-unsupported'
    const proposal = JSON.parse(readFileSync(paths.proposal, 'utf8')) as Record<
      string,
      unknown
    >
    proposal.profile_sha256 = createHash('sha256')
      .update(canonicalizeJson(profile))
      .digest('hex')
    const profilePath = join(root, 'profile.json'),
      proposalPath = join(root, 'proposal.json')
    writeFileSync(profilePath, JSON.stringify(profile))
    writeFileSync(proposalPath, JSON.stringify(proposal))
    const different = loadDiagnosticBundle({
      ...paths,
      profile: profilePath,
      proposal: proposalPath,
    })
    let calls = 0
    const adapter = createGeminiTestAdapter({
      mode: 'test-only',
      http: async () => {
        calls++
        return json(metadata())
      },
    })
    const runDir = join(root, 'run')
    await assert.rejects(
      probeGeminiControls({ runDir, bundle: different, adapter }),
      /unsupported_profile_or_price/
    )
    assert.equal(calls, 0)
    const db = openRun(runDir, different, new Date())
    try {
      assert.equal(
        (
          db.prepare('SELECT COUNT(*) AS total FROM controls').get() as {
            total: number
          }
        ).total,
        0
      )
    } finally {
      db.close()
    }
  }))

test('review: loss of the control lease before dispatch prevents HTTP', async () =>
  temporary(async root => {
    const runDir = join(root, 'run')
    let calls = 0
    const adapter = createGeminiTestAdapter({
      mode: 'test-only',
      http: async () => {
        calls++
        return json(metadata())
      },
    })
    await assert.rejects(
      probeGeminiControls({
        runDir,
        bundle,
        adapter,
        onReserved: () => {
          const db = openRun(runDir, bundle, new Date())
          try {
            db.prepare(
              "UPDATE meta SET value='0' WHERE key='active_until'"
            ).run()
          } finally {
            db.close()
          }
        },
      }),
      /run_lease_lost/
    )
    assert.equal(calls, 0)
    await assert.rejects(
      probeGeminiControls({ runDir, bundle, adapter }),
      /control_outcome_unknown/
    )
    assert.equal(calls, 0)
  }))

for (const suffix of ['lite', 'image'] as const) {
  test(`review: a sibling flash-${suffix} model is not the priced Flash model`, () => {
    const raw = {
      responseId: 'test',
      modelVersion: `${GEMINI_MODEL}-${suffix}`,
      usageMetadata: {
        promptTokenCount: 100,
        totalTokenCount: 100,
        serviceTier: 'standard',
      },
      candidates: [],
    }
    assert.throws(
      () => parseGeminiGeneration(raw, null),
      /model_version_changed/
    )
  })
}

test('review: numeric model revisions can be pinned without accepting sibling models', () => {
  const raw = {
    responseId: 'test',
    modelVersion: `${GEMINI_MODEL}-001`,
    usageMetadata: {
      promptTokenCount: 100,
      totalTokenCount: 100,
      serviceTier: 'standard',
    },
    candidates: [],
  }
  const parsed = parseGeminiGeneration(raw, null)
  assert.equal(parsed.kind, 'response')
  assert.equal(parseGeminiGeneration(raw, raw.modelVersion).kind, 'response')
  assert.throws(
    () => parseGeminiGeneration(raw, `${GEMINI_MODEL}-002`),
    /model_version_changed/
  )
})
