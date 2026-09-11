import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildPackManifest,
  parseSnapshotCsv,
  sanitizeCard,
} from './build-vocabulary-packs.mjs'

const baseCard = {
  word_id: 'private-id',
  dutch_lemma: 'uitrekenen',
  dutch_original: null,
  part_of_speech: 'verb',
  translations: { en: ['to calculate'], ru: ['вычислять'] },
  examples: [{ nl: 'Ik reken het uit.', en: 'I calculate it.' }],
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: true,
  root_verb: 'rekenen',
  article: null,
  register: 'neutral',
  preposition: null,
  analysis_notes: null,
  collection_id: 'private-collection',
  updated_at: '2026-09-11T00:00:00Z',
}

test('parses the single-cell snapshot export', () => {
  const snapshot = parseSnapshotCsv(
    'snapshot\n"{\"\"cards\"\":[],\"\"capturedAt\"\":\"\"2026-09-11T00:00:00Z\"\"}"\n'
  )
  assert.deepEqual(snapshot.cards, [])
})

test('sanitizes personal fields and derives a separable prefix', () => {
  const entry = sanitizeCard('dutch-a2-01', baseCard)
  assert.equal(entry.prefix_part, 'uit')
  assert.equal(entry.root_verb, 'rekenen')
  assert.equal('word_id' in entry, false)
  assert.equal('collection_id' in entry, false)
  assert.equal('updated_at' in entry, false)
})

test('derives a documented prefix when a legacy lemma spelling differs', () => {
  const entry = sanitizeCard('dutch-b2-01', {
    ...baseCard,
    dutch_lemma: 'toerekennen',
    analysis_notes: "A separable verb with the prefix 'toe-' and root rekenen.",
  })
  assert.equal(entry.prefix_part, 'toe')
})

test('builds a valid pending manifest that cannot be published accidentally', () => {
  const manifest = buildPackManifest({
    collection: { targetKey: 'A2-01', level: 'A2' },
    cards: [baseCard],
    mappedCardCount: 1,
    snapshot: {
      capturedAt: '2026-09-11T00:00:00Z',
      cards: [baseCard],
    },
  })
  assert.equal(manifest.content_review.status, 'pending')
  assert.equal(manifest.content_review.reviewed_by, null)
  assert.equal(manifest.entries.length, 1)
})
