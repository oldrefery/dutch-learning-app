import assert from 'node:assert/strict'
import { qualificationCorpus } from '../../../scripts/shared-dictionary/semantic-qualification-corpus.ts'
import { createGeminiTransport } from './geminiTransport.ts'
import { prepareGeminiRequest, sha256 } from './protectedInput.ts'
import { contextFor } from '../../../scripts/shared-dictionary/semantic-qualification.ts'
import { providerDiagnostics } from './providerDiagnostics.ts'

const request = async () =>
  prepareGeminiRequest(
    (await contextFor(qualificationCorpus()[0])).input,
    'gemini-fixture-model'
  )
const secret = 'private-fixture-key-and-prompt'
const errorBody = (status: string) =>
  JSON.stringify({
    error: {
      code: 400,
      status,
      message: `Invalid value at 'generation_config.response_format.text.mime_type': ${secret}`,
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.BadRequest',
          fieldViolations: [
            {
              field: 'generation_config.response_format.text.mime_type',
              description: secret,
            },
            {
              field: `generation_config.response_format.text.schema.${secret}`,
              description: secret,
            },
            { field: 'contents[0].parts[0].text', description: secret },
          ],
        },
      ],
      headers: { 'x-goog-api-key': secret },
    },
  })
for (const [http, status, kind] of [
  [400, 'INVALID_ARGUMENT', 'provider-failed'],
  [401, 'UNAUTHENTICATED', 'provider-failed'],
  [403, 'PERMISSION_DENIED', 'provider-failed'],
  [404, 'NOT_FOUND', 'provider-failed'],
  [429, 'RESOURCE_EXHAUSTED', 'provider-failed'],
  [408, 'DEADLINE_EXCEEDED', 'provider-outcome-unknown'],
  [500, 'INTERNAL', 'provider-outcome-unknown'],
  [503, 'UNAVAILABLE', 'provider-outcome-unknown'],
] as const) {
  Deno.test(
    `HTTP ${http} retains sanitized diagnostics with unchanged classification and evidence hash`,
    async () => {
      let calls = 0
      const body = errorBody(status)
      const transport = createGeminiTransport({
        apiKey: secret,
        fetch: (_url, init?: RequestInit) => {
          calls++
          assert.equal(
            new Headers(init?.headers).get('Content-Type'),
            'application/json'
          )
          assert.equal(init?.redirect, 'error')
          return Promise.resolve(
            new Response(body, {
              status: http,
              headers: { 'private-header': secret },
            })
          )
        },
      })
      const result = await transport.invoke(await request(), 'fixture')
      assert.equal(result.kind, kind)
      assert.equal(
        result.evidence_sha256,
        kind === 'provider-failed'
          ? await sha256(JSON.stringify({ status: http, body }))
          : null
      )
      assert.deepEqual(result.diagnostics, {
        http_status: http,
        google_status: status,
        body_state: 'structured',
        message: providerDiagnostics(http, body).message,
        field_violations: [
          {
            field: 'generationConfig.responseFormat.text.mimeType',
            message: 'Provider reported an invalid field value.',
          },
          {
            field: 'contents[].parts[].text',
            message: 'Provider reported an invalid field value.',
          },
        ],
      })
      assert.ok(result.diagnostics!.message.length > 10)
      assert.equal(JSON.stringify(result).includes(secret), false)
      assert.equal(calls, 1)
    }
  )
}
Deno.test(
  'unrecognized codes, field paths and detail shapes cannot smuggle provider text',
  () => {
    for (const status of [
      secret,
      '__proto__',
      'constructor',
      'INVALID_ARGUMENT ',
    ]) {
      const result = providerDiagnostics(400, errorBody(status))
      assert.equal(result.google_status, null)
      assert.equal(
        result.message,
        'Provider rejected an invalid request argument.'
      )
      assert.equal(JSON.stringify(result).includes(secret), false)
    }
    for (const details of [
      null,
      [null, secret, { fieldViolations: [null] }],
      [{ '@type': secret, fieldViolations: [{ field: 'model' }] }],
    ]) {
      const result = providerDiagnostics(
        400,
        JSON.stringify({ error: { status: secret, message: secret, details } })
      )
      assert.deepEqual(result.field_violations, [])
      assert.equal(JSON.stringify(result).includes(secret), false)
    }
  }
)
Deno.test(
  'diagnostics cap field count, deduplicate fields and synthesize bounded messages',
  () => {
    const fields = [
      'model',
      'contents',
      'contents[0].role',
      'contents[0].parts',
      'contents[0].parts[0].text',
      'systemInstruction',
      'generationConfig',
      'generationConfig.candidateCount',
      'generationConfig.maxOutputTokens',
    ]
    const result = providerDiagnostics(
      400,
      JSON.stringify({
        error: {
          status: 'INVALID_ARGUMENT',
          message: secret.repeat(500),
          details: Array.from({ length: 100 }, () => ({
            '@type': 'type.googleapis.com/google.rpc.BadRequest',
            fieldViolations: [...fields, ...fields].map(field => ({
              field,
              description: secret.repeat(100),
            })),
          })),
        },
      })
    )
    assert.equal(result.field_violations.length, 8)
    assert.equal(new Set(result.field_violations.map(row => row.field)).size, 8)
    assert.ok(JSON.stringify(result).length < 2000)
    assert.equal(JSON.stringify(result).includes(secret), false)
  }
)
for (const body of [
  '{invalid-private-fixture',
  '<html>private-fixture</html>',
  'null',
  '[]',
  '{"error":null}',
]) {
  Deno.test(
    `malformed error body ${body.slice(0, 10)} retains HTTP evidence without raw text`,
    async () => {
      const transport = createGeminiTransport({
        apiKey: secret,
        fetch: () => Promise.resolve(new Response(body, { status: 400 })),
      })
      const result = await transport.invoke(await request(), 'fixture')
      assert.equal(result.kind, 'provider-failed')
      if (result.kind !== 'provider-failed')
        throw new Error('unexpected-outcome')
      assert.equal(
        result.evidence_sha256,
        await sha256(JSON.stringify({ status: 400, body }))
      )
      assert.equal(result.diagnostics?.http_status, 400)
      assert.equal(result.diagnostics?.body_state, 'unstructured')
      assert.equal(result.diagnostics?.google_status, null)
      assert.equal(JSON.stringify(result).includes('private-fixture'), false)
    }
  )
}
for (const status of [400, 503]) {
  for (const [name, bytes] of [
    ['oversized', new Uint8Array(32769)],
    ['invalid UTF-8', new Uint8Array([0xff])],
  ] as const) {
    Deno.test(
      `HTTP ${status} ${name} remains unknown with only available status retained`,
      async () => {
        let calls = 0
        const transport = createGeminiTransport({
          apiKey: secret,
          fetch: () => {
            calls++
            return Promise.resolve(new Response(bytes, { status }))
          },
        })
        const result = await transport.invoke(await request(), 'fixture')
        assert.equal(result.kind, 'provider-outcome-unknown')
        if (result.kind !== 'provider-outcome-unknown')
          throw new Error('unexpected-outcome')
        assert.equal(result.evidence_sha256, null)
        assert.equal(result.diagnostics?.http_status, status)
        assert.equal(result.diagnostics?.body_state, 'unavailable')
        assert.equal(result.diagnostics?.google_status, null)
        assert.equal(calls, 1)
      }
    )
  }
}
