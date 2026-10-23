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
import type { CreationPilotPacket } from '../../../scripts/shared-dictionary/creation-pilot-packet.ts'

const ORIGINAL =
  'reports/shared-dictionary-cefr/d13a7-creation-day-pilot-20261011/live-run'
Deno.test(
  'creation fixed dimensions reject the real duplicate; original strict verdict remains invalid',
  async () => {
    const old: CreationPilotPacket = JSON.parse(
      await Deno.readTextFile(`${ORIGINAL}/packet.json`)
    )
    const schema =
      CREATION_JUDGEMENT_RESPONSE_SCHEMA.properties.content.properties.checks
    assert.equal(schema.minItems, 6)
    assert.equal(schema.maxItems, 6)
    assert.deepEqual(
      schema.prefixItems.map(item => item.properties.dimension.enum),
      SEMANTIC_DIMENSIONS.map(d => [d])
    )
    for (const id of ['positive-1-1', 'positive-notes-1-1', 'positive-2-1']) {
      const receipt = JSON.parse(
        await Deno.readTextFile(`${ORIGINAL}/${id}.result.json`)
      )
      const dimensions = receipt.result.content.checks.map(
        (c: { dimension: string }) => c.dimension
      )
      const matches = dimensions.every((d: string, i: number) =>
        schema.prefixItems[i].properties.dimension.enum.some(
          value => value === d
        )
      )
      assert.equal(matches, id !== 'positive-2-1')
      const row = old.packet.requests.find(r => r.id === id)!
      assert.equal(
        scoreCreationJudge(row, receipt.result, old.packet.profile).decision,
        matches ? 'same-meaning' : 'invalid'
      )
    }
  }
)
Deno.test(
  'every prepared creation judge binds tuple schema and direct-analysis schema stays unchanged',
  async () => {
    const packet = await prepareCreationQualification()
    const old: CreationPilotPacket = JSON.parse(
      await Deno.readTextFile(`${ORIGINAL}/packet.json`)
    )
    const oldSchema = JSON.parse(old.packet.requests[0].request.body)
      .generationConfig.responseFormat.text.schema
    assert.deepEqual(SEMANTIC_RESPONSE_SCHEMA, oldSchema)
    assert.notEqual(
      packet.packet.profile.policy_sha256,
      old.packet.profile.policy_sha256
    )
    assert.notEqual(
      packet.packet.profile.prompt_sha256,
      old.packet.profile.prompt_sha256
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
