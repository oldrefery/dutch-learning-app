import assert from 'node:assert/strict'
import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import type { DictionaryCreationReceiptV2 } from '../../../packages/domain/src/dictionary-creation.ts'
import { sha256 } from '../dictionary-analysis/protectedInput.ts'
import {
  parseCreationCommand,
  parseCreationGrant,
  type CreationProfile,
} from './contracts.ts'
import { runDictionaryCreation, type CreationStore } from './worker.ts'
import { createDictionaryCreationHandler } from './handler.ts'
import { createCreationStore } from './store.ts'
import { createDictionaryCreationEndpoint } from './endpoint.ts'

const actor = '11111111-1111-4111-8111-111111111111'
const run = '22222222-2222-4222-8222-222222222222'
const command = {
  protocol_version: 2 as const,
  operation_id: '33333333-3333-4333-8333-333333333333',
  resolution_id: '44444444-4444-4444-8444-444444444444',
}
const profile: CreationProfile = {
  generation_model: 'gemini-fixture-generator',
  judgement_model: 'gemini-fixture-judge',
  validator_version: 'fixture-v1',
  policy_sha256: 'b'.repeat(64),
  prompt_sha256: 'c'.repeat(64),
}
const receipt = (): DictionaryCreationReceiptV2 => ({
  ...command,
  entry_id: '55555555-5555-4555-8555-555555555555',
  fence: '9007199254740993',
  status: 'accepted',
  quota_charged: true,
  result_sha256: null,
  error_code: null,
  published: null,
  published_head_sequence: null,
})
async function grant() {
  const input = {
    schema_version: 1,
    identity: {
      language_code: 'nl',
      lemma: 'bank',
      part_of_speech: 'noun',
      article: 'de',
      sense_key: 'financial-institution',
    },
    anchor: {
      anchor_id: '66666666-6666-4666-8666-666666666666',
      anchor_sha256: 'a'.repeat(64),
      gloss: 'A financial institution.',
      examples: ['Ik ga naar de bank.'],
    },
    evidence_sha256: 'e'.repeat(64),
    validator_version: profile.validator_version,
    policy_sha256: profile.policy_sha256,
  }
  return {
    run_id: run,
    fence: receipt().fence,
    provider: 'gemini' as const,
    model: profile.generation_model,
    input,
    input_sha256: await sha256(canonicalizeJson(input)),
  }
}
const unused = (): never => {
  throw new Error('unexpected-store-call')
}
const terminalStore = (value: unknown): CreationStore => ({
  accept: () => Promise.resolve(value),
  read: unused,
  dispatch: unused,
  journal: unused,
  failure: unused,
  validate: unused,
  publish: unused,
})
const request = (
  body: unknown = command,
  token: string | null = 'fixture-token',
  method = 'POST'
) =>
  new Request('https://fixture.invalid/creation', {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
const published = () => ({
  ...receipt(),
  status: 'published' as const,
  result_sha256: 'd'.repeat(64),
  published_head_sequence: '9007199254740995',
  published: {
    reference: {
      entry_id: receipt().entry_id,
      revision_id: '77777777-7777-4777-8777-777777777777',
    },
    content_sha256: 'f'.repeat(64),
  },
})
const forbidden = { invoke: unused }
const handler = (store = terminalStore(published())) =>
  createDictionaryCreationHandler({
    verifyUser: () => Promise.resolve(actor),
    forCaller: () => ({ store, profile, transport: forbidden }),
  })

Deno.test(
  'strict separate recovery command canonicalizes UUIDs without changing normal3-key command',
  () => {
    assert.deepEqual(parseCreationCommand(command), command)
    const recovery_id = '88888888-8888-4888-8888-888888888888'
    assert.deepEqual(parseCreationCommand({ ...command, recovery_id }), {
      ...command,
      recovery_id,
    })
    assert.throws(() =>
      parseCreationCommand({ ...command, recovery_id: command.operation_id })
    )
  }
)
for (const extra of [
  'actor_id',
  'entry_id',
  'fence',
  'model',
  'result',
  'approval',
  'review_id',
  'original_query',
  'meaning_hint',
]) {
  Deno.test(
    `HTTP rejects caller ${extra} authority/private payload before store or transport`,
    async () => {
      const response = await handler(terminalStore(null))(
        request({ ...command, [extra]: 'forbidden' })
      )
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        code: 'invalid-creation-command',
      })
    }
  )
}
Deno.test(
  'HTTP denies missing bearer and unsupported method before Auth/store',
  async () => {
    const http = createDictionaryCreationHandler({
      verifyUser: unused,
      forCaller: unused,
    })
    assert.equal((await http(request(command, null))).status, 401)
    assert.equal((await http(request(command, null, 'GET'))).status, 405)
  }
)
Deno.test(
  'bounded command streaming rejects oversized body and invalid UTF8 without leaking it',
  async () => {
    const http = handler(terminalStore(null))
    assert.equal(
      (await http(request({ ...command, hidden: 'secret'.repeat(1000) })))
        .status,
      400
    )
    assert.equal(
      (
        await http(
          new Request('https://fixture.invalid', {
            method: 'POST',
            headers: { Authorization: 'Bearer fixture' },
            body: new Uint8Array([255]),
          })
        )
      ).status,
      400
    )
  }
)
Deno.test(
  'published replay returns exact original BIGINT receipt before profile/work/provider requirements',
  async () => {
    const http = createDictionaryCreationHandler({
      verifyUser: () => Promise.resolve(actor),
      forCaller: () => ({
        store: terminalStore(published()),
        transport: forbidden,
        profile: { ...profile, generation_model: 'withdrawn' },
      }),
    })
    const response = await http(request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await response.json(), published())
  }
)
Deno.test(
  'mismatched operation response fails closed and does not expose SQL or private bytes',
  async () => {
    const response = await handler(
      terminalStore({ ...published(), resolution_id: run })
    )(request())
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      code: 'creation-unavailable',
      retry: 'same-operation-only',
    })
  }
)
Deno.test(
  'canonical server grant preserves fence above JS safe integer exactly',
  async () => {
    const value = await grant()
    assert.deepEqual(
      await parseCreationGrant(value, 'generation', run, receipt(), profile),
      value
    )
  }
)
for (const [name, change] of [
  [
    'model',
    (g: Awaited<ReturnType<typeof grant>>) => {
      g.model = profile.judgement_model
    },
  ],
  [
    'fence',
    (g: Awaited<ReturnType<typeof grant>>) => {
      g.fence = '9007199254740994'
    },
  ],
  [
    'run',
    (g: Awaited<ReturnType<typeof grant>>) => {
      g.run_id = actor
    },
  ],
  [
    'hash',
    (g: Awaited<ReturnType<typeof grant>>) => {
      g.input_sha256 = 'f'.repeat(64)
    },
  ],
  [
    'policy',
    (g: Awaited<ReturnType<typeof grant>>) => {
      g.input.policy_sha256 = 'f'.repeat(64)
    },
  ],
  [
    'neutral input',
    (g: Awaited<ReturnType<typeof grant>>) => {
      Object.assign(g.input, { meaning_hint: 'private' })
    },
  ],
] as const) {
  Deno.test(
    `committed grant with wrong ${name} cannot reach transport`,
    async () => {
      const value = await grant()
      change(value)
      const current = { ...receipt(), status: 'dispatching' as const }
      const store = {
        ...terminalStore(receipt()),
        read: () => Promise.resolve({ run_id: run, receipt: receipt() }),
        dispatch: () => Promise.resolve({ receipt: current, dispatch: value }),
      }
      await assert.rejects(
        runDictionaryCreation(actor, command, {
          store,
          profile,
          transport: forbidden,
          verifyActor: () => Promise.resolve(actor),
        })
      )
    }
  )
}
Deno.test(
  'hash-correct extra identity authority is rejected by exact neutral schema',
  async () => {
    const value = await grant()
    Object.assign(value.input.identity, { entry_id: receipt().entry_id })
    value.input_sha256 = await sha256(canonicalizeJson(value.input))
    await assert.rejects(
      parseCreationGrant(value, 'generation', run, receipt(), profile)
    )
  }
)
Deno.test(
  'same generation and judge model configuration fails before any grant or transport',
  async () => {
    await assert.rejects(
      runDictionaryCreation(actor, command, {
        store: terminalStore(receipt()),
        profile: { ...profile, judgement_model: profile.generation_model },
        transport: forbidden,
        verifyActor: () => Promise.resolve(actor),
      })
    )
  }
)

