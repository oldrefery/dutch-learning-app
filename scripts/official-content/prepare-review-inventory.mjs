import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'
import { getSemanticWordKey } from '../../packages/domain/src/semantic-word.ts'
import {
  loadVerifiedArtifactSet,
  parseCliArguments,
  sha256,
} from './artifact-integrity.mjs'
import {
  assertSourceBoundInputs,
  buildStableEntryId,
  parseSnapshotCsv,
  writeArtifactDirectory,
} from './build-vocabulary-packs.mjs'
import {
  analyzeEditorialSnapshot,
  enrichDraftEntry,
} from './review-source-evidence.mjs'

const DEFAULT_BATCH_SIZE = 25
const BATCH_SIZE_OPTION = '--batch-size'

const requireUniqueMap = (items, keySelector, label) => {
  const map = new Map()
  for (const item of items) {
    const key = keySelector(item)
    if (typeof key !== 'string' || key === '' || map.has(key)) {
      throw new Error(`${label} must have unique non-empty keys.`)
    }
    map.set(key, item)
  }
  return map
}

const unresolvedLinguisticFields = entry => {
  const fields = []
  if (entry.part_of_speech === 'verb') {
    if (typeof entry.is_irregular !== 'boolean') fields.push('is_irregular')
    if (!Object.hasOwn(entry, 'conjugation')) fields.push('conjugation')
  }
  if (entry.part_of_speech === 'noun' && !Object.hasOwn(entry, 'plural')) {
    fields.push('plural')
  }
  return fields
}

const priorityFlags = ({
  entry,
  sourceCard,
  classification,
  semanticKey,
  essentialsKeys,
}) => {
  const flags = []
  const unresolved = unresolvedLinguisticFields(entry)
  if (unresolved.length > 0) flags.push('unresolved-linguistic-fields')
  if (classification.qualityNote) flags.push('known-quality-concern')
  if (classification.confidence === 'low') flags.push('low-cefr-confidence')
  if (sourceCard.usage_notes != null) flags.push('omitted-usage-notes')
  if (sourceCard.analysis_notes != null) flags.push('has-analysis-notes')
  if (sourceCard.dutch_lemma !== entry.dutch_lemma) {
    flags.push('reviewed-spelling-override')
  }
  if (essentialsKeys.has(semanticKey)) flags.push('essentials-overlap')
  return flags
}

const balancedBatchNumber = (entryIndex, entryCount, targetBatchSize) => {
  const batchCount = Math.max(1, Math.round(entryCount / targetBatchSize))
  const smallerBatchSize = Math.floor(entryCount / batchCount)
  const largerBatchCount = entryCount % batchCount
  const largerBatchSize = smallerBatchSize + 1
  const largerEntries = largerBatchCount * largerBatchSize
  if (entryIndex < largerEntries) {
    return Math.floor(entryIndex / largerBatchSize) + 1
  }
  return (
    largerBatchCount +
    Math.floor((entryIndex - largerEntries) / smallerBatchSize) +
    1
  )
}

