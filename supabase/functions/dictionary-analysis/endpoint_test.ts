import assert from 'node:assert/strict'
import { createDictionaryAnalysisRuntime } from './runtime.ts'
import { withAnalysisCors } from './cors.ts'
import { createIndependentDictionaryAnalysisEndpoint } from './endpoint.ts'
import { buildSemanticPolicy } from './semanticModel.ts'

const command = {
  protocol_version: 2,
  operation_id: '33333333-3333-4333-8333-333333333333',
  entry_id: '44444444-4444-4444-8444-444444444444',
  expected_revision_id: '55555555-5555-4555-8555-555555555555',
  expected_head_sequence: '1',
}
const options = {
  url: 'https://supabase.example.invalid',
  anonKey: 'synthetic-anon',
  serviceRoleKey: 'synthetic-service',
  apiKey: 'synthetic-provider',
  model: 'gemini-generator-fixture',
  modelVersion: 'gemini-generator-fixture',
  semanticModel: 'gemini-judge-fixture',
  semanticModelVersion: 'gemini-judge-fixture',
  mediaUrlPrefixes: [],
  allowedOrigins: ['https://web.example.invalid'],
  paidReleaseBinding: 'd'.repeat(64),
}
for (const flag of [undefined, 'false', 'TRUE', '1'])
  Deno.test(`runtime defaults disabled for flag ${flag}`, async () => {
    const reads: string[] = []
    const handler = await createDictionaryAnalysisRuntime(
      name => {
        reads.push(name)
        return flag
      },
      () => {
        throw new Error('must-not-import-or-load-client')
      }
    )
    assert.deepEqual(reads, ['DICTIONARY_ANALYSIS_ENDPOINT_ENABLED'])
    assert.equal((await handler(new Request(options.url))).status, 503)
  })