for (const field of [
  'prompt_sha256',
  'content_sha256',
  'result_sha256',
  'fence',
]) {
  Deno.test(
    `judge grant with hash-correct mismatched ${field} fails before transport`,
    async () => {
      const generation = await grant()
      const input: Record<string, unknown> = {
        schema_version: 1,
        anchor: {
          anchor_sha256: 'a'.repeat(64),
          gloss: 'A financial institution.',
          examples: ['Ik ga naar de bank.'],
        },
        candidate: { linguistic: 'synthetic' },
        content_sha256: await sha256(
          canonicalizeJson({ linguistic: 'synthetic' })
        ),
        result_sha256: 'd'.repeat(64),
        generation_input_sha256: generation.input_sha256,
        fence: receipt().fence,
        evidence_sha256: 'e'.repeat(64),
        validator_version: profile.validator_version,
        policy_sha256: profile.policy_sha256,
        prompt_sha256: profile.prompt_sha256,
      }
      input[field] = field === 'fence' ? '9007199254740994' : 'f'.repeat(64)
      const value = {
        ...generation,
        model: profile.judgement_model,
        prompt_sha256: profile.prompt_sha256,
        input,
        input_sha256: await sha256(canonicalizeJson(input)),
      }
      await assert.rejects(
        parseCreationGrant(
          value,
          'judgement',
          run,
          { ...receipt(), status: 'validating', result_sha256: 'd'.repeat(64) },
          profile
        )
      )
    }
  )
}

