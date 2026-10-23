import assert from 'node:assert/strict'
import {
  SEMANTIC_RESPONSE_SCHEMA,
  SEMANTIC_DIMENSIONS,
} from '../dictionary-analysis/responseSchemas.ts'
import { CREATION_JUDGEMENT_RESPONSE_SCHEMA } from './responseSchema.ts'
import {
  prepareCreationQualification,
  scoreCreationJudge,
} from '../../../scripts/shared-dictionary/creation-qualification.ts'
import legacy from './fixtures/legacy-judge-schema.json' with { type: 'json' }

// Retain only public schema, policy hashes and dimension sequences from the
// synthetic regression; historical provider receipts remain private artifacts.
Deno.test(
  'creation fixed dimensions reject the observed duplicate in a portable synthetic verdict',
  async () => {
    const { packet } = await prepareCreationQualification()
    const schema =
      CREATION_JUDGEMENT_RESPONSE_SCHEMA.properties.content.properties.checks
    assert.equal(schema.minItems, 6)
    assert.equal(schema.maxItems, 6)
    assert.deepEqual(
      schema.prefixItems.map(item => item.properties.dimension.enum),
      SEMANTIC_DIMENSIONS.map(d => [d])
    )
    for (const { id, dimensions, expected_decision } of legacy.cases) {
      const matches = dimensions.every((dimension, index) =>
        schema.prefixItems[index].properties.dimension.enum.some(
          value => value === dimension
        )
      )
      assert.equal(matches, expected_decision === 'same-meaning')
      const row = packet.requests.find(request => request.id === id)
      assert.ok(row)
      const result = {
        provider_response: {
          modelVersion: packet.profile.judgement_model_version,
        },
        content: {
          schema_version: 1,
          anchor_sha256: row.context.input.anchor.anchor_sha256,
          content_sha256: row.grant.input.content_sha256,
          result_sha256: row.context.receipt.result_sha256,
          decision: 'same-meaning',
          checks: dimensions.map(dimension => ({
            dimension,
            verdict: 'preserved',
            reason: 'Synthetic protected-sense evidence is preserved.',
            anchor_quote: row.context.input.anchor.gloss,
          })),
        },
      }
      assert.equal(
        scoreCreationJudge(row, result, packet.profile).decision,
        expected_decision
      )
      if (expected_decision === 'invalid') {
        result.content.checks[2].dimension = 'examples'
        assert.equal(
          scoreCreationJudge(row, result, packet.profile).decision,
          'same-meaning'
        )
      }
    }
  }
)
Deno.test(
  'every prepared creation judge binds tuple schema and direct-analysis schema stays unchanged',
  async () => {
    const packet = await prepareCreationQualification()
    assert.deepEqual(SEMANTIC_RESPONSE_SCHEMA, legacy.analysis_schema)
    assert.notEqual(
      packet.packet.profile.policy_sha256,
      legacy.legacy_policy_sha256
    )
    assert.notEqual(
      packet.packet.profile.prompt_sha256,
      legacy.legacy_prompt_sha256
    )
    for (const row of packet.packet.requests.filter(
      row => row.phase === 'judgement'
    )) {
      const body = JSON.parse(row.request.body)
      assert.deepEqual(
        body.generationConfig.responseFormat.text.schema,
        CREATION_JUDGEMENT_RESPONSE_SCHEMA
      )
      assert.match(body.systemInstruction.parts[0].text, /this exact order/)
    }
  }
)
