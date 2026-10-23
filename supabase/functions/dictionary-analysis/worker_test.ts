import assert from 'node:assert/strict'
import {
  canonicalizeJson,
  type DictionaryContent,
} from '../../../packages/domain/src/shared-dictionary.ts'
import type {
  DictionaryAnalysisCommandV2,
  DictionaryAnalysisReceiptV2,
} from '../../../packages/domain/src/dictionary-analysis.ts'
import { createDictionaryAnalysisHandler } from './handler.ts'
import { createAnalysisStore, type RpcClient } from './store.ts'
import { createGeminiTransport, journalPacket } from './geminiTransport.ts'
import {
  prepareGeminiRequest,
  parseProtectedAnalysisInput,
  sha256,
  type ProtectedAnalysisInput,
} from './protectedInput.ts'
import {
  runDictionaryAnalysis,
  type AnalysisWorkerDependencies,
  type AnalysisStore,
} from './worker.ts'

const actor = '11111111-1111-4111-8111-111111111111'
const command: DictionaryAnalysisCommandV2 = {
  protocol_version: 2,
  operation_id: '22222222-2222-4222-8222-222222222222',
  entry_id: '33333333-3333-4333-8333-333333333333',
  expected_revision_id: '44444444-4444-4444-8444-444444444444',
  expected_head_sequence: '9007199254740993',
}
const input: ProtectedAnalysisInput = {
  entry: {
    entry_id: command.entry_id,
    language_code: 'nl',
    lemma: 'bank',
    part_of_speech: 'noun',
    article: 'de',
    sense_key: 'financial-institution',
  },
  anchor: {
    anchor_id: '55555555-5555-4555-8555-555555555555',
    gloss: 'A financial institution holding money and providing loans.',
    examples: ['Ik heb geld bij de bank.'],
    anchor_sha256: 'a'.repeat(64),
  },
}
const content: DictionaryContent = {
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: ['банк'] },
  examples: [
    {
      nl: 'Ik heb geld bij de bank.',
      en: 'I keep money at the bank.',
      ru: null,
    },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'banken',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const envelope = (
  text = JSON.stringify({ content }),
  finishReason = 'STOP'
) => ({
  responseId: 'synthetic-response-1',
  candidates: [{ finishReason, content: { role: 'model', parts: [{ text }] } }],
})
const baseReceipt = (): DictionaryAnalysisReceiptV2 => ({
  ...command,
  fence: '7',
  status: 'accepted',
  quota_charged: true,
  result_sha256: null,
  error_code: null,
  published_revision_id: null,
  published_head_sequence: null,
})
const setup = () => {
  let receipt = baseReceipt()
  let result: Record<string, unknown> | null = null
  let inputHash: string | null = null
  let validation: string | null = null
  let providerCalls = 0
  let evaluations = 0
  const calls: string[] = []
  const id = '66666666-6666-4666-8666-666666666666'
  const store: AnalysisStore = {
    accept: () => {
      calls.push('accept')
      return Promise.resolve({ ...receipt })
    },
    read: (user, operation, fence) => {
      assert.equal(user, actor)
      assert.equal(operation, command.operation_id)
      assert.equal(fence, '7')
      calls.push('read')
      return Promise.resolve({
        receipt: { ...receipt },
        payload: structuredClone(input),
        provider: inputHash ? 'gemini' : null,
        model: inputHash ? 'gemini-fixture-model' : null,
        input_sha256: inputHash,
        result,
        validation_id: validation,
      })
    },
    dispatch: (_user, _operation, _fence, _model, hash) => {
      calls.push('dispatch')
      if (receipt.status !== 'accepted')
        return Promise.resolve({ receipt: { ...receipt }, dispatch: null })
      inputHash = hash
      receipt = { ...receipt, status: 'dispatching' }
      return Promise.resolve({
        receipt: { ...receipt },
        dispatch: structuredClone(input),
      })
    },
    journal: async (_user, _operation, _fence, packet) => {
      calls.push('journal')
      result = packet
      receipt = {
        ...receipt,
        status: 'validating',
        result_sha256: await sha256(canonicalizeJson(packet)),
      }
      return { ...receipt }
    },
    failure: (_user, _operation, _fence, outcome) => {
      calls.push('failure')
      receipt = {
        ...receipt,
        status: outcome as DictionaryAnalysisReceiptV2['status'],
        error_code: outcome,
      }
      return Promise.resolve({ ...receipt })
    },
    validate: () => {
      calls.push('validate')
      validation = id
      return Promise.resolve({
        receipt: { ...receipt },
        validation_id: id,
        outcome: 'accepted',
      })
    },
    publish: () => {
      calls.push('publish')
      receipt = {
        ...receipt,
        status: 'published',
        published_revision_id: id,
        published_head_sequence: '9007199254740994',
      }
      return Promise.resolve({ ...receipt })
    },
  }
  const dependencies: AnalysisWorkerDependencies = {
    store,
    model: 'gemini-fixture-model',
    transport: {
      invoke: () => {
        providerCalls++
        calls.push('provider')
        return Promise.resolve({
          kind: 'returned',
          result: journalPacket(JSON.stringify(envelope())),
          requestId: 'synthetic-response-1',
        })
      },
    },
    // Synthetic wiring fixture only: this is not a production semantic evaluator.
    evaluate: async context => {
      evaluations++
      calls.push('evaluate')
      assert.deepEqual(context.result, result)
      return {
        validator_version: 'synthetic-wiring-v1',
        policy_sha256: 'b'.repeat(64),
        anchor_sha256: context.input.anchor.anchor_sha256,
        input_sha256: context.input_sha256,
        result_sha256: context.receipt.result_sha256!,
        meaning_evidence_sha256: 'c'.repeat(64),
        outcome: 'accepted',
        decision_code: 'same-meaning',
        content,
        content_sha256: await sha256(canonicalizeJson(content)),
        cefr_input_sha256: 'd'.repeat(64),
      }
    },
  }
  return {
    dependencies,
    store,
    calls,
    receipt: () => receipt,
    setReceipt: (value: DictionaryAnalysisReceiptV2) => {
      receipt = value
    },
    providerCalls: () => providerCalls,
    evaluations: () => evaluations,
  }
}

Deno.test(
  'worker commits dispatch and journals response before evaluation/publication; replay calls no provider',
  async () => {
    const f = setup()
    const result = await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal('status' in result && result.status, 'published')
    assert.deepEqual(f.calls, [
      'accept',
      'read',
      'dispatch',
      'provider',
      'journal',
      'read',
      'evaluate',
      'validate',
      'publish',
    ])
    await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal(f.providerCalls(), 1)
  }
)
for (const point of ['dispatch', 'journal', 'validate', 'publish'] as const) {
  Deno.test(
    `worker never redispatches after committed ${point} loses its reply`,
    async () => {
      const f = setup()
      const original = f.store[point]
      let lost = false
      // Each store method has its own argument tuple; install the wrapper explicitly.
      if (point === 'dispatch')
        f.store.dispatch = async (...args) => {
          const data = await (original as AnalysisStore['dispatch'])(...args)
          if (!lost) {
            lost = true
            throw new Error('lost-reply')
          }
          return data
        }
      if (point === 'journal')
        f.store.journal = async (...args) => {
          const data = await (original as AnalysisStore['journal'])(...args)
          if (!lost) {
            lost = true
            throw new Error('lost-reply')
          }
          return data
        }
      if (point === 'validate')
        f.store.validate = async (...args) => {
          const data = await (original as AnalysisStore['validate'])(...args)
          if (!lost) {
            lost = true
            throw new Error('lost-reply')
          }
          return data
        }
      if (point === 'publish')
        f.store.publish = async (...args) => {
          const data = await (original as AnalysisStore['publish'])(...args)
          if (!lost) {
            lost = true
            throw new Error('lost-reply')
          }
          return data
        }
      await assert.rejects(
        runDictionaryAnalysis(actor, command, f.dependencies),
        /lost-reply/
      )
      f.dependencies.model = 'gemini-new-configuration'
      await runDictionaryAnalysis(actor, command, f.dependencies)
      assert.equal(f.providerCalls(), point === 'dispatch' ? 0 : 1)
      if (point === 'validate') assert.equal(f.evaluations(), 1)
    }
  )
}
Deno.test(
  'journal failure before commit leaves dispatching; retry never pays for another response',
  async () => {
    const f = setup()
    f.store.journal = () => Promise.reject(new Error('unavailable'))
    await assert.rejects(runDictionaryAnalysis(actor, command, f.dependencies))
    assert.equal(f.receipt().status, 'dispatching')
    await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal(f.providerCalls(), 1)
  }
)
Deno.test(
  'provider uncertainty is quarantined; repeated requests cannot invoke the provider',
  async () => {
    const f = setup()
    let physical = 0
    f.dependencies.transport.invoke = () => {
      physical++
      return Promise.resolve({
        kind: 'provider-outcome-unknown',
        evidence_sha256: null,
      })
    }
    await runDictionaryAnalysis(actor, command, f.dependencies)
    await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal(physical, 1)
    assert.equal(f.receipt().status, 'provider-outcome-unknown')
    assert.equal(f.evaluations(), 0)
  }
)
Deno.test(
  'concurrent entry rejection stops before worker reads and dispatch',
  async () => {
    const f = setup()
    f.store.accept = () =>
      Promise.resolve({ protocol_version: 2, outcome: 'analysis-in-progress' })
    assert.deepEqual(
      await runDictionaryAnalysis(actor, command, f.dependencies),
      { protocol_version: 2, outcome: 'analysis-in-progress' }
    )
    assert.equal(f.calls.length, 0)
    assert.equal(f.providerCalls(), 0)
  }
)
for (const status of ['head-conflict', 'authorization-revoked'] as const) {
  Deno.test(
    `dispatch ${status} prevents all provider and evaluator calls`,
    async () => {
      const f = setup()
      f.store.dispatch = () =>
        Promise.resolve({
          receipt: { ...baseReceipt(), status, error_code: status },
          dispatch: null,
        })
      await runDictionaryAnalysis(actor, command, f.dependencies)
      assert.equal(f.providerCalls(), 0)
      assert.equal(f.evaluations(), 0)
    }
  )
}
Deno.test(
  'changed protected payload in a dispatch grant fails before network',
  async () => {
    const f = setup()
    f.store.dispatch = () =>
      Promise.resolve({
        receipt: { ...baseReceipt(), status: 'dispatching' },
        dispatch: {
          ...input,
          anchor: { ...input.anchor, gloss: 'Furniture for sitting.' },
        },
      })
    await assert.rejects(
      runDictionaryAnalysis(actor, command, f.dependencies),
      /invalid-dispatch-grant/
    )
    assert.equal(f.providerCalls(), 0)
  }
)
Deno.test(
  'evaluation cannot bind to a different anchor/input/result',
  async () => {
    const f = setup()
    const evaluate = f.dependencies.evaluate
    f.dependencies.evaluate = async context => ({
      ...(await evaluate(context, actor)),
      result_sha256: 'e'.repeat(64),
    })
    await assert.rejects(
      runDictionaryAnalysis(actor, command, f.dependencies),
      /invalid-evaluation-evidence/
    )
    assert.equal(f.calls.includes('validate'), false)
    assert.equal(f.calls.includes('publish'), false)
  }
)
Deno.test(
  'review-required validation never publishes; late returned result remains quarantined',
  async () => {
    const f = setup()
    const evaluate = f.dependencies.evaluate
    f.dependencies.evaluate = async context => ({
      ...(await evaluate(context, actor)),
      outcome: 'review-required',
      decision_code: 'meaning-uncertain',
      content: null,
      content_sha256: null,
      cefr_input_sha256: null,
    })
    f.store.validate = () =>
      Promise.resolve({
        receipt: {
          ...f.receipt(),
          status: 'rejected',
          error_code: 'validation-review-required',
        },
        validation_id: '66666666-6666-4666-8666-666666666666',
        outcome: 'review-required',
      })
    const result = await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal('status' in result && result.status, 'rejected')
    assert.equal(f.calls.includes('publish'), false)
    const late = setup()
    const journal = late.store.journal
    late.store.journal = async (...args) => ({
      ...((await journal(...args)) as DictionaryAnalysisReceiptV2),
      status: 'provider-outcome-unknown',
      error_code: 'late-result-requires-reconciliation',
    })
    await runDictionaryAnalysis(actor, command, late.dependencies)
    assert.equal(late.evaluations(), 0)
  }
)
Deno.test(
  'protected input forbids injected fields, empty anchors and non-Dutch identities',
  async () => {
    for (const bad of [
      { ...input, prompt: 'Private original' },
      { ...input, anchor: { ...input.anchor, examples: [] } },
      { ...input, entry: { ...input.entry, language_code: 'en' } },
    ])
      assert.throws(() => parseProtectedAnalysisInput(bad))
    const request = await prepareGeminiRequest(input, 'gemini-fixture-model')
    assert.match(request.input_sha256, /^[0-9a-f]{64}$/)
    assert.equal(
      (JSON.parse(request.body).contents[0].parts[0].text as string).includes(
        input.anchor.gloss
      ),
      true
    )
    assert.equal(
      request.input_sha256,
      (
        await prepareGeminiRequest(
          structuredClone(input),
          'gemini-fixture-model'
        )
      ).input_sha256
    )
    await assert.rejects(prepareGeminiRequest(input, '../../untrusted-url'))
  }
)

for (const [status, kind] of [
  [400, 'provider-failed'],
  [401, 'provider-failed'],
  [429, 'provider-failed'],
  [408, 'provider-outcome-unknown'],
  [500, 'provider-outcome-unknown'],
  [503, 'provider-outcome-unknown'],
] as const) {
  Deno.test(
    `transport HTTP ${status}: ${kind}, exactly one request, no response body in thrown errors`,
    async () => {
      let count = 0
      const transport = createGeminiTransport({
        apiKey: 'synthetic-key',
        fetch: () => {
          count++
          return Promise.resolve(
            new Response('synthetic-private-error', { status })
          )
        },
      })
      const result = await transport.invoke(
        await prepareGeminiRequest(input, 'gemini-fixture-model'),
        'fixture'
      )
      assert.equal(result.kind, kind)
      assert.equal(count, 1)
      assert.equal(
        JSON.stringify(result).includes('synthetic-private-error'),
        false
      )
    }
  )
}
Deno.test(
  'transport validates fixed URL/key header/body and separates thought parts from output',
  async () => {
    const request = await prepareGeminiRequest(input, 'gemini-fixture-model')
    const transport = createGeminiTransport({
      apiKey: 'synthetic-key',
      fetch: (url, init?: RequestInit) => {
        assert.equal(
          url,
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-fixture-model:generateContent'
        )
        assert.equal(init?.redirect, 'error')
        assert.equal(init?.body, request.body)
        assert.equal(
          new Headers(init?.headers).get('x-goog-api-key'),
          'synthetic-key'
        )
        const response = envelope()
        response.candidates[0].content.parts.unshift({
          text: 'private reasoning',
          thought: true,
        } as { text: string })
        return Promise.resolve(Response.json(response))
      },
    })
    const result = await transport.invoke(request, 'fixture')
    assert.equal(result.kind, 'returned')
    if (result.kind === 'returned') {
      assert.deepEqual(result.result.content, content)
      assert.equal(result.requestId, 'synthetic-response-1')
    }
  }
)
for (const [name, body] of [
  [
    'truncated',
    JSON.stringify(envelope(JSON.stringify({ content }), 'MAX_TOKENS')),
  ],
  [
    'blocked',
    JSON.stringify({
      ...envelope(),
      promptFeedback: { blockReason: 'SAFETY' },
    }),
  ],
  [
    'markdown',
    JSON.stringify(
      envelope('```json\n' + JSON.stringify({ content }) + '\n```')
    ),
  ],
  [
    'extra output fields',
    JSON.stringify(envelope(JSON.stringify({ content, confidence: 1 }))),
  ],
  ['malformed body', '{invalid'],
] as const) {
  Deno.test(
    `transport journals ${name} as invalid content without interpreting it as a verdict`,
    async () => {
      const transport = createGeminiTransport({
        apiKey: 'synthetic-key',
        fetch: () => Promise.resolve(new Response(body)),
      })
      const result = await transport.invoke(
        await prepareGeminiRequest(input, 'gemini-fixture-model'),
        'fixture'
      )
      assert.equal(result.kind, 'returned')
      if (result.kind === 'returned') assert.equal(result.result.content, null)
    }
  )
}
Deno.test(
  'oversized response cancels its stream and cannot trigger another paid request',
  async () => {
    let cancelled = false,
      count = 0
    const transport = createGeminiTransport({
      apiKey: 'synthetic-key',
      fetch: () => {
        count++
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                controller.enqueue(new Uint8Array(32769))
              },
              cancel() {
                cancelled = true
              },
            })
          )
        )
      },
    })
    assert.equal(
      (
        await transport.invoke(
          await prepareGeminiRequest(input, 'gemini-fixture-model'),
          'fixture'
        )
      ).kind,
      'provider-outcome-unknown'
    )
    assert.equal(cancelled, true)
    assert.equal(count, 1)
  }
)
Deno.test(
  'timeout and network error never retry and never disclose exception text',
  async () => {
    const request = await prepareGeminiRequest(input, 'gemini-fixture-model')
    let count = 0
    const timed = createGeminiTransport({
      apiKey: 'synthetic-key',
      timeoutMs: 5,
      fetch: (_url, init?: RequestInit) => {
        count++
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('private-token')),
            { once: true }
          )
        )
      },
    })
    assert.deepEqual(await timed.invoke(request, 'fixture'), {
      kind: 'provider-outcome-unknown',
      evidence_sha256: null,
    })
    assert.equal(count, 1)
    const failed = createGeminiTransport({
      apiKey: 'synthetic-key',
      fetch: () => Promise.reject(new Error('private-key')),
    })
    assert.deepEqual(await failed.invoke(request, 'fixture'), {
      kind: 'provider-outcome-unknown',
      evidence_sha256: null,
    })
  }
)
Deno.test(
  'RPC adapter uses caller credentials only for acceptance; privileged calls use verified actor',
  async () => {
    const calls: {
      client: string
      name: string
      args: Record<string, unknown>
    }[] = []
    const client = (label: string): RpcClient => ({
      rpc: (name, args) => {
        calls.push({ client: label, name, args })
        return Promise.resolve({ data: {}, error: null })
      },
    })
    const store = createAnalysisStore(client('caller'), client('service'))
    await store.accept(command)
    await store.read(actor, command.operation_id, '7')
    await store.dispatch(
      actor,
      command.operation_id,
      '7',
      'gemini-fixture-model',
      'a'.repeat(64)
    )
    assert.deepEqual(
      calls.map(value => value.client),
      ['caller', 'service', 'service']
    )
    assert.equal(calls[1].args.p_actor, actor)
    assert.equal(calls[0].args.p_actor, undefined)
    const broken = createAnalysisStore(
      {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: 'private SQL/input' },
          }),
      },
      client('service')
    )
    await assert.rejects(
      broken.accept(command),
      /^Error: analysis-storage-unavailable$/
    )
  }
)
Deno.test(
  'handler rejects unverified identity, actor/private payload injection and oversized/malformed body before worker',
  async () => {
    const f = setup()
    let verified = 0
    const handler = createDictionaryAnalysisHandler({
      verifyUser: () => {
        verified++
        return Promise.resolve(actor)
      },
      forCaller: () => f.dependencies,
    })
    const request = (body: unknown, token = 'Bearer synthetic-token') =>
      new Request('https://local.example.invalid/analysis', {
        method: 'POST',
        headers: { Authorization: token },
        body: JSON.stringify(body),
      })
    assert.equal((await handler(request(command, 'Basic forged'))).status, 401)
    assert.equal(verified, 0)
    for (const bad of [
      { ...command, actor },
      { ...command, prompt: 'private content' },
      { ...command, extra: 'x'.repeat(3000) },
    ])
      assert.equal((await handler(request(bad))).status, 400)
    assert.equal(f.calls.length, 0)
    const denied = createDictionaryAnalysisHandler({
      verifyUser: () => Promise.resolve(null),
      forCaller: () => f.dependencies,
    })
    assert.equal((await denied(request(command))).status, 401)
    assert.equal((await handler(request(command))).status, 200)
  }
)

