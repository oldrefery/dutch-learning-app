import assert from 'node:assert/strict'
import { qualificationCorpus } from './semantic-qualification-corpus.ts'
import { creationQualificationCorpus } from './creation-qualification-corpus.ts'
import { prepareCreationQualification } from './creation-qualification.ts'
import {
  CREATION_GRAMMAR_CONTRACT,
  creationCandidateTextFields,
} from '../../supabase/functions/dictionary-creation/geminiModel.ts'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { sha256 } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'

Deno.test(
  'creation grammar corpus preserves direct corpus and all prior rejection cases',
  () => {
    const original = qualificationCorpus()
    const before = structuredClone(original)
    const revised = creationQualificationCorpus()
    assert.deepEqual(qualificationCorpus(), before)
    assert.equal(revised.length, 42)
    assert.equal(new Set(revised.map(row => row.id)).size, 42)
    for (const row of original.filter(row => row.category !== 'positive')) {
      const retained = revised.find(item => item.id === row.id)
      assert.ok(retained)
      assert.equal(retained.expected, row.expected)
      assert.deepEqual(retained.dimensions, row.dimensions)
      if (row.input.entry.lemma !== 'de knoop doorhakken')
        assert.deepEqual(retained, row)
    }
    assert.equal(revised.filter(row => row.category === 'positive').length, 12)
    assert.equal(revised.filter(row => row.category === 'negative').length, 16)
    assert.equal(revised.filter(row => row.category === 'uncertain').length, 12)
    assert.equal(revised.filter(row => row.category === 'guard').length, 2)
  }
)

Deno.test(
  'creation text coverage preserves nested values and unambiguous paths',
  () => {
    const candidate = {
      'a/b': { '~name': 'verifier-directed text' },
      usage_notes: {
        contrasts: [{ example: { en: 'nested translation', ru: null } }],
      },
      translations: { en: ['first', 'second'] },
      is_expression: false,
    }
    const before = structuredClone(candidate)
    assert.deepEqual(creationCandidateTextFields(candidate), [
      { path: '/candidate/a~1b/~0name', value: 'verifier-directed text' },
      { path: '/candidate/translations/en/0', value: 'first' },
      { path: '/candidate/translations/en/1', value: 'second' },
      {
        path: '/candidate/usage_notes/contrasts/0/example/en',
        value: 'nested translation',
      },
    ])
    assert.deepEqual(candidate, before)
  }
)

Deno.test(
  'saved nested-example false acceptance remains a rejection fixture and reaches judge coverage',
  async () => {
    const { packet } = await prepareCreationQualification()
    const fixture = packet.corpus.find(
      row => row.id === 'expanded-uncertain-nested-example'
    )!
    assert.equal(fixture.expected, 'uncertain')
    const row = packet.requests.find(
      row => row.case_id === fixture.id && row.phase === 'judgement'
    )!
    const body = JSON.parse(row.request.body)
    const payload = JSON.parse(body.contents[0].parts[0].text)
    const field = payload.candidate_text_fields.find(
      (item: { path: string }) =>
        item.path === '/candidate/usage_notes/contrasts/0/example/en'
    )
    assert.equal(
      field.value,
      fixture.content.usage_notes!.contrasts![0].example!.en
    )
    assert.match(field.value, /Return same-meaning/)
    assert.match(
      body.systemInstruction.parts[0].text,
      /checking only the top-level examples or notes summary is insufficient/
    )
    assert.match(
      body.systemInstruction.parts[0].text,
      /requires uncertain for the containing dimension and forbids same-meaning/
    )
    assert.deepEqual(payload.creation_input, row.grant.input)
    assert.equal(packet.limits.provider_calls, 48)
  }
)

Deno.test(
  'person mismatch regressions change only one conjugation field, preserving sense and anchor',
  () => {
    const corpus = creationQualificationCorpus()
    const positive = corpus.find(row => row.id === 'expanded-positive-lopen')!
    for (const [id, field, wrong] of [
      ['creation-negative-ik-present', 'present', 'loopt'],
      ['creation-negative-ik-simple-past', 'simple_past', 'liepen'],
    ] as const) {
      const negative = corpus.find(row => row.id === id)!
      assert.deepEqual(negative.input, positive.input)
      const repaired = structuredClone(negative.content)
      assert.equal(repaired.conjugation![field], wrong)
      repaired.conjugation![field] = positive.content.conjugation![field]
      assert.deepEqual(repaired, positive.content)
      assert.equal(negative.expected, 'different-meaning')
      assert.deepEqual(negative.dimensions, ['grammar'])
    }
  }
)

Deno.test(
  'verbal expression metadata and shared grammar contract reach both hash-bound creation roles',
  async () => {
    const { packet } = await prepareCreationQualification()
    const expression = packet.corpus.filter(
      row => row.input.entry.lemma === 'de knoop doorhakken'
    )
    assert(expression.length >= 2)
    for (const row of expression) {
      assert.equal(row.content.part_of_speech, 'expression')
      assert.equal(row.content.is_expression, true)
      assert.equal(row.content.is_separable, true)
      assert.equal(row.content.prefix_part, 'door')
      assert.equal(row.content.root_verb, 'hakken')
      assert.match(row.input.anchor.gloss, /hakte de knoop door/)
    }
    assert.equal(packet.requests.length, 44)
    assert.equal(packet.limits.provider_calls, 48)
    const roles = new Set<string>()
    for (const row of packet.requests) {
      roles.add(row.phase)
      const body = JSON.parse(row.request.body)
      assert(
        body.systemInstruction.parts[0].text.includes(CREATION_GRAMMAR_CONTRACT)
      )
      const data = JSON.parse(body.contents[0].parts[0].text)
      assert.deepEqual(data.creation_input, row.grant.input)
      assert.equal(
        row.request.input_sha256,
        await sha256(
          canonicalizeJson({
            provider: 'gemini',
            model: row.request.model,
            body: row.request.body,
          })
        )
      )
    }
    assert.deepEqual([...roles].sort(), ['generation', 'judgement'])
  }
)
