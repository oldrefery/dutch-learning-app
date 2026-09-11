import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'
import { getSemanticWordKey } from '../../packages/domain/src/semantic-word.ts'
import { contentHash } from '../vocabulary/snapshot.mjs'
import {
  assertNoForbiddenPublicTerms,
  calculateArtifactAggregateSha256,
  parseCliArguments,
} from './artifact-integrity.mjs'

const EXPECTED_SNAPSHOT_SHA256 =
  '11296b11ec1c6b3b932d137f884c0315c072fb7fce409c6c086eeac717ba0583'
const EXPECTED_PLAN_SHA256 =
  '1f1b5a14735aecd3d63ca7da293dddeebf86259accc632977d3863c76f895123'
const EXPECTED_OWNER_SHA256 =
  'a9931f78685622a6fbb4c25920dd3cb78be999503dfe2f0fb024ab98103e331d'
const EXPECTED_CLASSIFICATION_SHA256 =
  '917352b3cf30dabc9818e6607727569102b8293988830749ec4eeaaf1c3eb42f'
const EXPECTED_EVIDENCE_SHA256 =
  'c8a73b87bfdd0716e0990438fe57af0b58199e1de571710e16505b51c250cce5'
const EXPECTED_FREQUENCY_ENRICHMENT_SHA256 =
  '8e80e4aaa4f8c721af272a53eb06b7412dfa08fdf161a7baa405600761c5a1d1'
const EXPECTED_CONTENT_DECISIONS_SHA256 =
  '46de39a0b1a957fcafa54d684ab27c0b4851ad7a57dc4192873f6e01f9c40c98'
const EXPECTED_TARGET_COUNTS = new Map([
  ['A1-01', 122],
  ['A2-01', 100],
  ['A2-02', 100],
  ['A2-03', 100],
  ['A2-04', 100],
  ['A2-05', 100],
  ['B1-01', 99],
  ['B1-02', 99],
  ['B1-03', 99],
  ['B1-04', 99],
  ['B1-05', 98],
  ['B1-06', 98],
  ['B1-07', 98],
  ['B1-08', 98],
  ['B1-09', 98],
  ['B2-01', 101],
  ['B2-02', 101],
  ['B2-03', 101],
  ['B2-04', 101],
  ['B2-05', 100],
  ['C1-01', 47],
])
const EXPECTED_COUNTS = Object.freeze({
  sourceCards: 2287,
  mappings: 2059,
  exclusions: 228,
  protected: 69,
  expressions: 153,
  ownerExcluded: 6,
})
const PACK_VERSION = '1.0.0'
const REVIEWED_CARD_OVERRIDES = new Map([
  [
    '2e35b0013ce4cff3c001ab49426a6898186ab56b3d7441abd942d742f86c8cc2',
    {
      dutch_lemma: 'toerekenen',
      analysis_notes:
        "The verb 'toerekenen' is a separable verb consisting of the prefix 'toe-' and the root verb 'rekenen'. It is primarily used in legal, financial, and formal contexts to describe attributing a responsibility, cost, or cause to a person or source. It commonly takes the preposition 'aan' to identify the recipient of the attribution.",
    },
  ],
  [
    'cd1ec24f89a5ccb4eb39dabec202a014c45f24c43bfff3d5cf2dc7180ef426bc',
    {
      analysis_notes:
        "The word 'verrukkelijk' is an adjective derived from the verb 'verrukken' (to enchant or delight). In modern Dutch, it is a common intensifier for intense sensory pleasure. It is frequently used for food, like 'heerlijk', and also applies to music, weather, scents, or visual beauty. It is slightly more enthusiastic and sometimes more sophisticated than 'lekker'.",
    },
  ],
  [
    '33762158e6e58eeedebb257b42b990adb5c666545fb557935e24bdbf29254ff1',
    {
      analysis_notes:
        "'Klittenband' is a compound noun for hook-and-loop fastening tape. It is almost always used in the singular form.",
    },
  ],
])
const FORBIDDEN_PUBLIC_LEMMAS = new Set([
  'hottentot',
  'klit',
  'mongool',
  'piemel',
  'rukken',
  'swaffelen',
])

const sha256 = value => createHash('sha256').update(value).digest('hex')

