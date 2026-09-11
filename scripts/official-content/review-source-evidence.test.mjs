import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  analyzeEditorialSnapshot,
  enrichDraftEntry,
} from './review-source-evidence.mjs'

const BASELINE_TIME = '2026-09-07T00:00:00.000Z'
const EDITORIAL_TIME = '2026-09-11T00:00:00.000Z'

const baselineCard = {
  word_id: 'word-1',
  collection_id: 'collection-1',
  dutch_lemma: 'lopen',
  part_of_speech: 'verb',
  translations: { en: ['to walk'] },
  examples: [{ nl: 'Ik loop.', en: 'I walk.' }],
  updated_at: BASELINE_TIME,
}

const editorialCard = {
  ...baselineCard,
  updated_at: EDITORIAL_TIME,
  is_irregular: true,
  conjugation: {
    present: 'loop',
    simple_past: 'liep',
    simple_past_plural: 'liepen',
    past_participle: 'gelopen',
  },
  plural: null,
  synonyms: ['wandelen'],
  antonyms: ['stilstaan'],
}

const snapshots = () => ({
  baselineSnapshot: {
    matchedAccounts: 1,
    ownerId: 'owner-1',
    capturedAt: BASELINE_TIME,
    cards: [baselineCard],
  },
  editorialSnapshot: {
    matchedAccounts: 1,
    ownerId: 'owner-1',
    capturedAt: EDITORIAL_TIME,
    cards: [editorialCard],
  },
  mappedWordIds: [baselineCard.word_id],
})

test('binds complete linguistic evidence without treating timestamps as content', () => {
  const result = analyzeEditorialSnapshot(snapshots())
  const evidence = result.evidenceByWordId.get(baselineCard.word_id)

  assert.equal(result.summary.contentChangedCardCount, 0)
  assert.equal(result.summary.unresolvedMappedLinguisticCardCount, 0)
  assert.equal(evidence.contentChanged, false)
  assert.deepEqual(evidence.changedFields, [])
  assert.deepEqual(evidence.unresolvedLinguisticFields, [])
  assert.deepEqual(
    enrichDraftEntry(
      {
        entry_id: 'entry-1',
        dutch_lemma: 'lopen',
        part_of_speech: 'verb',
      },
      evidence
    ),
    {
      entry_id: 'entry-1',
      dutch_lemma: 'lopen',
      part_of_speech: 'verb',
      is_irregular: true,
      conjugation: editorialCard.conjugation,
      synonyms: editorialCard.synonyms,
      antonyms: editorialCard.antonyms,
    }
  )
})

test('records current source content when a mapped card changed', () => {
  const input = snapshots()
  input.editorialSnapshot.cards[0] = {
    ...editorialCard,
    translations: { en: ['to walk', 'to run'] },
  }

  const result = analyzeEditorialSnapshot(input)
  const evidence = result.evidenceByWordId.get(baselineCard.word_id)

  assert.equal(result.summary.contentChangedCardCount, 1)
  assert.equal(result.summary.mappedContentChangedCardCount, 1)
  assert.deepEqual(evidence.changedFields, ['translations'])
  assert.deepEqual(evidence.currentSourceContent.translations, {
    en: ['to walk', 'to run'],
  })
})

test('keeps an absent verb conjugation unresolved', () => {
  const input = snapshots()
  input.editorialSnapshot.cards[0] = {
    ...editorialCard,
    conjugation: null,
  }

  const result = analyzeEditorialSnapshot(input)

  assert.equal(result.summary.unresolvedMappedLinguisticCardCount, 1)
  assert.deepEqual(
    result.evidenceByWordId.get(baselineCard.word_id)
      .unresolvedLinguisticFields,
    ['conjugation']
  )
})

test('rejects owner mismatches, missing cards, and incomplete fields', () => {
  const wrongOwner = snapshots()
  wrongOwner.editorialSnapshot.ownerId = 'owner-2'
  assert.throws(
    () => analyzeEditorialSnapshot(wrongOwner),
    /identity or timestamp/
  )

  const missingCard = snapshots()
  missingCard.editorialSnapshot.cards = []
  assert.throws(
    () => analyzeEditorialSnapshot(missingCard),
    /missing 1 baseline cards/
  )

  const missingField = snapshots()
  delete missingField.editorialSnapshot.cards[0].synonyms
  assert.throws(
    () => analyzeEditorialSnapshot(missingField),
    /invalid source fields/
  )
})
