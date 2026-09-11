import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  assertSourceBoundInputs,
  analyzeSemanticUniqueness,
  auditSourceCompleteness,
  buildPackManifest,
  buildStableEntryId,
  buildVocabularyPacks,
  parseSnapshotCsv,
  sanitizeCard,
  writeArtifactDirectory,
} from './build-vocabulary-packs.mjs'
import { validateOfficialContentManifest } from '../../packages/content/src/manifest.ts'
import { contentHash } from '../vocabulary/snapshot.mjs'

const CAPTURED_AT = '2026-09-11T00:00:00Z'
const INDEX_FILENAME = 'index.json'
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
  updated_at: CAPTURED_AT,
}

const digest = value => createHash('sha256').update(value).digest('hex')

const sourceBindingFixture = () => {
  const snapshot = {
    matchedAccounts: 1,
    ownerId: 'synthetic-owner',
    cards: [baseCard],
  }
  const mapping = {
    wordId: baseCard.word_id,
    inputHash: contentHash(baseCard),
    lemma: baseCard.dutch_lemma,
    partOfSpeech: baseCard.part_of_speech,
    originalCollectionId: baseCard.collection_id,
    targetKey: 'A2-01',
    targetName: 'A2 · 01',
  }
  const plan = {
    classificationProposalSha256: 'classification',
    inputEvidenceSha256: 'evidence',
    frequencyEnrichmentSha256: 'frequency',
    publicPackContentDecisionsSha256: 'decisions',
    productionWrites: 0,
    dryRun: true,
    mappings: [mapping],
    exclusions: [],
    targetCollections: [
      {
        targetKey: 'A2-01',
        targetName: 'A2 · 01',
        cardCount: 1,
      },
    ],
    summary: {
      totalCards: 1,
      mappedCards: 1,
      excludedCards: 0,
      targetCollections: 1,
    },
  }
  const snapshotBytes = Buffer.from('synthetic snapshot bytes')
  const planBytes = Buffer.from('synthetic plan bytes')
  const expected = {
    snapshotSha256: digest(snapshotBytes),
    planSha256: digest(planBytes),
    ownerSha256: digest(snapshot.ownerId),
    classificationSha256: 'classification',
    evidenceSha256: 'evidence',
    frequencyEnrichmentSha256: 'frequency',
    contentDecisionsSha256: 'decisions',
    targetCounts: new Map([['A2-01', 1]]),
    ownerExcludedLemmas: new Set(),
    counts: {
      sourceCards: 1,
      mappings: 1,
      exclusions: 0,
      protected: 0,
      expressions: 0,
      ownerExcluded: 0,
    },
  }
  return { expected, mapping, plan, planBytes, snapshot, snapshotBytes }
}

test('parses the single-cell snapshot export', () => {
  const snapshot = parseSnapshotCsv(
    'snapshot\n"{\"\"cards\"\":[],\"\"capturedAt\"\":\"\"2026-09-11T00:00:00Z\"\"}"\n'
  )
  assert.deepEqual(snapshot.cards, [])
})

test('sanitizes personal fields and derives a separable prefix', () => {
  const entry = sanitizeCard(baseCard)
  assert.equal(entry.prefix_part, 'uit')
  assert.equal(entry.root_verb, 'rekenen')
  assert.equal('word_id' in entry, false)
  assert.equal('collection_id' in entry, false)
  assert.equal('updated_at' in entry, false)
})

test('requires an explicit reviewed override when legacy spelling hides the prefix', () => {
  const legacyCard = {
    ...baseCard,
    dutch_lemma: 'toerekennen',
    analysis_notes: "A separable verb with the prefix 'toe-' and root rekenen.",
  }
  assert.throws(
    () => sanitizeCard(legacyCard, new Map()),
    /Could not derive a separable prefix/
  )

  const overrides = new Map([
    [
      contentHash(legacyCard),
      {
        dutch_lemma: 'toerekenen',
        analysis_notes: 'Reviewed public spelling.',
      },
    ],
  ])
  const entry = sanitizeCard(legacyCard, overrides)
  assert.equal(entry.dutch_lemma, 'toerekenen')
  assert.equal(entry.prefix_part, 'toe')
  assert.equal(entry.analysis_notes, 'Reviewed public spelling.')
})

