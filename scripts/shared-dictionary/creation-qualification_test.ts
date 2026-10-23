import assert from 'node:assert/strict'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { sha256 } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  CREATION_CANDIDATE_MODELS,
  prepareCreationQualification,
  creationJudgeRequest,
  scoreCreationJudge,
} from './creation-qualification.ts'
import {
  verifyCreationQualification,
  saveCreationQualification,
} from './creation-qualification-cli.ts'

const ENGLISH_TRANSLATIONS = 'translations-en'

Deno.test(
  'creation packet covers42 cases and48 bounded distinct-model grant requests',
  async () => {
    const { packet, packet_sha256 } = await prepareCreationQualification()
    assert.equal(await sha256(canonicalizeJson(packet)), packet_sha256)
    assert.equal(packet.corpus.length, 42)
    assert.equal(packet.requests.length, 44)
    assert.equal(packet.guards.length, 2)
    assert.equal(
      packet.requests.filter(r => r.phase === 'judgement').length,
      40
    )
    assert.equal(packet.qualified, false)
    assert.equal(packet.approved_for_execution, false)
    assert.equal(packet.limits.maximum_run_reservation_usd, 13.44)
    assert.notEqual(
      packet.profile.generation_model,
      packet.profile.judgement_model
    )
    assert.notEqual(
      packet.profile.generation_model_version,
      packet.profile.judgement_model_version
    )
    for (const row of packet.requests) {
      assert.ok(
        new TextEncoder().encode(row.request.body).byteLength <=
          packet.limits.max_request_bytes
      )
      assert.equal(row.request.grant_input_sha256, row.grant.input_sha256)
    }
  }
)
Deno.test(
  'actual generation produces freshly bound contingent judge; wrong version and identity refuse',
  async () => {
    const { packet } = await prepareCreationQualification()
    const parent = packet.requests.find(r => r.phase === 'generation')!
    const judge = await creationJudgeRequest(
      parent,
      parent.context.result,
      packet.profile
    )
    assert.ok(judge)
    assert.equal(
      judge.grant.input.result_sha256,
      await sha256(canonicalizeJson(parent.context.result))
    )
    assert.equal(
      judge.grant.input.generation_input_sha256,
      parent.grant.input_sha256
    )
    assert.equal(
      await creationJudgeRequest(
        parent,
        {
          ...parent.context.result,
          provider_response: {
            modelVersion: CREATION_CANDIDATE_MODELS.judgement_model_version,
          },
        },
        packet.profile
      ),
      null
    )
    assert.equal(
      await creationJudgeRequest(
        parent,
        {
          ...parent.context.result,
          content: {
            ...(parent.context.result.content as Record<string, unknown>),
            dutch_lemma: 'other',
          },
        },
        packet.profile
      ),
      null
    )
    const verdict = {
      schema_version: 1,
      anchor_sha256: judge.context.input.anchor.anchor_sha256,
      content_sha256: judge.grant.input.content_sha256,
      result_sha256: judge.grant.input.result_sha256,
      decision: 'same-meaning',
      checks: [
        ENGLISH_TRANSLATIONS,
        'translations-ru',
        'examples',
        'related-words',
        'notes',
        'grammar',
      ].map(dimension => ({
        dimension,
        verdict: 'preserved',
        reason: 'Synthetic verification only.',
        anchor_quote: judge.context.input.anchor.gloss,
      })),
    }
    assert.equal(
      scoreCreationJudge(
        judge,
        {
          content: verdict,
          provider_response: {
            modelVersion: packet.profile.judgement_model_version,
          },
        },
        packet.profile
      ).decision,
      'same-meaning'
    )
    assert.equal(
      scoreCreationJudge(
        judge,
        {
          content: verdict,
          provider_response: {
            modelVersion: packet.profile.generation_model_version,
          },
        },
        packet.profile
      ).decision,
      'invalid'
    )
  }
)
Deno.test(
  'an extra related idiom is retained in the judge input and a contradiction blocks acceptance',
  async () => {
    const { packet } = await prepareCreationQualification()
    const parent = packet.requests.find(
      row => row.id === 'generation-expanded-positive-de-knoop-doorhakken'
    )!
    const result = structuredClone(parent.context.result)
    const content = result.content as {
      translations: { en: string[] }
    }
    content.translations.en.push('to bite the bullet')
    const before = structuredClone(result)
    const judge = await creationJudgeRequest(parent, result, packet.profile)
    assert.ok(judge)
    assert.deepEqual(result, before)
    const payload = JSON.parse(
      JSON.parse(judge.request.body).contents[0].parts[0].text
    )
    assert.deepEqual(payload.creation_input.candidate, result.content)
    assert.ok(
      payload.candidate_text_fields.some(
        (field: { path: string; value: string }) =>
          field.path.startsWith('/candidate/translations/en/') &&
          field.value === 'to bite the bullet'
      )
    )
    const verdict = {
      schema_version: 1,
      anchor_sha256: judge.context.input.anchor.anchor_sha256,
      content_sha256: judge.grant.input.content_sha256,
      result_sha256: judge.grant.input.result_sha256,
      decision: 'different-meaning',
      checks: [
        ENGLISH_TRANSLATIONS,
        'translations-ru',
        'examples',
        'related-words',
        'notes',
        'grammar',
      ].map(dimension => ({
        dimension,
        verdict:
          dimension === ENGLISH_TRANSLATIONS ? 'contradicted' : 'preserved',
        reason:
          'Synthetic replay of the reviewed additional-translation rejection.',
        anchor_quote: judge.context.input.anchor.gloss,
      })),
    }
    assert.equal(
      scoreCreationJudge(
        judge,
        {
          content: verdict,
          provider_response: {
            modelVersion: packet.profile.judgement_model_version,
          },
        },
        packet.profile
      ).decision,
      'different-meaning'
    )
  }
)
Deno.test(
  'creation preparation is write-once; scope tampering fails local exact verification',
  async () => {
    const folder = await Deno.makeTempDir({ prefix: 'creation-packet-' })
    try {
      const path = `${folder}/packet.json`
      const hash = await saveCreationQualification(path)
      assert.equal(await verifyCreationQualification(path), hash)
      await assert.rejects(
        saveCreationQualification(path),
        Deno.errors.AlreadyExists
      )
      const saved = JSON.parse(await Deno.readTextFile(path))
      saved.packet.execution_scope.workflow = 'dictionary-analysis'
      await Deno.writeTextFile(path, JSON.stringify(saved))
      await assert.rejects(verifyCreationQualification(path), /packet-mismatch/)
    } finally {
      await Deno.remove(folder, { recursive: true })
    }
  }
)