Deno.test(
  'invalid enabled configuration fails closed without printing secrets',
  async () => {
    let loads = 0
    const handler = await createDictionaryAnalysisRuntime(
      name =>
        name === 'DICTIONARY_ANALYSIS_ENDPOINT_ENABLED' ? 'true' : undefined,
      () => {
        loads++
        throw new Error('secret-value')
      }
    )
    const response = await handler(new Request(options.url))
    assert.equal(loads, 0)
    assert.deepEqual(await response.json(), {
      code: 'shared-analysis-disabled',
    })
  }
)
Deno.test(
  'runtime loads only exact explicit keys/models/origins with no fallback',
  async () => {
    const env: Record<string, string> = {
      DICTIONARY_ANALYSIS_ENDPOINT_ENABLED: 'true',
      SUPABASE_URL: options.url,
      SUPABASE_ANON_KEY: options.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: options.serviceRoleKey,
      DICTIONARY_ANALYSIS_GEMINI_API_KEY: options.apiKey,
      DICTIONARY_ANALYSIS_GENERATION_MODEL: options.model,
      DICTIONARY_ANALYSIS_GENERATION_MODEL_VERSION: options.modelVersion,
      DICTIONARY_ANALYSIS_SEMANTIC_MODEL: options.semanticModel,
      DICTIONARY_ANALYSIS_SEMANTIC_MODEL_VERSION: options.semanticModelVersion,
      DICTIONARY_ANALYSIS_MEDIA_URL_PREFIXES: '[]',
      DICTIONARY_ANALYSIS_ALLOWED_ORIGINS: JSON.stringify(
        options.allowedOrigins
      ),
      DICTIONARY_PAID_RELEASE_BINDING_SHA256: options.paidReleaseBinding,
    }
    const handler = await createDictionaryAnalysisRuntime(
      name => env[name],
      loaded => {
        assert.deepEqual(loaded, options)
        return Promise.resolve(() =>
          Promise.resolve(new Response(null, { status: 204 }))
        )
      }
    )
    assert.equal((await handler(new Request(options.url))).status, 204)
  }
)
Deno.test(
  'CORS admits configured browser preflight and native calls, rejecting other origins before work',
  async () => {
    let calls = 0
    const handler = withAnalysisCors(() => {
      calls++
      return Promise.resolve(new Response(null, { status: 200 }))
    }, options.allowedOrigins)
    const headers = { Origin: options.allowedOrigins[0] }
    const preflight = await handler(
      new Request(options.url, { method: 'OPTIONS', headers })
    )
    assert.equal(preflight.status, 204)
    assert.equal(
      preflight.headers.get('Access-Control-Allow-Origin'),
      headers.Origin
    )
    assert.equal(calls, 0)
    const denied = await handler(
      new Request(options.url, {
        headers: { Origin: 'https://evil.example.invalid' },
      })
    )
    assert.equal(denied.status, 403)
    assert.equal(calls, 0)
    const native = await handler(new Request(options.url))
    assert.equal(native.status, 200)
    assert.equal(native.headers.get('Access-Control-Allow-Origin'), null)
    const browser = await handler(
      new Request(options.url, { method: 'POST', headers })
    )
    assert.equal(browser.headers.get('Vary'), 'Origin')
    assert.equal(calls, 2)
    assert.throws(
      () => withAnalysisCors(handler, ['*']),
      /invalid-endpoint-origins/
    )
  }
)
Deno.test(
  'generation model is part of the exact independent qualification policy hash',
  async () => {
    const a = await buildSemanticPolicy(
      options.semanticModel,
      [],
      options.model,
      { generation: options.modelVersion, judge: options.semanticModelVersion }
    )
    const b = await buildSemanticPolicy(
      options.semanticModel,
      [],
      'gemini-other-fixture',
      { generation: options.modelVersion, judge: options.semanticModelVersion }
    )
    assert.notEqual(a.policy_sha256, b.policy_sha256)
    assert.equal(a.prompt_sha256, b.prompt_sha256)
  }
)
Deno.test(
  'cached real SDK verifies user and caller acceptance without exposing service credentials',
  async () => {
    const calls: Request[] = []
    const handler = await createIndependentDictionaryAnalysisEndpoint({
      ...options,
      fetch: (input, init) => {
        const request = new Request(input, init)
        calls.push(request)
        if (new URL(request.url).pathname === '/auth/v1/user') {
          assert.equal(
            request.headers.get('Authorization'),
            'Bearer synthetic-owner'
          )
          assert.equal(request.headers.get('apikey'), options.anonKey)
          return Promise.resolve(
            Response.json({ id: '11111111-1111-4111-8111-111111111111' })
          )
        }
        assert.equal(
          new URL(request.url).pathname,
          '/rest/v1/rpc/accept_dictionary_independent_analysis_v2'
        )
        assert.equal(
          request.headers.get('Authorization'),
          'Bearer synthetic-owner'
        )
        assert.equal(request.headers.get('apikey'), options.anonKey)
        return Promise.resolve(
          Response.json(
            { code: 'P0001', message: 'shared-analysis-disabled' },
            { status: 400 }
          )
        )
      },
    })
    assert.equal(calls.length, 0)
    const response = await handler(
      new Request(options.url, {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic-owner' },
        body: JSON.stringify(command),
      })
    )
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      code: 'shared-analysis-disabled',
    })
    assert.equal(calls.length, 2)
  }
)

for (const missing of [
  'DICTIONARY_ANALYSIS_GENERATION_MODEL_VERSION',
  'DICTIONARY_ANALYSIS_SEMANTIC_MODEL_VERSION',
  'DICTIONARY_PAID_RELEASE_BINDING_SHA256',
])
  Deno.test(
    `enabled runtime requires explicit observed version: ${missing}`,
    async () => {
      let loaded = false
      const values: Record<string, string> = {
        DICTIONARY_ANALYSIS_ENDPOINT_ENABLED: 'true',
        SUPABASE_URL: options.url,
        SUPABASE_ANON_KEY: options.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: options.serviceRoleKey,
        DICTIONARY_ANALYSIS_GEMINI_API_KEY: options.apiKey,
        DICTIONARY_ANALYSIS_GENERATION_MODEL: options.model,
        DICTIONARY_ANALYSIS_SEMANTIC_MODEL: options.semanticModel,
        DICTIONARY_ANALYSIS_GENERATION_MODEL_VERSION: options.modelVersion,
        DICTIONARY_ANALYSIS_SEMANTIC_MODEL_VERSION:
          options.semanticModelVersion,
        DICTIONARY_ANALYSIS_MEDIA_URL_PREFIXES: '[]',
        DICTIONARY_ANALYSIS_ALLOWED_ORIGINS: '[]',
        DICTIONARY_PAID_RELEASE_BINDING_SHA256: options.paidReleaseBinding,
      }
      delete values[missing]
      const handler = await createDictionaryAnalysisRuntime(
        name => values[name],
        () => {
          loaded = true
          throw new Error('Unexpected load')
        }
      )
      assert.equal((await handler(new Request(options.url))).status, 503)
      assert.equal(loaded, false)
    }
  )