const buildInventoryEntry = ({
  pack,
  entry,
  entryIndex,
  sourceCard,
  mapping,
  classification,
  essentialsKeys,
  batchSize,
  packEntryCount,
  editorialEvidence,
}) => {
  const semanticKey = getSemanticWordKey(
    entry.dutch_lemma,
    entry.part_of_speech,
    entry.article
  )
  const unresolved = editorialEvidence
    ? editorialEvidence.unresolvedLinguisticFields
    : unresolvedLinguisticFields(entry)
  const proposedEntry = editorialEvidence
    ? enrichDraftEntry(entry, editorialEvidence)
    : entry
  const flags = priorityFlags({
    entry: proposedEntry,
    sourceCard,
    classification,
    semanticKey,
    essentialsKeys,
  })
  if (editorialEvidence?.contentChanged) {
    flags.push('source-content-changed-after-baseline')
  }
  return {
    packId: pack.manifest.pack_id,
    packVersion: pack.manifest.version,
    orderWithinPack: entryIndex + 1,
    batchId: `${pack.manifest.pack_id}-batch-${String(
      balancedBatchNumber(entryIndex, packEntryCount, batchSize)
    ).padStart(2, '0')}`,
    entryId: entry.entry_id,
    sourceWordId: sourceCard.word_id,
    sourceCardSha256: mapping.inputHash,
    sourceContentSha256: sha256(canonicalizeOfficialContent(entry)),
    proposedContentSha256: sha256(canonicalizeOfficialContent(proposedEntry)),
    importSemanticKey: semanticKey,
    estimatedCefr: mapping.estimatedCefr,
    everydayUsefulness: mapping.everydayUsefulness,
    frequency: mapping.frequency,
    orderingFrequency: mapping.orderingFrequency,
    classification: {
      confidence: classification.confidence ?? null,
      qualityNote: classification.qualityNote ?? null,
    },
    priorityFlags: flags,
    unresolvedLinguisticFields: unresolved,
    draftEntry: entry,
    proposedEntry,
    editorialEvidence: editorialEvidence ?? null,
    omittedSourceFields: {
      usage_notes: sourceCard.usage_notes ?? null,
      is_irregular: sourceCard.is_irregular ?? null,
      conjugation: sourceCard.conjugation ?? null,
      plural: sourceCard.plural ?? null,
      synonyms: sourceCard.synonyms ?? null,
      antonyms: sourceCard.antonyms ?? null,
    },
  }
}

