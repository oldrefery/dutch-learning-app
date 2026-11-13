import test from 'node:test'
import assert from 'node:assert/strict'
import {
  prepareOwnerPublicationContent,
  qualifyOwnerPublicationRevision,
} from './owner-publication-contract.mjs'

const source = () => ({
  dutch_lemma: 'inzetten',
  dutch_original: '',
  part_of_speech: 'verb',
  article: null,
  plural: null,
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: true,
  prefix_part: null,
  root_verb: 'zetten',
  register: null,
  translations: { en: ['to deploy'], ru: ['использовать'] },
  examples: [
    {
      nl: 'De politie zette extra agenten in.',
      en: 'The police deployed extra officers.',
      ru: 'Полиция задействовала дополнительных офицеров.',
    },
  ],
  synonyms: [],
  antonyms: [],
  conjugation: {
    present: 'zet',
    simple_past: 'zette',
    past_participle: 'ingezet',
  },
  preposition: null,
  image_url: null,
  tts_url: null,
  analysis_notes: '',
  usage_notes: null,
})
const prefix = { lemma: 'inzetten', root: 'zetten', prefix: 'in' }
const envelope = prepared => ({
  revision_id: '00000000-0000-4000-8000-000000000001',
  entry_id: '00000000-0000-4000-8000-000000000002',
  revision_no: 2,
  schema_version: 1,
  review_status: 'published',
  content: prepared.content,
  content_sha256: prepared.content_sha256,
  cefr_input_sha256: prepared.cefr_input_sha256,
})
test('completes explicit optional values and reviewed prefix without changing the source', () => {
  const original = source(),
    before = structuredClone(original)
  const prepared = prepareOwnerPublicationContent(original, prefix)
  assert.deepEqual(original, before)
  assert.deepEqual(prepared.content, {
    ...before,
    dutch_original: null,
    analysis_notes: null,
    prefix_part: 'in',
    conjugation: { ...before.conjugation, simple_past_plural: null },
  })
  assert.deepEqual(
    qualifyOwnerPublicationRevision(envelope(prepared)),
    envelope(prepared)
  )
})
test('missing separable prefix is not guessed automatically', () => {
  assert.throws(() => prepareOwnerPublicationContent(source()), /prefix_part/)
})
test('mismatched reviewed prefix evidence is refused', () => {
  for (const changed of [
    { ...prefix, prefix: 'aan' },
    { ...prefix, root: 'doen' },
    { ...prefix, lemma: 'aandoen' },
  ])
    assert.throws(
      () => prepareOwnerPublicationContent(source(), changed),
      /does not match/
    )
  const input = source()
  input.examples = []
  assert.throws(
    () => prepareOwnerPublicationContent(input, prefix),
    /does not match/
  )
})
test('existing nonempty fields and arrays are retained, including usage and expression fields', () => {
  const input = {
    ...source(),
    prefix_part: 'in',
    dutch_original: 'inzetten',
    analysis_notes: 'Owner note',
    usage_notes: { summary: 'Existing usage', contrasts: [] },
    conjugation: { ...source().conjugation, simple_past_plural: 'zetten' },
  }
  assert.deepEqual(prepareOwnerPublicationContent(input).content, input)
})
test('other malformed fields remain errors instead of being silently rewritten', () => {
  assert.throws(
    () =>
      prepareOwnerPublicationContent(
        { ...source(), translations: null },
        prefix
      ),
    /translations/
  )
})
test('full revision metadata is checked, not just lexical content', () => {
  const revision = envelope(prepareOwnerPublicationContent(source(), prefix))
  assert.throws(
    () => qualifyOwnerPublicationRevision({ ...revision, schema_version: 99 }),
    /Invalid client revision/
  )
  assert.throws(
    () => qualifyOwnerPublicationRevision({ ...revision, revision_no: 0 }),
    /Invalid client revision/
  )
})
test('content or CEFR hash drift prevents qualification', () => {
  const revision = envelope(prepareOwnerPublicationContent(source(), prefix))
  for (const field of ['content_sha256', 'cefr_input_sha256'])
    assert.throws(
      () =>
        qualifyOwnerPublicationRevision({
          ...revision,
          [field]: '0'.repeat(64),
        }),
      /hash mismatch/
    )
})