Deno.test(
  'SDK full worker read and dispatch use service key while fresh Auth always uses caller bearer',
  async () => {
    const rpc: string[] = []
    const http = createDictionaryCreationEndpoint({
      url: 'https://fixture.invalid',
      anonKey: 'fixture-anon',
      serviceRoleKey: 'fixture-service',
      profile,
      transport: forbidden,
      allowedOrigins: [],
      fetch: (url, init) => {
        const req = new Request(url, init),
          path = new URL(req.url).pathname
        if (path === '/auth/v1/user') {
          assert.equal(req.headers.get('Authorization'), 'Bearer fixture-token')
          assert.equal(req.headers.get('apikey'), 'fixture-anon')
          return Promise.resolve(Response.json({ id: actor }))
        }
        rpc.push(path)
        if (path.endsWith('/accept_dictionary_creation_v2')) {
          assert.equal(req.headers.get('Authorization'), 'Bearer fixture-token')
          return Promise.resolve(Response.json(receipt()))
        }
        assert.equal(req.headers.get('Authorization'), 'Bearer fixture-service')
        assert.equal(req.headers.get('apikey'), 'fixture-service')
        if (path.endsWith('/get_dictionary_creation_work_v1'))
          return Promise.resolve(
            Response.json({ run_id: run, receipt: receipt() })
          )
        assert.equal(path, '/rest/v1/rpc/start_dictionary_creation_dispatch_v1')
        return Promise.resolve(
          Response.json({
            receipt: { ...receipt(), status: 'dispatching' },
            dispatch: null,
          })
        )
      },
    })
    const response = await http(request())
    assert.equal(response.status, 202)
    assert.equal((await response.json()).fence, '9007199254740993')
    assert.equal(rpc.length, 3)
  }
)
Deno.test(
  'verified actor change before acceptance stops all writes',
  async () => {
    await assert.rejects(
      runDictionaryCreation(actor, command, {
        store: terminalStore(null),
        profile,
        transport: forbidden,
        verifyActor: () => Promise.resolve(run),
      }),
      /authentication-required/
    )
  }
)
Deno.test(
  'store sends acceptance only through caller and all retained-run actions through service',
  async () => {
    const calls: {
      role: string
      name: string
      parameters: Record<string, unknown>
    }[] = []
    const client = (role: string) => ({
      rpc(name: string, parameters: Record<string, unknown>) {
        calls.push({ role, name, parameters })
        return Promise.resolve({ data: null, error: null })
      },
    })
    const store = createCreationStore(client('caller'), client('service')),
      value = await grant()
    await store.accept(command)
    await store.accept({ ...command, recovery_id: actor })
    await store.read(actor, command.operation_id)
    await store.dispatch('generation', run, value.fence)
    await store.dispatch('judgement', run, value.fence)
    await store.journal('generation', value, {}, 'fixture')
    await store.journal('judgement', value, {}, 'fixture')
    await store.failure('generation', value, false, null)
    await store.failure('judgement', value, true, 'e'.repeat(64))
    await store.validate(run, value.fence)
    await store.publish(run, value.fence, actor)
    assert.deepEqual(
      calls.map(c => c.role),
      ['caller', 'caller', ...Array(9).fill('service')]
    )
    assert.equal(calls[1].name, 'accept_dictionary_creation_recovery_v2')
    assert.equal(calls.at(-2)?.parameters.p_outcome, undefined)
    assert.deepEqual(calls.at(-2)?.parameters, {
      p_run: run,
      p_fence: value.fence,
    })
  }
)
Deno.test(
  'store exposes only exact allowlisted acceptance errors; secret SQL is redacted',
  async () => {
    for (const [message, status] of [
      ['rate-limit-exceeded', 429],
      ['operation-payload-conflict', 409],
      ['secret SQL private hint', 503],
    ] as const) {
      const client = {
        rpc: () => Promise.resolve({ data: null, error: { message } }),
      }
      const response = await handler(createCreationStore(client, client))(
        request()
      )
      assert.equal(response.status, status)
      assert.equal(
        JSON.stringify(await response.json()).includes('secret'),
        false
      )
    }
  }
)
Deno.test(
  'SDK endpoint verifies bearer via Auth getUser and isolates caller/service keys using fake HTTP only',
  async () => {
    const calls: {
      path: string
      authorization: string | null
      apikey: string | null
    }[] = []
    const http = createDictionaryCreationEndpoint({
      url: 'https://fixture.invalid',
      anonKey: 'fixture-anon',
      serviceRoleKey: 'fixture-service',
      profile,
      transport: forbidden,
      allowedOrigins: ['https://app.fixture.invalid'],
      fetch: (url, init) => {
        const req = new Request(url, init)
        calls.push({
          path: new URL(req.url).pathname,
          authorization: req.headers.get('Authorization'),
          apikey: req.headers.get('apikey'),
        })
        if (new URL(req.url).pathname === '/auth/v1/user')
          return Promise.resolve(Response.json({ id: actor }))
        assert.equal(
          new URL(req.url).pathname,
          '/rest/v1/rpc/accept_dictionary_creation_v2'
        )
        return Promise.resolve(Response.json(published()))
      },
    })
    assert.equal((await http(request())).status, 200)
    assert.equal(calls.filter(c => c.path === '/auth/v1/user').length, 2)
    assert.equal(
      calls.every(
        c =>
          c.authorization === 'Bearer fixture-token' &&
          c.apikey === 'fixture-anon'
      ),
      true
    )
    assert.equal(
      calls.some(c => c.apikey === 'fixture-service'),
      false
    )
    const denied = new Request('https://fixture.invalid', {
      headers: { Origin: 'https://evil.fixture.invalid' },
    })
    assert.equal((await http(denied)).status, 403)
    assert.equal(calls.length, 3)
  }
)