for (const [code, status] of [
  ['analysis-permission-required', 403],
  ['rate-limit-exceeded', 429],
  ['head-conflict', 409],
] as const) {
  Deno.test(
    `handler returns only whitelisted ${code} acceptance code, without any privileged work`,
    async () => {
      const f = setup()
      f.dependencies.store = createAnalysisStore(
        {
          rpc: () => Promise.resolve({ data: null, error: { message: code } }),
        },
        {
          rpc: () => {
            throw new Error('privileged-work-must-not-run')
          },
        }
      )
      const handler = createDictionaryAnalysisHandler({
        verifyUser: () => Promise.resolve(actor),
        forCaller: () => f.dependencies,
      })
      const response = await handler(
        new Request('https://local.example.invalid/analysis', {
          method: 'POST',
          headers: { Authorization: 'Bearer synthetic-token' },
          body: JSON.stringify(command),
        })
      )
      assert.equal(response.status, status)
      assert.deepEqual(await response.json(), { code })
      assert.equal(f.providerCalls(), 0)
    }
  )
}

Deno.test(
  'a dispatched receipt cannot substitute another fence before the provider call',
  async () => {
    const f = setup()
    f.store.dispatch = () =>
      Promise.resolve({
        receipt: { ...baseReceipt(), status: 'dispatching', fence: '8' },
        dispatch: input,
      })
    await assert.rejects(
      runDictionaryAnalysis(actor, command, f.dependencies),
      /invalid-worker-receipt/
    )
    assert.equal(f.providerCalls(), 0)
  }
)

Deno.test(
  'operator failure diagnostics never enter client receipts or store RPC arguments',
  async () => {
    const f = setup()
    const original = f.store.failure
    const argsSeen: unknown[][] = []
    f.store.failure = (...args) => {
      argsSeen.push(args)
      return original(...args)
    }
    let calls = 0
    f.dependencies.transport = createGeminiTransport({
      apiKey: 'private-fixture-key',
      fetch: () => {
        calls++
        return Promise.resolve(
          Response.json(
            {
              error: {
                status: 'INVALID_ARGUMENT',
                message: 'private-fixture-prompt',
              },
            },
            { status: 400 }
          )
        )
      },
    })
    const result = await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal('status' in result && result.status, 'provider-failed')
    assert.equal(argsSeen.length, 1)
    assert.equal(argsSeen[0].length, 5)
    assert.match(String(argsSeen[0][4]), /^[a-f0-9]{64}$/)
    assert.equal(
      JSON.stringify([result, argsSeen]).includes('diagnostics'),
      false
    )
    assert.equal(
      JSON.stringify([result, argsSeen]).includes('private-fixture'),
      false
    )
    await runDictionaryAnalysis(actor, command, f.dependencies)
    assert.equal(calls, 1)
  }
)