test('removes excluded terms from reviewed public notes without changing the source card', () => {
  const card = {
    ...baseCard,
    dutch_lemma: 'verrukkelijk',
    part_of_speech: 'adjective',
    is_separable: false,
    root_verb: null,
    analysis_notes: 'Private source note with an excluded term.',
  }
  const sourceHash = contentHash(card)
  const publicCopy = sanitizeCard(
    card,
    new Map([
      [
        sourceHash,
        {
          analysis_notes:
            'Reviewed public note without the excluded source wording.',
        },
      ],
    ])
  )

  assert.equal(
    publicCopy.analysis_notes,
    'Reviewed public note without the excluded source wording.'
  )
  assert.equal(
    card.analysis_notes,
    'Private source note with an excluded term.'
  )
})

test('builds a valid pending manifest that cannot be published accidentally', () => {
  const manifest = buildPackManifest({
    collection: { targetKey: 'A2-01', level: 'A2' },
    cards: [baseCard],
    mappedCardCount: 1,
    snapshot: {
      capturedAt: CAPTURED_AT,
      cards: [baseCard],
    },
  })
  assert.equal(manifest.content_review.status, 'pending')
  assert.equal(manifest.content_review.reviewed_by, null)
  assert.equal(manifest.entries.length, 1)
})

test('records omitted linguistic fields without defaulting unknown values', () => {
  const audit = auditSourceCompleteness([
    baseCard,
    {
      ...baseCard,
      word_id: 'noun-id',
      dutch_lemma: 'woning',
      part_of_speech: 'noun',
      usage_notes: { summary: 'A home.' },
    },
  ])

  assert.deepEqual(audit, {
    entryCount: 2,
    verbCount: 1,
    verbsMissingIrregularity: 1,
    verbsMissingConjugation: 1,
    nounCount: 1,
    nounsMissingPlural: 1,
    entriesMissingSynonyms: 2,
    entriesMissingAntonyms: 2,
    omittedUsageNotes: 1,
  })
  assert.equal('is_irregular' in sanitizeCard(baseCard), false)
})

test('keeps public entry IDs stable across content corrections and pack moves', () => {
  const originalId = buildStableEntryId(baseCard)
  const correctedId = buildStableEntryId({
    ...baseCard,
    dutch_lemma: 'corrected spelling',
    translations: { en: ['corrected translation'] },
    examples: [{ nl: 'Verbeterd.', en: 'Corrected.' }],
  })
  const otherSourceId = buildStableEntryId({
    ...baseCard,
    word_id: 'other-private-id',
  })

  assert.equal(correctedId, originalId)
  assert.notEqual(otherSourceId, originalId)
  assert.equal(originalId.includes(baseCard.word_id), false)
})

test('counts semantic uniqueness with the application import key', () => {
  const analysis = analyzeSemanticUniqueness([
    {
      pack_id: 'pack-a',
      entries: [
        {
          entry_id: 'a-1',
          dutch_lemma: ' Huis ',
          part_of_speech: 'NOUN',
          article: 'het',
        },
        {
          entry_id: 'a-2',
          dutch_lemma: 'huis',
          part_of_speech: 'noun',
          article: 'de',
        },
      ],
    },
    {
      pack_id: 'pack-b',
      entries: [
        {
          entry_id: 'b-1',
          dutch_lemma: 'huis',
          part_of_speech: 'noun',
          article: 'het',
        },
      ],
    },
  ])

  assert.equal(analysis.entryCount, 3)
  assert.equal(analysis.uniqueSemanticCount, 2)
  assert.equal(analysis.collisionGroupCount, 1)
  assert.equal(analysis.collidingEntryCount, 2)
  assert.deepEqual(analysis.collisions[0].entries, [
    { packId: 'pack-a', entryId: 'a-1' },
    { packId: 'pack-b', entryId: 'b-1' },
  ])
})

test('rejects unknown fields at every public manifest nesting level', () => {
  const manifest = buildPackManifest({
    collection: { targetKey: 'A2-01', level: 'A2' },
    cards: [baseCard],
    mappedCardCount: 1,
    snapshot: {
      capturedAt: CAPTURED_AT,
      cards: [baseCard],
    },
  })
  const mutations = [
    value => {
      value.private_owner = 'owner'
    },
    value => {
      value.license.private_note = 'private'
    },
    value => {
      value.provenance.media_url = 'https://private.invalid/image.jpg'
    },
    value => {
      value.content_review.internal_status = 'reviewing'
    },
    value => {
      value.entries[0].knowledge_level = 5
    },
    value => {
      value.entries[0].translations.owner_language = ['private']
    },
    value => {
      value.entries[0].examples[0].source_word_id = 'private-id'
    },
    value => {
      value.entries[0].conjugation = {
        present: 'rekent',
        simple_past: 'rekende',
        past_participle: 'gerekend',
        private_hint: 'private',
      }
    },
  ]

  mutations.forEach(mutate => {
    const candidate = structuredClone(manifest)
    mutate(candidate)
    const result = validateOfficialContentManifest(candidate)
    assert.equal(result.success, false)
    assert.match(
      result.issues.map(issue => issue.message).join('; '),
      /not an allowed official content field/
    )
  })
})

