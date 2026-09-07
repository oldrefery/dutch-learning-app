import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseSnapshot,
  validateSnapshot,
  contentHash,
  normalize,
} from './snapshot.mjs'
import { parseLexicon, matchEvidence } from './lexicon.mjs'
import { buildReport, exclusionCandidate } from './report.mjs'

const ownerId = '11111111-1111-4111-8111-111111111111'
const protectedId = '22222222-2222-4222-8222-222222222222'
const collectionId = '33333333-3333-4333-8333-333333333333'
const wordId = '44444444-4444-4444-8444-444444444444'
const capturedAt = '2026-09-07T09:00:00Z'
const options = { ownerId, protectedId, expectedCards: 1 }
const source =
  'word\ttag\tF@TOTAL\tF@A1\tF@A2\tF@B1\tF@B2\tF@C1\n' +
  'huis\tN(soort)\t10\t0\t4\t6\t-\t-\n' +
  'huis\tWW(inf)\t1\t-\t-\t-\t-\t1\n'

function card(overrides = {}) {
  return {
    word_id: wordId,
    collection_id: collectionId,
    dutch_lemma: 'huis',
    part_of_speech: 'noun',
    translations: { en: 'house' },
    is_expression: false,
    expression_type: null,
    updated_at: capturedAt,
    ...overrides,
  }
}

function snapshot() {
  return {
    schemaVersion: 1,
    matchedAccounts: 1,
    ownerId,
    capturedAt,
    cards: [card()],
    collections: [
      { collection_id: collectionId, is_shared: true },
      { collection_id: protectedId, is_shared: false },
    ],
  }
}

test('round-trips the single-cell CSV with BOM, quotes and multiline content', () => {
  const data = snapshot()
  data.cards[0].translations.en = 'a "house"\nand its garden'
  const json = JSON.stringify(data, null, 2)
  const csv = `\uFEFFsnapshot\r\n"${json.replaceAll('"', '""')}"\r\n`
  assert.deepEqual(parseSnapshot(csv), data)
  assert.deepEqual(parseSnapshot(json), data)
})

test('rejects extra CSV records and unsupported headers', () => {
  assert.throws(() => parseSnapshot('snapshot\n"{}"\n"{}"'))
  assert.throws(() => parseSnapshot('word\n"huis"'), /Expected/u)
  assert.throws(() => parseSnapshot('snapshot\n{}'), /quoted/u)
})

test('validates a complete snapshot and permits unassigned cards', () => {
  const data = snapshot()
  validateSnapshot(data, options)
  data.cards[0].collection_id = null
  validateSnapshot(data, options)
})

const invalidSnapshots = [
  [
    'multiple owners',
    data => {
      data.matchedAccounts = 2
    },
  ],
  [
    'wrong owner',
    data => {
      data.ownerId = collectionId
    },
  ],
  [
    'wrong version',
    data => {
      data.schemaVersion = 2
    },
  ],
  [
    'missing card',
    data => {
      data.cards = []
    },
  ],
  [
    'missing protected collection',
    data => {
      data.collections.pop()
    },
  ],
  [
    'foreign membership',
    data => {
      data.cards[0].collection_id = ownerId
    },
  ],
  [
    'duplicate collection',
    data => {
      data.collections.push(data.collections[0])
    },
  ],
  [
    'missing timestamp',
    data => {
      delete data.capturedAt
    },
  ],
  [
    'missing expression flag',
    data => {
      delete data.cards[0].is_expression
    },
  ],
  [
    'missing translations',
    data => {
      delete data.cards[0].translations
    },
  ],
]
for (const [name, change] of invalidSnapshots) {
  test(`rejects ${name}`, () => {
    const data = snapshot()
    change(data)
    assert.throws(() => validateSnapshot(data, options))
  })
}

test('rejects repeated card IDs even if the total count matches', () => {
  const data = snapshot()
  data.cards.push(card())
  assert.throws(
    () => validateSnapshot(data, { ...options, expectedCards: 2 }),
    /Duplicate card/u
  )
})