const requireUniqueIds = (items, selectId, label) => {
  const ids = items.map(selectId)
  if (ids.some(id => typeof id !== 'string' || id.length === 0)) {
    throw new Error(`${label} contain an invalid ID.`)
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} contain duplicate IDs.`)
  }
  return new Set(ids)
}

const assertSourceRecord = (record, card, label) => {
  if (!card) throw new Error(`${label} references a missing source card.`)
  if (record.inputHash !== contentHash(card)) {
    throw new Error(`${label} has stale source evidence.`)
  }
  if (
    record.lemma !== card.dutch_lemma ||
    record.partOfSpeech !== card.part_of_speech ||
    record.originalCollectionId !== card.collection_id
  ) {
    throw new Error(`${label} does not match its source card.`)
  }
}

const assertInputDigests = ({
  snapshotBytes,
  planBytes,
  snapshot,
  plan,
  binding,
}) => {
  const snapshotDigest = sha256(snapshotBytes)
  if (snapshotDigest !== binding.snapshotSha256) {
    throw new Error(`Unexpected vocabulary snapshot hash: ${snapshotDigest}`)
  }
  const planDigest = sha256(planBytes)
  if (planDigest !== binding.planSha256) {
    throw new Error(`Unexpected collection plan hash: ${planDigest}`)
  }
  if (
    snapshot.matchedAccounts !== 1 ||
    typeof snapshot.ownerId !== 'string' ||
    sha256(snapshot.ownerId) !== binding.ownerSha256
  ) {
    throw new Error('The vocabulary snapshot owner identity is not authorized.')
  }
  if (
    plan.classificationProposalSha256 !== binding.classificationSha256 ||
    plan.inputEvidenceSha256 !== binding.evidenceSha256 ||
    plan.frequencyEnrichmentSha256 !== binding.frequencyEnrichmentSha256 ||
    plan.publicPackContentDecisionsSha256 !== binding.contentDecisionsSha256
  ) {
    throw new Error('The collection plan is not bound to the reviewed inputs.')
  }
}

const assertPlanShape = (snapshot, plan, binding) => {
  if (plan.productionWrites !== 0 || !plan.dryRun) {
    throw new Error('The collection plan is not a verified dry run.')
  }
  if (
    !Array.isArray(snapshot.cards) ||
    snapshot.cards.length !== binding.counts.sourceCards
  ) {
    throw new Error('Unexpected source card count.')
  }
  if (
    !Array.isArray(plan.mappings) ||
    plan.mappings.length !== binding.counts.mappings ||
    !Array.isArray(plan.exclusions) ||
    plan.exclusions.length !== binding.counts.exclusions ||
    !Array.isArray(plan.targetCollections) ||
    plan.targetCollections.length !== binding.targetCounts.size
  ) {
    throw new Error('Unexpected plan mapping, exclusion, or target count.')
  }
}

const collectPlanIds = (snapshot, plan) => ({
  sourceIds: requireUniqueIds(
    snapshot.cards,
    card => card.word_id,
    'Source cards'
  ),
  mappingIds: requireUniqueIds(
    plan.mappings,
    mapping => mapping.wordId,
    'Plan mappings'
  ),
  exclusionIds: requireUniqueIds(
    plan.exclusions,
    exclusion => exclusion.wordId,
    'Plan exclusions'
  ),
  targetKeys: requireUniqueIds(
    plan.targetCollections,
    target => target.targetKey,
    'Plan targets'
  ),
})

const assertCompleteCoverage = (ids, binding) => {
  const { sourceIds, mappingIds, exclusionIds, targetKeys } = ids
  if (
    [...mappingIds].some(id => exclusionIds.has(id)) ||
    [...sourceIds].some(id => !mappingIds.has(id) && !exclusionIds.has(id)) ||
    [...mappingIds, ...exclusionIds].some(id => !sourceIds.has(id))
  ) {
    throw new Error(
      'Mappings and exclusions do not cover each source card once.'
    )
  }
  if (
    targetKeys.size !== binding.targetCounts.size ||
    [...targetKeys].some(key => !binding.targetCounts.has(key))
  ) {
    throw new Error('The plan target keys differ from the reviewed target set.')
  }
}

const assertPlanRecords = (snapshot, plan, binding) => {
  const cardById = new Map(snapshot.cards.map(card => [card.word_id, card]))
  const targetByKey = new Map(
    plan.targetCollections.map(target => [target.targetKey, target])
  )
  const mappedCounts = new Map()
  for (const mapping of plan.mappings) {
    assertSourceRecord(
      mapping,
      cardById.get(mapping.wordId),
      `Mapping ${mapping.wordId}`
    )
    const target = targetByKey.get(mapping.targetKey)
    if (!target || mapping.targetName !== target.targetName) {
      throw new Error(`Mapping ${mapping.wordId} has an unknown target.`)
    }
    mappedCounts.set(
      mapping.targetKey,
      (mappedCounts.get(mapping.targetKey) ?? 0) + 1
    )
  }
  for (const exclusion of plan.exclusions) {
    assertSourceRecord(
      exclusion,
      cardById.get(exclusion.wordId),
      `Exclusion ${exclusion.wordId}`
    )
  }
  for (const [targetKey, expectedCount] of binding.targetCounts) {
    const target = targetByKey.get(targetKey)
    if (
      !target ||
      target.cardCount !== expectedCount ||
      mappedCounts.get(targetKey) !== expectedCount
    ) {
      throw new Error(`Unexpected card count for ${targetKey}.`)
    }
  }
}

const assertExclusionsAndSummary = (plan, binding) => {
  const statusCount = status =>
    plan.exclusions.filter(exclusion => exclusion.status === status).length
  if (
    statusCount('protected') !== binding.counts.protected ||
    statusCount('preserve-expression') !== binding.counts.expressions ||
    statusCount('owner-excluded-from-prepared-collections') !==
      binding.counts.ownerExcluded
  ) {
    throw new Error('Unexpected exclusion category counts.')
  }
  const ownerExcluded = plan.exclusions
    .filter(
      exclusion =>
        exclusion.status === 'owner-excluded-from-prepared-collections'
    )
    .map(exclusion => exclusion.lemma.trim().toLocaleLowerCase('nl'))
  if (
    ownerExcluded.length !== binding.ownerExcludedLemmas.size ||
    ownerExcluded.some(lemma => !binding.ownerExcludedLemmas.has(lemma))
  ) {
    throw new Error(
      'The owner exclusion set differs from the reviewed decision.'
    )
  }
  if (
    plan.summary?.totalCards !== binding.counts.sourceCards ||
    plan.summary?.mappedCards !== binding.counts.mappings ||
    plan.summary?.excludedCards !== binding.counts.exclusions ||
    plan.summary?.targetCollections !== binding.targetCounts.size
  ) {
    throw new Error('The plan summary does not match its verified contents.')
  }
}

export const assertSourceBoundInputs = ({
  snapshotBytes,
  planBytes,
  snapshot,
  plan,
  expected = {},
}) => {
  const binding = {
    snapshotSha256: EXPECTED_SNAPSHOT_SHA256,
    planSha256: EXPECTED_PLAN_SHA256,
    ownerSha256: EXPECTED_OWNER_SHA256,
    classificationSha256: EXPECTED_CLASSIFICATION_SHA256,
    evidenceSha256: EXPECTED_EVIDENCE_SHA256,
    frequencyEnrichmentSha256: EXPECTED_FREQUENCY_ENRICHMENT_SHA256,
    contentDecisionsSha256: EXPECTED_CONTENT_DECISIONS_SHA256,
    targetCounts: EXPECTED_TARGET_COUNTS,
    ownerExcludedLemmas: FORBIDDEN_PUBLIC_LEMMAS,
    counts: EXPECTED_COUNTS,
    ...expected,
  }
  assertInputDigests({ snapshotBytes, planBytes, snapshot, plan, binding })
  assertPlanShape(snapshot, plan, binding)
  assertCompleteCoverage(collectPlanIds(snapshot, plan), binding)
  assertPlanRecords(snapshot, plan, binding)
  assertExclusionsAndSummary(plan, binding)
}

const optionalText = value => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text === '' ? undefined : text
}

const nullableText = value => optionalText(value) ?? null

const textArray = value =>
  Array.isArray(value) ? value.map(optionalText).filter(Boolean) : []

export const applyReviewedCardOverride = (
  card,
  overrides = REVIEWED_CARD_OVERRIDES
) => {
  const override = overrides.get(contentHash(card))
  return override ? { ...card, ...override } : card
}

export const auditSourceCompleteness = cards => {
  const verbs = cards.filter(card => card.part_of_speech === 'verb')
  const nouns = cards.filter(card => card.part_of_speech === 'noun')
  return {
    entryCount: cards.length,
    verbCount: verbs.length,
    verbsMissingIrregularity: verbs.filter(
      card => typeof card.is_irregular !== 'boolean'
    ).length,
    verbsMissingConjugation: verbs.filter(
      card => card.conjugation === undefined
    ).length,
    nounCount: nouns.length,
    nounsMissingPlural: nouns.filter(card => card.plural === undefined).length,
    entriesMissingSynonyms: cards.filter(card => card.synonyms === undefined)
      .length,
    entriesMissingAntonyms: cards.filter(card => card.antonyms === undefined)
      .length,
    omittedUsageNotes: cards.filter(card => card.usage_notes != null).length,
  }
}

export const analyzeSemanticUniqueness = manifests => {
  const entriesByKey = new Map()
  for (const manifest of manifests) {
    for (const entry of manifest.entries) {
      const semanticKey = getSemanticWordKey(
        entry.dutch_lemma,
        entry.part_of_speech,
        entry.article
      )
      entriesByKey.set(semanticKey, [
        ...(entriesByKey.get(semanticKey) ?? []),
        { packId: manifest.pack_id, entryId: entry.entry_id },
      ])
    }
  }
  const collisions = [...entriesByKey]
    .filter(([, entries]) => entries.length > 1)
    .map(([semanticKey, entries]) => ({ semanticKey, entries }))
  return {
    entryCount: manifests.reduce(
      (count, manifest) => count + manifest.entries.length,
      0
    ),
    uniqueSemanticCount: entriesByKey.size,
    collisionGroupCount: collisions.length,
    collidingEntryCount: collisions.reduce(
      (count, collision) => count + collision.entries.length,
      0
    ),
    collisions,
  }
}

const sourceFieldPolicy = completeness => ({
  usageNotes: {
    status: 'omitted-pending-editorial-review',
    sourceEntryCount: completeness.omittedUsageNotes,
    includedInManifest: false,
    requirement:
      'Review each source value and add a shared contract plus matching web/mobile import support before inclusion.',
  },
  linguisticFields: {
    status: 'missing-source-supplement',
    defaultedDuringExport: false,
    requirement:
      'Resolve irregularity, conjugation, and plural values through verified source data or explicit editorial decisions before approval.',
  },
})

export const parseSnapshotCsv = raw => {
  const newline = raw.indexOf('\n')
  if (newline < 0 || raw.slice(0, newline).trim() !== 'snapshot') {
    throw new Error('Unexpected vocabulary snapshot CSV header.')
  }
  let cell = raw.slice(newline + 1).trim()
  if (!cell.startsWith('"') || !cell.endsWith('"')) {
    throw new Error('Unexpected vocabulary snapshot CSV payload.')
  }
  cell = cell.slice(1, -1).replaceAll('""', '"')
  return JSON.parse(cell)
}

const derivePrefix = card => {
  const lemma = optionalText(card.dutch_lemma)
  const root = optionalText(card.root_verb)
  if (!lemma || !root) {
    throw new Error(`Separable verb ${lemma ?? '(unknown)'} has no root verb.`)
  }
  if (lemma.endsWith(root) && lemma.length > root.length) {
    return lemma.slice(0, -root.length)
  }
  throw new Error(`Could not derive a separable prefix for ${lemma}.`)
}

export const buildStableEntryId = card => {
  if (typeof card.word_id !== 'string' || card.word_id.length === 0) {
    throw new Error('A stable public entry ID requires a private source ID.')
  }
  return `entry-${sha256(`official-content-entry-v1:${card.word_id}`).slice(0, 24)}`
}

export const sanitizeCard = (card, overrides = REVIEWED_CARD_OVERRIDES) => {
  card = applyReviewedCardOverride(card, overrides)
  const dutchLemma = optionalText(card.dutch_lemma)
  const partOfSpeech = optionalText(card.part_of_speech)
  const englishTranslations = textArray(card.translations?.en)
  if (!dutchLemma || !partOfSpeech || englishTranslations.length === 0) {
    throw new Error(`Card ${card.word_id ?? '(unknown)'} is incomplete.`)
  }

  const entry = {
    entry_id: buildStableEntryId(card),
    dutch_lemma: dutchLemma,
    dutch_original: nullableText(card.dutch_original),
    part_of_speech: partOfSpeech,
    translations: {
      en: englishTranslations,
      ...(textArray(card.translations?.ru).length > 0
        ? { ru: textArray(card.translations.ru) }
        : {}),
    },
    examples: (card.examples ?? []).map(example => ({
      nl: optionalText(example.nl),
      en: optionalText(example.en),
      ...(optionalText(example.ru) ? { ru: optionalText(example.ru) } : {}),
    })),
    is_reflexive: card.is_reflexive === true,
    is_expression: card.is_expression === true,
    expression_type: nullableText(card.expression_type),
    is_separable: card.is_separable === true,
    root_verb: nullableText(card.root_verb),
    article: card.article ?? null,
    register: card.register ?? null,
    preposition: nullableText(card.preposition),
    analysis_notes: nullableText(card.analysis_notes),
  }
  if (entry.is_separable) entry.prefix_part = derivePrefix(card)
  return entry
}

export const buildPackManifest = ({
  collection,
  cards,
  snapshot,
  mappedCardCount,
}) => {
  const packId = `dutch-${collection.targetKey.toLowerCase()}`
  const number = collection.targetKey.split('-')[1]
  const manifest = {
    schema_version: 1,
    pack_id: packId,
    version: PACK_VERSION,
    title: `Dutch ${collection.level} · Pack ${number}`,
    description: `A frequency-ordered Dutch ${collection.level} vocabulary pack with ${cards.length} words.`,
    source_language: 'nl',
    translation_languages: ['en', 'ru'],
    created_at: snapshot.capturedAt,
    license: {
      name: 'Woordenaar official content',
      url: null,
      notes: 'May be imported and studied inside Woordenaar.',
    },
    provenance: {
      origin: 'existing-project-library',
      source_snapshot_at: snapshot.capturedAt,
      source_card_count: snapshot.cards.length,
      source_unique_semantic_count: mappedCardCount,
      selection_method:
        'CEFR classification followed by descending Dutch usage frequency and balanced groups.',
      notes:
        'Generated from reviewed project vocabulary. Personal ownership, collection IDs, progress, SRS state, media, and timestamps are excluded.',
      excluded_sources: [
        'Protected personal expression collections',
        'Owner-excluded sensitive vocabulary',
        'Personal learning and synchronization metadata',
      ],
    },
    content_review: {
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      notes:
        'Automated schema, integrity, exclusion, and deterministic-build checks passed; final editorial approval is pending.',
    },
    entries: cards.map(card => sanitizeCard(card)),
  }
  const validation = validateOfficialContentManifest(manifest)
  if (!validation.success) {
    throw new Error(
      `Invalid ${packId}: ${validation.issues
        .map(issue => `${issue.path} ${issue.message}`)
        .join('; ')}`
    )
  }
  return validation.data
}

const assertSafePublicContent = manifests => {
  const ids = new Set()
  assertNoForbiddenPublicTerms(manifests, FORBIDDEN_PUBLIC_LEMMAS)
  for (const manifest of manifests) {
    for (const entry of manifest.entries) {
      if (ids.has(entry.entry_id)) {
        throw new Error(`Duplicate public entry ID: ${entry.entry_id}`)
      }
      ids.add(entry.entry_id)
    }
  }
}

const isMissingPathError = error =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

const existingArtifactsMatch = async (outDir, artifacts) => {
  let filenames
  try {
    filenames = await readdir(outDir)
  } catch (error) {
    if (isMissingPathError(error)) return false
    throw error
  }
  if (
    filenames.length !== artifacts.size ||
    filenames.some(filename => !artifacts.has(filename))
  ) {
    throw new Error('Output directory already exists with different content.')
  }
  for (const [filename, expected] of artifacts) {
    if ((await readFile(path.join(outDir, filename), 'utf8')) !== expected) {
      throw new Error('Output directory already exists with different content.')
    }
  }
  return true
}

export const writeArtifactDirectory = async (outDir, artifacts) => {
  if (await existingArtifactsMatch(outDir, artifacts)) return 'unchanged'

  const parentDir = path.dirname(outDir)
  await mkdir(parentDir, { recursive: true, mode: 0o700 })
  const temporaryDir = await mkdtemp(
    path.join(parentDir, `.${path.basename(outDir)}-`)
  )
  try {
    for (const [filename, serialized] of artifacts) {
      if (path.basename(filename) !== filename) {
        throw new Error(`Unsafe generated artifact filename: ${filename}`)
      }
      await writeFile(path.join(temporaryDir, filename), serialized, {
        flag: 'wx',
        mode: 0o600,
      })
    }
    await rename(temporaryDir, outDir)
    return 'created'
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true })
    throw error
  }
}

export const buildVocabularyPacks = async ({
  snapshotPath,
  planPath,
  outDir,
  expected,
}) => {
  const [snapshotBytes, planBytes] = await Promise.all([
    readFile(snapshotPath),
    readFile(planPath),
  ])
  const snapshot = parseSnapshotCsv(snapshotBytes.toString('utf8'))
  const plan = JSON.parse(planBytes)
  assertSourceBoundInputs({
    snapshotBytes,
    planBytes,
    snapshot,
    plan,
    expected,
  })
  const planDigest = sha256(planBytes)

  const cardById = new Map(snapshot.cards.map(card => [card.word_id, card]))
  const mappingsByTarget = Map.groupBy(
    plan.mappings,
    mapping => mapping.targetKey
  )
  const draftManifests = plan.targetCollections.map(collection => {
    const mappings = mappingsByTarget.get(collection.targetKey) ?? []
    const cards = mappings.map(mapping => {
      const card = cardById.get(mapping.wordId)
      if (!card) throw new Error(`Missing source card ${mapping.wordId}.`)
      return card
    })
    if (cards.length !== collection.cardCount) {
      throw new Error(`Unexpected card count for ${collection.targetKey}.`)
    }
    return buildPackManifest({
      collection,
      cards,
      snapshot,
      mappedCardCount: plan.mappings.length,
    })
  })
  const semanticUniqueness = analyzeSemanticUniqueness(draftManifests)
  const manifests = draftManifests.map(manifest => {
    const candidate = {
      ...manifest,
      provenance: {
        ...manifest.provenance,
        source_unique_semantic_count: semanticUniqueness.uniqueSemanticCount,
      },
    }
    const validation = validateOfficialContentManifest(candidate)
    if (!validation.success) {
      throw new Error(
        `Could not record semantic provenance for ${manifest.pack_id}.`
      )
    }
    return validation.data
  })
  assertSafePublicContent(manifests)

  const files = []
  const artifacts = new Map()
  for (const manifest of manifests) {
    const filename = `${manifest.pack_id}-${manifest.version}.json`
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`
    artifacts.set(filename, serialized)
    files.push({
      packId: manifest.pack_id,
      version: manifest.version,
      filename,
      entryCount: manifest.entries.length,
      contentSha256: sha256(canonicalizeOfficialContent(manifest)),
      fileSha256: sha256(serialized),
      sourceCompleteness: auditSourceCompleteness(
        (
          mappingsByTarget.get(
            manifest.pack_id.replace('dutch-', '').toUpperCase()
          ) ?? []
        ).map(mapping => cardById.get(mapping.wordId))
      ),
    })
  }

  const catalog = plan.targetCollections.map((collection, index) => {
    const manifest = manifests[index]
    return {
      pack_id: manifest.pack_id,
      slug: manifest.pack_id,
      title: manifest.title,
      description: manifest.description,
      cefr_level: collection.level,
      display_order: index + 1,
      version: manifest.version,
      entry_count: manifest.entries.length,
      content_sha256: files[index].contentSha256,
      review_status: 'draft',
    }
  })
  const completeness = auditSourceCompleteness(
    plan.mappings.map(mapping => cardById.get(mapping.wordId))
  )
  const indexDocument = {
    schemaVersion: 1,
    generatedFromPlanSha256: planDigest,
    productionWrites: 0,
    packCount: manifests.length,
    entryCount: manifests.reduce((sum, item) => sum + item.entries.length, 0),
    sourceCompleteness: completeness,
    sourceFieldPolicy: sourceFieldPolicy(completeness),
    semanticUniqueness,
    forbiddenPublicLemmas: [...FORBIDDEN_PUBLIC_LEMMAS].sort(),
    catalog,
    files,
  }
  indexDocument.draftAggregateSha256 = calculateArtifactAggregateSha256(files)
  const indexSerialized = `${JSON.stringify(indexDocument, null, 2)}\n`
  artifacts.set('index.json', indexSerialized)
  await writeArtifactDirectory(outDir, artifacts)
  return indexDocument
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const root = process.cwd()
  const args = parseCliArguments(process.argv.slice(2), {
    valueOptions: ['--snapshot', '--plan', '--out'],
  })
  const index = await buildVocabularyPacks({
    snapshotPath:
      args.get('--snapshot') ??
      path.join(
        root,
        'reports/vocabulary-organization/snapshot-2026-09-07.csv'
      ),
    planPath:
      args.get('--plan') ??
      path.join(
        root,
        'reports/vocabulary-organization/collection-plan-proposal-003-2026-09-11.json'
      ),
    outDir:
      args.get('--out') ??
      path.join(
        root,
        'reports/vocabulary-organization/official-content-drafts-v3-2026-09-11'
      ),
  })
  console.log(
    JSON.stringify(
      {
        packCount: index.packCount,
        entryCount: index.entryCount,
        productionWrites: index.productionWrites,
      },
      null,
      2
    )
  )
}