test('accepts a complete plan bound to exact source bytes and card evidence', () => {
  const fixture = sourceBindingFixture()
  assert.doesNotThrow(() => assertSourceBoundInputs(fixture))
})

test('rejects stale snapshot bytes before artifact generation', () => {
  const fixture = sourceBindingFixture()
  fixture.snapshotBytes = Buffer.from('changed snapshot bytes')
  assert.throws(
    () => assertSourceBoundInputs(fixture),
    /Unexpected vocabulary snapshot hash/
  )
})

test('rejects a snapshot for a different owner', () => {
  const fixture = sourceBindingFixture()
  fixture.snapshot.ownerId = 'different-owner'
  assert.throws(
    () => assertSourceBoundInputs(fixture),
    /owner identity is not authorized/
  )
})

test('rejects stale per-card evidence and incomplete mappings', () => {
  const staleEvidence = sourceBindingFixture()
  staleEvidence.mapping.inputHash = 'stale'
  assert.throws(
    () => assertSourceBoundInputs(staleEvidence),
    /stale source evidence/
  )

  const incomplete = sourceBindingFixture()
  incomplete.plan.mappings = []
  assert.throws(
    () => assertSourceBoundInputs(incomplete),
    /Unexpected plan mapping, exclusion, or target count/
  )
})

test('rejects unknown target keys and inconsistent target counts', () => {
  const unknownTarget = sourceBindingFixture()
  unknownTarget.plan.mappings[0].targetKey = 'B2-99'
  assert.throws(() => assertSourceBoundInputs(unknownTarget), /unknown target/)

  const wrongCount = sourceBindingFixture()
  wrongCount.plan.targetCollections[0].cardCount = 2
  assert.throws(
    () => assertSourceBoundInputs(wrongCount),
    /Unexpected card count for A2-01/
  )
})

test('creates artifact directories atomically and never overwrites differences', async context => {
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), 'official-content-build-')
  )
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }))
  const output = path.join(fixtureRoot, 'release')
  const artifacts = new Map([
    [INDEX_FILENAME, '{"version":1}\n'],
    ['pack.json', '{"entries":[]}\n'],
  ])

  assert.equal(await writeArtifactDirectory(output, artifacts), 'created')
  assert.equal(await writeArtifactDirectory(output, artifacts), 'unchanged')
  await assert.rejects(
    writeArtifactDirectory(
      output,
      new Map([
        [INDEX_FILENAME, '{"version":2}\n'],
        ['pack.json', '{"entries":[]}\n'],
      ])
    ),
    /already exists with different content/
  )
  assert.equal(
    await readFile(path.join(output, INDEX_FILENAME), 'utf8'),
    '{"version":1}\n'
  )
})

test('produces identical artifact bytes in two independent builds', async context => {
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), 'official-content-determinism-')
  )
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }))
  const fixture = sourceBindingFixture()
  fixture.snapshot.capturedAt = CAPTURED_AT
  fixture.plan.targetCollections[0].level = 'A2'
  const snapshotJson = JSON.stringify(fixture.snapshot)
  const snapshotBytes = `snapshot\n"${snapshotJson.replaceAll('"', '""')}"\n`
  const planBytes = `${JSON.stringify(fixture.plan, null, 2)}\n`
  fixture.expected.snapshotSha256 = digest(snapshotBytes)
  fixture.expected.planSha256 = digest(planBytes)
  const snapshotPath = path.join(fixtureRoot, 'snapshot.csv')
  const planPath = path.join(fixtureRoot, 'plan.json')
  await Promise.all([
    writeFile(snapshotPath, snapshotBytes),
    writeFile(planPath, planBytes),
  ])

  const outputs = [
    path.join(fixtureRoot, 'first'),
    path.join(fixtureRoot, 'second'),
  ]
  for (const outDir of outputs) {
    await buildVocabularyPacks({
      snapshotPath,
      planPath,
      outDir,
      expected: fixture.expected,
    })
  }
  const filenames = await readdir(outputs[0])
  assert.deepEqual(filenames, await readdir(outputs[1]))
  for (const filename of filenames) {
    assert.deepEqual(
      await readFile(path.join(outputs[0], filename)),
      await readFile(path.join(outputs[1], filename))
    )
  }
})
