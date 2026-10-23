import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { qualificationCorpus } from '../../../scripts/shared-dictionary/semantic-qualification-corpus.ts'
import { contextFor } from '../../../scripts/shared-dictionary/semantic-qualification.ts'
import { journalPacket } from './geminiTransport.ts'
import { inspectCandidate } from './candidateGuards.ts'
import {
  GENERATION_SYSTEM_PROMPT,
  prepareGeminiRequest,
} from './protectedInput.ts'
import { buildSemanticPolicy, prepareSemanticRequest } from './semanticModel.ts'
import {
  GENERATION_RESPONSE_SCHEMA,
  SEMANTIC_RESPONSE_SCHEMA,
  type ResponseSchema,
} from './responseSchemas.ts'

const require = createRequire(import.meta.url)
const Ajv = require('ajv') as new () => {
  compile(schema: ResponseSchema): (value: unknown) => boolean
}
const validator = new Ajv()
const generationValid = validator.compile(GENERATION_RESPONSE_SCHEMA)
const semanticValid = validator.compile(SEMANTIC_RESPONSE_SCHEMA)
const fixture = qualificationCorpus()[0]
const providerEnvelope = (part: Record<string, unknown>) => ({
  responseId: 'synthetic-signature-response',
  candidates: [{ finishReason: 'STOP', content: { parts: [part] } }],
})
Deno.test(
  'text with opaque thought signature is parsed while the original envelope remains exact',
  () => {
    const envelope = providerEnvelope({
      text: JSON.stringify({ content: fixture.content }),
      thoughtSignature: 'c2lnbmF0dXJl',
    })
    const result = journalPacket(JSON.stringify(envelope))
    assert.deepEqual(result.content, fixture.content)
    assert.deepEqual(result.provider_response, envelope)
  }
)
for (const metadata of [
  { thoughtSignature: 7 },
  { thoughtSignature: {} },
  { thought: 'false' },
  { thoughtSignature: 'opaque', functionCall: { name: 'untrusted' } },
])
  Deno.test(
    `malformed or executable part metadata remains rejected: ${JSON.stringify(metadata)}`,
    () => {
      const envelope = providerEnvelope({
        text: JSON.stringify({ content: fixture.content }),
        ...metadata,
      })
      const result = journalPacket(JSON.stringify(envelope))
      assert.equal(result.content, null)
      assert.deepEqual(result.provider_response, envelope)
    }
  )
Deno.test(
  'provider schema accepts all positive fixtures and fully shaped nullable contrast examples',
  () => {
    for (const item of qualificationCorpus().filter(
      row => row.category === 'positive'
    ))
      assert.equal(generationValid({ content: item.content }), true, item.id)
    for (const example of [
      null,
      { nl: 'Ik leen geld.', en: 'I borrow money.', ru: null },
    ]) {
      const content = {
        ...fixture.content,
        usage_notes: {
          summary: 'Financial sense.',
          contrasts: [
            {
              term: 'bank',
              distinction: 'A seat is a different sense.',
              example,
            },
          ],
        },
      }
      assert.equal(generationValid({ content }), true)
    }
  }
)
Deno.test(
  'provider schema rejects the observed bare contrast example and extra nested keys',
  () => {
    for (const example of [
      'Hij zit op de bank.',
      { nl: 'Een bank.', en: 'A bank.', ru: null, confidence: 1 },
    ]) {
      const content = {
        ...fixture.content,
        usage_notes: {
          summary: 'Financial sense.',
          contrasts: [
            {
              term: 'bank',
              distinction: 'A seat is a different sense.',
              example,
            },
          ],
        },
      }
      assert.equal(generationValid({ content }), false)
    }
    assert.equal(
      generationValid({ content: { ...fixture.content, confidence: 1 } }),
      false
    )
    assert.equal(
      generationValid({
        content: {
          ...fixture.content,
          translations: { en: ['bank'], ru: ['банк'], confidence: 1 },
        },
      }),
      false
    )
  }
)
Deno.test(
  'exact judge schema rejects observed candidate_sha256 extra and substitution',
  async () => {
    const ctx = await contextFor(fixture)
    const good = {
      schema_version: 1,
      anchor_sha256: ctx.input.anchor.anchor_sha256,
      content_sha256: 'a'.repeat(64),
      result_sha256: ctx.receipt.result_sha256,
      decision: 'same-meaning',
      checks: [
        'translations-en',
        'translations-ru',
        'examples',
        'related-words',
        'notes',
        'grammar',
      ].map(dimension => ({
        dimension,
        verdict: 'preserved',
        reason: 'Grounded.',
        anchor_quote: 'financial institution',
      })),
    }
    assert.equal(semanticValid({ content: good }), true)
    assert.equal(
      semanticValid({ content: { ...good, candidate_sha256: null } }),
      false
    )
    const { content_sha256, ...missing } = good
    assert.equal(
      semanticValid({
        content: { ...missing, candidate_sha256: content_sha256 },
      }),
      false
    )
    assert.equal(
      semanticValid({ content: { ...good, checks: good.checks.slice(1) } }),
      false
    )
  }
)
Deno.test(
  'both requests use current structured responseFormat with the full JSON schema and unchanged call limits',
  async () => {
    const ctx = await contextFor(fixture),
      candidate = await inspectCandidate(ctx, [])
    assert.equal(candidate.valid, true)
    if (!candidate.valid) return
    const requests = [
      [
        await prepareGeminiRequest(ctx.input, 'gemini-fixture-model'),
        GENERATION_RESPONSE_SCHEMA,
      ],
      [
        await prepareSemanticRequest(
          ctx,
          candidate,
          await buildSemanticPolicy(
            'gemini-fixture-model',
            [],
            'gemini-fixture-model',
            {
              generation: 'gemini-fixture-model',
              judge: 'gemini-fixture-model',
            }
          )
        ),
        SEMANTIC_RESPONSE_SCHEMA,
      ],
    ] as const
    for (const [request, schema] of requests) {
      const config = JSON.parse(request.body).generationConfig
      assert.deepEqual(config, {
        candidateCount: 1,
        maxOutputTokens: 8192,
        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } },
      })
    }
    assert.match(
      GENERATION_SYSTEM_PROMPT,
      /contrast example is null or an object with exactly nl, en and ru/
    )
  }
)
Deno.test(
  'v2 qualification rejects stale or altered policy before preparing a provider request',
  async () => {
    const ctx = await contextFor(fixture),
      candidate = await inspectCandidate(ctx, []),
      policy = await buildSemanticPolicy(
        'gemini-fixture-model',
        [],
        'gemini-fixture-model',
        { generation: 'gemini-fixture-model', judge: 'gemini-fixture-model' }
      )
    assert.equal(policy.validator_version, 'shared-meaning-independent-v3')
    if (!candidate.valid) throw new Error('Fixture invalid')
    for (const altered of [
      { ...policy, policy_sha256: '0'.repeat(64) },
      { ...policy, validator_version: 'shared-meaning-independent-v1' },
    ])
      await assert.rejects(
        prepareSemanticRequest(ctx, candidate, altered),
        /invalid-semantic-policy/
      )
  }
)
