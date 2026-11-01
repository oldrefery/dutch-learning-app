import assert from 'node:assert/strict'
import { createDictionaryCreationRuntime } from './runtime.ts'
import { createConfiguredCreationEndpoint } from './bootstrap.ts'
import { buildCreationGeminiProfile } from './geminiModel.ts'

const models = {
  generation_model: 'gemini-generation-fixture',
  judgement_model: 'gemini-judgement-fixture',
  generation_model_version: 'gemini-generation-fixture-001',
  judgement_model_version: 'gemini-judgement-fixture-001',
}
const profile = await buildCreationGeminiProfile(models)
const env: Record<string, string> = {
  DICTIONARY_CREATION_ENDPOINT_ENABLED: 'true',
  SUPABASE_URL: 'https://fixture.invalid',
  SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  DICTIONARY_CREATION_GEMINI_API_KEY: 'fixture-provider',
  DICTIONARY_CREATION_GENERATION_MODEL: models.generation_model,
  DICTIONARY_CREATION_JUDGEMENT_MODEL: models.judgement_model,
  DICTIONARY_CREATION_GENERATION_MODEL_VERSION: models.generation_model_version,
  DICTIONARY_CREATION_JUDGEMENT_MODEL_VERSION: models.judgement_model_version,
  DICTIONARY_CREATION_POLICY_SHA256: profile.policy_sha256,
  DICTIONARY_CREATION_PROMPT_SHA256: profile.prompt_sha256,
  DICTIONARY_CREATION_ALLOWED_ORIGINS: '["https://web.fixture.invalid"]',
  DICTIONARY_PAID_RELEASE_BINDING_SHA256: 'd'.repeat(64),
}
const request = () =>
  new Request('https://fixture.invalid/functions/v1/dictionary-creation')
const assertDisabled = async (
  handler: (request: Request) => Promise<Response>
) => {
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await response.json(), {
    code: 'dictionary-creation-disabled',
  })
}
for (const flag of [undefined, '', 'false', 'TRUE', '1', 'true ']) {
  Deno.test(`creation runtime reads only enablement for ${flag}`, async () => {
    const reads: string[] = []
    const handler = await createDictionaryCreationRuntime(
      name => {
        reads.push(name)
        return flag
      },
      () => {
        throw new Error('unexpected-load')
      }
    )
    assert.deepEqual(reads, ['DICTIONARY_CREATION_ENDPOINT_ENABLED'])
    await assertDisabled(handler)
  })
}
for (const key of Object.keys(env).filter(
  key => key !== 'DICTIONARY_CREATION_ENDPOINT_ENABLED'
)) {
  Deno.test(
    `creation runtime rejects missing ${key} without loading clients`,
    async () => {
      let loads = 0
      const handler = await createDictionaryCreationRuntime(
        name => (name === key ? undefined : env[name]),
        () => {
          loads++
          throw new Error('unexpected-load')
        }
      )
      assert.equal(loads, 0)
      await assertDisabled(handler)
    }
  )
}
for (const [key, value] of [
  ['DICTIONARY_CREATION_ALLOWED_ORIGINS', '{}'],
  ['DICTIONARY_CREATION_ALLOWED_ORIGINS', '[42]'],
  ['DICTIONARY_CREATION_ALLOWED_ORIGINS', '["*"]'],
  [
    'DICTIONARY_CREATION_ALLOWED_ORIGINS',
    '["https://web.fixture.invalid/path"]',
  ],
  ['DICTIONARY_CREATION_POLICY_SHA256', 'a'.repeat(64)],
  ['DICTIONARY_CREATION_PROMPT_SHA256', 'b'.repeat(64)],
  ['DICTIONARY_CREATION_GENERATION_MODEL', models.judgement_model],
  [
    'DICTIONARY_CREATION_GENERATION_MODEL_VERSION',
    models.judgement_model_version,
  ],
  ['DICTIONARY_CREATION_GEMINI_API_KEY', ' '],
  ['SUPABASE_URL', 'not-a-url'],
  ['DICTIONARY_PAID_RELEASE_BINDING_SHA256', 'invalid'],
]) {
  Deno.test(`creation runtime rejects invalid ${key}: ${value}`, async () => {
    let calls = 0
    const handler = await createDictionaryCreationRuntime(
      name => (name === key ? value : env[name]),
      options =>
        createConfiguredCreationEndpoint({
          ...options,
          fetch: () => {
            calls++
            throw new Error('unexpected-network')
          },
        })
    )
    await assertDisabled(handler)
    assert.equal(calls, 0)
  })
}
Deno.test('creation loader errors do not expose credentials', async () => {
  await assertDisabled(
    await createDictionaryCreationRuntime(
      name => env[name],
      () => {
        throw new Error('fixture-secret-must-not-leak')
      }
    )
  )
})
Deno.test(
  'configured creation endpoint enforces CORS, auth and SQL gate without provider traffic',
  async () => {
    const calls: Request[] = []
    const handler = await createDictionaryCreationRuntime(
      name => env[name],
      options =>
        createConfiguredCreationEndpoint({
          ...options,
          fetch: (input, init) => {
            const req = new Request(input, init)
            calls.push(req)
            assert.equal(new URL(req.url).origin, 'https://fixture.invalid')
            assert.equal(req.headers.get('apikey'), 'fixture-anon')
            assert.equal(
              req.headers.get('Authorization'),
              'Bearer fixture-owner'
            )
            if (new URL(req.url).pathname === '/auth/v1/user')
              return Promise.resolve(
                Response.json({ id: '11111111-1111-4111-8111-111111111111' })
              )
            assert.equal(
              new URL(req.url).pathname,
              '/rest/v1/rpc/accept_dictionary_creation_v2'
            )
            return Promise.resolve(
              Response.json(
                { message: 'dictionary-creation-disabled' },
                { status: 400 }
              )
            )
          },
        })
    )
    assert.equal(calls.length, 0)
    const preflight = await handler(
      new Request(request(), {
        method: 'OPTIONS',
        headers: { Origin: 'https://web.fixture.invalid' },
      })
    )
    assert.equal(preflight.status, 204)
    assert.equal(
      preflight.headers.get('Access-Control-Allow-Origin'),
      'https://web.fixture.invalid'
    )
    assert.equal(
      (
        await handler(
          new Request(request(), {
            headers: { Origin: 'https://evil.invalid' },
          })
        )
      ).status,
      403
    )
    assert.equal(
      (await handler(new Request(request(), { method: 'POST' }))).status,
      401
    )
    assert.equal(calls.length, 0)
    const response = await handler(
      new Request(request(), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fixture-owner',
          Origin: 'https://web.fixture.invalid',
        },
        body: JSON.stringify({
          protocol_version: 2,
          operation_id: '22222222-2222-4222-8222-222222222222',
          resolution_id: '33333333-3333-4333-8333-333333333333',
        }),
      })
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      code: 'dictionary-creation-disabled',
    })
    assert.deepEqual(
      calls.map(call => new URL(call.url).pathname),
      [
        '/auth/v1/user',
        '/auth/v1/user',
        '/rest/v1/rpc/accept_dictionary_creation_v2',
      ]
    )
  }
)
