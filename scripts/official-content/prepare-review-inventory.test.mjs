import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildStableEntryId } from './build-vocabulary-packs.mjs'
import { createReviewInventory } from './prepare-review-inventory.mjs'

const REVIEW_TIMESTAMP = '2026-09-11T00:00:00.000Z'
const SYNTHETIC_NOTE = 'Synthetic.'

const sourceCard = {
  word_id: 'private-synthetic-id',
  dutch_lemma: 'leren',
  dutch_original: null,
  part_of_speech: 'verb',
  translations: { en: ['to learn'] },
  examples: [{ nl: 'Ik leer.', en: 'I learn.' }],
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  root_verb: null,
  article: null,
  register: 'neutral',
  preposition: null,
  analysis_notes: 'Review this note.',
  usage_notes: { synthetic: true },
  collection_id: 'private-collection',
}

const entry = {
  entry_id: buildStableEntryId(sourceCard),
  dutch_lemma: 'leren',
  part_of_speech: 'verb',
  translations: { en: ['to learn'] },
  examples: [{ nl: 'Ik leer.', en: 'I learn.' }],
  is_reflexive: false,
  is_expression: false,
  is_separable: false,
  article: null,
  register: 'neutral',
  analysis_notes: 'Review this note.',
}

const manifest = {
  schema_version: 1,
  pack_id: 'dutch-a1-01',
  version: '1.0.0',
  title: 'Dutch A1 · Pack 01',
  description: 'Synthetic draft.',
  source_language: 'nl',
  translation_languages: ['en'],
  created_at: REVIEW_TIMESTAMP,
  license: { name: 'Test', url: null, notes: SYNTHETIC_NOTE },
  provenance: {
    origin: 'existing-project-library',
    source_snapshot_at: REVIEW_TIMESTAMP,
    source_card_count: 1,
    source_unique_semantic_count: 1,
    selection_method: SYNTHETIC_NOTE,
    notes: SYNTHETIC_NOTE,
    excluded_sources: ['Private data'],
  },
  content_review: {
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    notes: 'Pending.',
  },
  entries: [entry],
}

const essentialsManifest = {
  ...manifest,
  pack_id: 'official-dutch-a1-essentials',
  version: '0.2.0',
  content_review: {
    status: 'approved',
    reviewed_by: 'synthetic-reviewer',
    reviewed_at: REVIEW_TIMESTAMP,
    notes: 'Approved synthetic fixture.',
  },
  entries: [
    {
      ...entry,
      entry_id: 'essential-leren',
      is_irregular: false,
      conjugation: null,
    },
  ],
}

const fixture = () => ({
  draftIndex: {
    draftAggregateSha256: 'draft-aggregate',
    entryCount: 1,
    catalog: [
      {
        pack_id: manifest.pack_id,
        version: manifest.version,
        cefr_level: 'A1',
      },
    ],
  },
  packs: [{ manifest }],
  snapshot: {
    capturedAt: REVIEW_TIMESTAMP,
    cards: [sourceCard],
  },
  plan: {
    mappings: [
      {
        wordId: sourceCard.word_id,
        inputHash: 'source-card-hash',
        targetKey: 'A1-01',
        estimatedCefr: 'A1',
        everydayUsefulness: 'high',
        frequency: { status: 'observed', zipf: 5 },
        orderingFrequency: 5,
      },
    ],
  },
  classification: {
    cards: [
      {
        wordId: sourceCard.word_id,
        inputHash: 'source-card-hash',
        confidence: 'low',
        qualityNote: 'Review spelling or sense.',
      },
    ],
  },
  essentialsManifest,
})

test('creates a complete needs-review inventory with priority evidence', () => {
  const { inventory, ledger } = createReviewInventory(fixture())
  const reviewEntry = inventory.packs[0].batches[0].entries[0]

  assert.equal(inventory.entryCount, 1)
  assert.equal(inventory.summary.reviewDecisionCounts.needsReview, 1)
  assert.equal(reviewEntry.batchId, 'dutch-a1-01-batch-01')
  assert.deepEqual(reviewEntry.unresolvedLinguisticFields, [
    'is_irregular',
    'conjugation',
  ])
  assert.deepEqual(reviewEntry.priorityFlags, [
    'unresolved-linguistic-fields',
    'known-quality-concern',
    'low-cefr-confidence',
    'omitted-usage-notes',
    'has-analysis-notes',
    'essentials-overlap',
  ])
  assert.equal(reviewEntry.draftEntry, entry)
  assert.equal(ledger.decisions[0].decision, 'needs-review')
  assert.equal(ledger.reviewedBy, null)
})

test('rejects evidence mapped to the wrong pack', () => {
  const input = fixture()
  input.plan.mappings[0].targetKey = 'A2-01'
  assert.throws(() => createReviewInventory(input), /Review evidence mismatch/)
})

test('requires review batches between twenty and thirty entries', () => {
  assert.throws(
    () => createReviewInventory({ ...fixture(), batchSize: 10 }),
    /between 20 and 30/
  )
})

test('balances a 101-entry pack without a one-entry final batch', () => {
  const input = fixture()
  input.draftIndex.entryCount = 101
  input.packs[0].manifest = {
    ...manifest,
    entries: Array.from({ length: 101 }, (_, index) => ({
      ...entry,
      entry_id: `entry-${index}`,
    })),
  }
  input.snapshot.cards = Array.from({ length: 101 }, (_, index) => ({
    ...sourceCard,
    word_id: `source-${index}`,
  }))
  input.plan.mappings = input.snapshot.cards.map(card => ({
    ...input.plan.mappings[0],
    wordId: card.word_id,
  }))
  input.classification.cards = input.snapshot.cards.map(card => ({
    ...input.classification.cards[0],
    wordId: card.word_id,
  }))
  input.packs[0].manifest.entries = input.snapshot.cards.map((card, index) => ({
    ...entry,
    entry_id: buildStableEntryId(card),
    dutch_lemma: `leren${index}`,
  }))
  input.essentialsManifest = {
    ...essentialsManifest,
    entries: [
      {
        ...essentialsManifest.entries[0],
        dutch_lemma: 'huis',
        part_of_speech: 'noun',
        article: 'het',
      },
    ],
  }

  const { inventory } = createReviewInventory(input)
  assert.deepEqual(
    inventory.packs[0].batches.map(batch => batch.entryCount),
    [26, 25, 25, 25]
  )
})