const countFlags = entries => {
  const counts = {}
  for (const entry of entries) {
    for (const flag of entry.priorityFlags) {
      counts[flag] = (counts[flag] ?? 0) + 1
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  )
}

export const createReviewInventory = ({
  draftIndex,
  packs,
  snapshot,
  plan,
  classification,
  essentialsManifest,
  batchSize = DEFAULT_BATCH_SIZE,
  editorialEvidenceByWordId = null,
  editorialSourceSummary = null,
}) => {
  if (!Number.isInteger(batchSize) || batchSize < 20 || batchSize > 30) {
    throw new Error('Review batch size must be between 20 and 30.')
  }
  const essentialsValidation =
    validateOfficialContentManifest(essentialsManifest)
  if (!essentialsValidation.success) {
    throw new Error('The bundled Essentials manifest is invalid.')
  }
  const sourceByPublicId = requireUniqueMap(
    snapshot.cards,
    buildStableEntryId,
    'Snapshot cards'
  )
  const mappingByWordId = requireUniqueMap(
    plan.mappings,
    mapping => mapping.wordId,
    'Plan mappings'
  )
  const classificationByWordId = requireUniqueMap(
    classification.cards,
    card => card.wordId,
    'Classification cards'
  )
  const essentialsKeys = new Set(
    essentialsValidation.data.entries.map(entry =>
      getSemanticWordKey(entry.dutch_lemma, entry.part_of_speech, entry.article)
    )
  )

  const inventoryPacks = packs.map(pack => {
    const cefrLevel = draftIndex.catalog.find(
      item =>
        item.pack_id === pack.manifest.pack_id &&
        item.version === pack.manifest.version
    )?.cefr_level
    if (!cefrLevel)
      throw new Error(`Missing CEFR for ${pack.manifest.pack_id}.`)
    const entries = pack.manifest.entries.map((entry, entryIndex) => {
      const sourceCard = sourceByPublicId.get(entry.entry_id)
      if (!sourceCard) {
        throw new Error(`Missing source card for ${entry.entry_id}.`)
      }
      const mapping = mappingByWordId.get(sourceCard.word_id)
      const cardClassification = classificationByWordId.get(sourceCard.word_id)
      if (
        !mapping ||
        mapping.targetKey.toLocaleLowerCase('en') !==
          pack.manifest.pack_id.replace('dutch-', '') ||
        mapping.inputHash !== cardClassification?.inputHash
      ) {
        throw new Error(`Review evidence mismatch for ${entry.entry_id}.`)
      }
      return buildInventoryEntry({
        pack,
        entry,
        entryIndex,
        sourceCard,
        mapping,
        classification: cardClassification,
        essentialsKeys,
        batchSize,
        packEntryCount: pack.manifest.entries.length,
        editorialEvidence: editorialEvidenceByWordId?.get(sourceCard.word_id),
      })
    })
    const proposedValidation = validateOfficialContentManifest({
      ...pack.manifest,
      entries: entries.map(entry => entry.proposedEntry),
    })
    if (!proposedValidation.success) {
      throw new Error(
        `Proposed editorial entries are invalid for ${pack.manifest.pack_id}.`
      )
    }
    return {
      packId: pack.manifest.pack_id,
      version: pack.manifest.version,
      title: pack.manifest.title,
      cefrLevel,
      entryCount: entries.length,
      batches: [...Map.groupBy(entries, entry => entry.batchId)].map(
        ([batchId, batchEntries]) => ({
          batchId,
          entryCount: batchEntries.length,
          entries: batchEntries,
        })
      ),
    }
  })
  const allEntries = inventoryPacks.flatMap(pack =>
    pack.batches.flatMap(batch => batch.entries)
  )
  if (allEntries.length !== draftIndex.entryCount) {
    throw new Error('Review inventory does not cover every draft entry.')
  }
  const unresolvedDecisionCount = allEntries.length
  const inventory = {
    schemaVersion: editorialEvidenceByWordId ? 2 : 1,
    generatedAt: snapshot.capturedAt,
    draftAggregateSha256: draftIndex.draftAggregateSha256,
    packCount: inventoryPacks.length,
    entryCount: allEntries.length,
    batchSize,
    summary: {
      reviewDecisionCounts: {
        approved: 0,
        override: 0,
        needsReview: unresolvedDecisionCount,
      },
      priorityFlagCounts: countFlags(allEntries),
      editorialSource: editorialSourceSummary,
    },
    packs: inventoryPacks,
  }
  const ledger = {
    schemaVersion: 1,
    draftAggregateSha256: draftIndex.draftAggregateSha256,
    reviewedBy: null,
    reviewedAt: null,
    decisions: allEntries.map(entry => ({
      entryId: entry.entryId,
      sourceContentSha256: entry.proposedContentSha256,
      decision: 'needs-review',
      priorityFlags: entry.priorityFlags,
      unresolvedLinguisticFields: entry.unresolvedLinguisticFields,
    })),
  }
  return { inventory, ledger }
}

export const prepareReviewInventory = async ({
  draftDir,
  snapshotPath,
  planPath,
  classificationPath,
  essentialsPath,
  outputDir,
  batchSize = DEFAULT_BATCH_SIZE,
  editorialSnapshotPath = null,
}) => {
  const [
    { index: draftIndex, packs },
    snapshotBytes,
    planBytes,
    classificationBytes,
    essentialsBytes,
  ] = await Promise.all([
    loadVerifiedArtifactSet(draftDir, {
      requiredStatus: 'pending',
      aggregateField: 'draftAggregateSha256',
    }),
    readFile(snapshotPath),
    readFile(planPath),
    readFile(classificationPath),
    readFile(essentialsPath),
  ])
  const snapshot = parseSnapshotCsv(snapshotBytes.toString('utf8'))
  const plan = JSON.parse(planBytes)
  const classification = JSON.parse(classificationBytes)
  const essentialsManifest = JSON.parse(essentialsBytes)
  const editorialSnapshotBytes = editorialSnapshotPath
    ? await readFile(editorialSnapshotPath)
    : null
  const editorialSnapshot = editorialSnapshotBytes
    ? parseSnapshotCsv(editorialSnapshotBytes.toString('utf8'))
    : null
  assertSourceBoundInputs({
    snapshotBytes,
    planBytes,
    snapshot,
    plan,
  })
  if (
    sha256(classificationBytes) !== plan.classificationProposalSha256 ||
    classification.productionWrites !== 0 ||
    classification.classificationComplete !== true
  ) {
    throw new Error('Classification evidence is not the reviewed proposal.')
  }
  const editorialSource = editorialSnapshot
    ? analyzeEditorialSnapshot({
        baselineSnapshot: snapshot,
        editorialSnapshot,
        mappedWordIds: plan.mappings.map(mapping => mapping.wordId),
      })
    : null
  const { inventory, ledger } = createReviewInventory({
    draftIndex,
    packs,
    snapshot,
    plan,
    classification,
    essentialsManifest,
    batchSize,
    editorialEvidenceByWordId: editorialSource?.evidenceByWordId ?? null,
    editorialSourceSummary: editorialSource
      ? {
          ...editorialSource.summary,
          snapshotSha256: sha256(editorialSnapshotBytes),
        }
      : null,
  })
  const inventorySerialized = `${JSON.stringify(inventory, null, 2)}\n`
  const ledgerSerialized = `${JSON.stringify(ledger, null, 2)}\n`
  const inventorySha256 = sha256(inventorySerialized)
  const ledgerSha256 = sha256(ledgerSerialized)
  const artifacts = new Map([
    ['inventory.json', inventorySerialized],
    ['review-ledger.json', ledgerSerialized],
    [
      'index.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          productionWrites: 0,
          draftAggregateSha256: draftIndex.draftAggregateSha256,
          inventorySha256,
          ledgerSha256,
          packCount: inventory.packCount,
          entryCount: inventory.entryCount,
          unresolvedDecisionCount: inventory.entryCount,
          editorialSource: inventory.summary.editorialSource,
        },
        null,
        2
      )}\n`,
    ],
  ])
  await writeArtifactDirectory(outputDir, artifacts)
  return { inventory, ledger, inventorySha256, ledgerSha256 }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const root = process.cwd()
  const args = parseCliArguments(process.argv.slice(2), {
    valueOptions: [
      '--draft',
      '--snapshot',
      '--plan',
      '--classification',
      '--essentials',
      '--editorial-snapshot',
      '--out',
      BATCH_SIZE_OPTION,
    ],
  })
  const batchSize = args.get(BATCH_SIZE_OPTION)
    ? Number(args.get(BATCH_SIZE_OPTION))
    : DEFAULT_BATCH_SIZE
  const result = await prepareReviewInventory({
    draftDir: path.resolve(
      args.get('--draft') ??
        path.join(
          root,
          'reports/vocabulary-organization/official-content-drafts-v3-2026-09-11'
        )
    ),
    snapshotPath: path.resolve(
      args.get('--snapshot') ??
        path.join(
          root,
          'reports/vocabulary-organization/snapshot-2026-09-07.csv'
        )
    ),
    planPath: path.resolve(
      args.get('--plan') ??
        path.join(
          root,
          'reports/vocabulary-organization/collection-plan-proposal-003-2026-09-11.json'
        )
    ),
    classificationPath: path.resolve(
      args.get('--classification') ??
        path.join(
          root,
          'reports/vocabulary-organization/classification-proposal-final-2026-09-07.json'
        )
    ),
    essentialsPath: path.resolve(
      args.get('--essentials') ??
        path.join(root, 'packages/content/src/dutch-a1.json')
    ),
    outputDir: path.resolve(
      args.get('--out') ??
        path.join(
          root,
          'reports/vocabulary-organization/official-content-review-v3-003-2026-09-11'
        )
    ),
    editorialSnapshotPath: path.resolve(
      args.get('--editorial-snapshot') ??
        path.join(root, 'reports/snapshot-editorial-2026-09-11.csv')
    ),
    batchSize,
  })
  console.log(
    JSON.stringify(
      {
        packCount: result.inventory.packCount,
        entryCount: result.inventory.entryCount,
        unresolvedDecisionCount:
          result.inventory.summary.reviewDecisionCounts.needsReview,
        priorityFlagCounts: result.inventory.summary.priorityFlagCounts,
        inventorySha256: result.inventorySha256,
        ledgerSha256: result.ledgerSha256,
        productionWrites: 0,
      },
      null,
      2
    )
  )
}