test('content hash is stable across key order and membership, but detects meaning edits', () => {
  const original = card()
  const reordered = Object.fromEntries(Object.entries(original).reverse())
  assert.equal(contentHash(original), contentHash(reordered))
  assert.equal(
    contentHash(original),
    contentHash(card({ collection_id: protectedId }))
  )
  assert.notEqual(
    contentHash(original),
    contentHash(card({ translations: { en: 'home' } }))
  )
  assert.equal(normalize('  HUIS  '), 'huis')
  assert.notEqual(normalize('café'), normalize('cafe'))
})

test('keeps missing frequency distinct from zero and matches POS', () => {
  const evidence = matchEvidence(card(), parseLexicon(source))
  assert.equal(evidence.matchType, 'lemma-and-pos')
  assert.equal(evidence.rows.length, 1)
  assert.equal(evidence.rows[0].counts.A1, 0)
  assert.equal(evidence.rows[0].counts.C1, null)
  assert.equal(evidence.estimatedCefr, null)
  assert.equal(evidence.senseVerified, false)
})

test('does not assign C2 or zero frequency to missing words', () => {
  const evidence = matchEvidence(
    card({ dutch_lemma: 'onbekend-testwoord' }),
    parseLexicon(source)
  )
  assert.equal(evidence.matchType, 'missing')
  assert.deepEqual(evidence.rows, [])
  assert.equal(evidence.estimatedCefr, null)
})

test('keeps incompatible POS and multiword tags as review candidates only', () => {
  const index = parseLexicon(source)
  assert.equal(
    matchEvidence(card({ part_of_speech: 'adverb' }), index).matchType,
    'lemma-only-review-required'
  )
  const multiwordIndex = parseLexicon(
    source.replace('N(soort)', 'N(soort) WW(inf)')
  )
  assert.equal(
    matchEvidence(card(), multiwordIndex).matchType,
    'lemma-only-review-required'
  )
})

test('rejects malformed source frequencies and incomplete rows', () => {
  assert.throws(
    () => parseLexicon(source.replace('\t10\t', '\tNaN\t')),
    /frequency/u
  )
  assert.throws(
    () => parseLexicon(source.replace('\t10\t', '\t-1\t')),
    /frequency/u
  )
  assert.throws(
    () => parseLexicon(source.replace('\t10\t', '\t\t')),
    /frequency/u
  )
  assert.throws(() => parseLexicon(`${source}huis\tN(soort)`), /width/u)
})

test('protects every card in the protected collection regardless of labels', () => {
  assert.equal(
    exclusionCandidate(
      card({ collection_id: protectedId, expression_type: 'compound' }),
      protectedId
    ),
    'protected-collection'
  )
})

test('distinguishes lexical compounds from expressions without final decisions', () => {
  assert.equal(
    exclusionCandidate(
      card({ is_expression: true, expression_type: 'compound' }),
      protectedId
    ),
    'lexical-compound-candidate'
  )
  assert.equal(
    exclusionCandidate(card({ expression_type: 'idiom' }), protectedId),
    'expression-candidate'
  )
  assert.equal(
    exclusionCandidate(
      card({ dutch_lemma: 'uit elkaar', expression_type: 'compound' }),
      protectedId
    ),
    'needs-review'
  )
})

test('reports duplicates without merging or mutating data and remains deterministic', () => {
  const data = snapshot()
  data.cards.push(card({ word_id: ownerId, collection_id: protectedId }))
  const before = structuredClone(data)
  const report = buildReport(data, parseLexicon(source), options)
  assert.deepEqual(data, before)
  assert.deepEqual(report, buildReport(data, parseLexicon(source), options))
  assert.deepEqual(report.duplicateLemmaPosGroups, [[wordId, ownerId]])
  assert.equal(report.cards[1].evidence, null)
  assert.equal(report.summary.productionWrites, 0)
  assert.equal(report.summary.finalizedEligibleCards, null)
  assert.equal(report.summary.estimatedCefrAssigned, 0)
})