Deno.test(
  'version-invalid creation candidate returns durable review-required receipt before judge or publication',
  async () => {
    const { CreationCandidateInvalid } = await import('./worker.ts')
    const current = {
      ...receipt(),
      status: 'validating' as const,
      result_sha256: 'd'.repeat(64),
    }
    const review = {
      ...current,
      status: 'review-required' as const,
      error_code: 'meaning-uncertain',
    }
    let dispatches = 0
    const store: CreationStore = {
      ...terminalStore(current),
      read: () => Promise.resolve({ run_id: run, receipt: current }),
      dispatch: phase => {
        assert.equal(phase, 'judgement')
        dispatches++
        throw new CreationCandidateInvalid()
      },
      validate: () =>
        Promise.resolve({ outcome: 'review-required', receipt: review }),
    }
    assert.deepEqual(
      await runDictionaryCreation(actor, command, {
        store,
        profile,
        transport: forbidden,
        verifyActor: () => Promise.resolve(actor),
      }),
      review
    )
    assert.equal(dispatches, 1)
    assert.deepEqual(
      await runDictionaryCreation(actor, command, {
        store: terminalStore(review),
        profile: { ...profile, generation_model: 'withdrawn' },
        transport: forbidden,
        verifyActor: () => Promise.resolve(actor),
      }),
      review
    )
  }
)
