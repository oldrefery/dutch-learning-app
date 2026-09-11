import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'
import { parseCliArguments, sha256 } from './artifact-integrity.mjs'

const REVIEW_CHECKS = Object.freeze([
  'spelling',
  'grammar',
  'translations',
  'examples',
  'register',
  'appropriateness',
  'senseAndLevel',
])

const PRIVATE_VALIDATION_FIXTURE = 'Private validation fixture.'
const NEEDS_REVIEW = 'needs-review'

const fixtureManifest = entry => ({
  schema_version: 1,
  pack_id: 'editorial-validation',
  version: '1.0.0',
  title: 'Editorial validation',
  description: PRIVATE_VALIDATION_FIXTURE,
  source_language: 'nl',
  translation_languages: ['en', 'ru'],
  created_at: '2026-09-11T00:00:00.000Z',
  license: { name: 'Private review', url: null, notes: 'Not published.' },
  provenance: {
    origin: 'existing-project-library',
    source_snapshot_at: '2026-09-11T00:00:00.000Z',
    source_card_count: 1,
    source_unique_semantic_count: 1,
    selection_method: PRIVATE_VALIDATION_FIXTURE,
    notes: PRIVATE_VALIDATION_FIXTURE,
    excluded_sources: ['Private source content'],
  },
  content_review: {
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    notes: PRIVATE_VALIDATION_FIXTURE,
  },
  entries: [entry],
})

const flattenBatches = inventory =>
  inventory.packs.flatMap(pack =>
    pack.batches.map(batch => ({ ...batch, packId: pack.packId }))
  )

const requireExactDecisionIds = (batch, decisions) => {
  if (!Array.isArray(decisions) || decisions.length !== batch.entries.length) {
    throw new Error(`Review batch ${batch.batchId} has incomplete decisions.`)
  }
  const expected = new Set(batch.entries.map(entry => entry.entryId))
  const actual = decisions.map(decision => decision?.entryId)
  if (
    new Set(actual).size !== actual.length ||
    actual.some(entryId => !expected.has(entryId))
  ) {
    throw new Error(`Review batch ${batch.batchId} has invalid decision IDs.`)
  }
}

const validateDecision = (inventoryEntry, decision) => {
  if (decision.sourceContentSha256 !== inventoryEntry.proposedContentSha256) {
    throw new Error(`Review decision is stale for ${inventoryEntry.entryId}.`)
  }
  if (decision.decision === 'approved') {
    if (decision.finalEntry !== undefined) {
      throw new Error(
        `Approved decision ${inventoryEntry.entryId} has content.`
      )
    }
    return decision
  }
  if (decision.decision === NEEDS_REVIEW) {
    if (
      typeof decision.explanation !== 'string' ||
      decision.explanation.trim() === '' ||
      decision.finalEntry !== undefined
    ) {
      throw new Error(
        `Unresolved decision ${inventoryEntry.entryId} is invalid.`
      )
    }
    return decision
  }
  if (
    decision.decision !== 'override' ||
    typeof decision.explanation !== 'string' ||
    decision.explanation.trim() === '' ||
    decision.finalEntry?.entry_id !== inventoryEntry.entryId ||
    decision.finalContentSha256 !==
      sha256(canonicalizeOfficialContent(decision.finalEntry))
  ) {
    throw new Error(`Override decision ${inventoryEntry.entryId} is invalid.`)
  }
  const validation = validateOfficialContentManifest(
    fixtureManifest(decision.finalEntry)
  )
  if (!validation.success) {
    throw new Error(`Override entry ${inventoryEntry.entryId} is invalid.`)
  }
  return decision
}

const validateBatchRecord = (inventory, batch, record) => {
  if (
    record?.schemaVersion !== 1 ||
    record.inventorySha256 !== inventory.inventorySha256 ||
    record.draftAggregateSha256 !== inventory.draftAggregateSha256 ||
    record.batchId !== batch.batchId ||
    typeof record.reviewedBy !== 'string' ||
    record.reviewedBy.trim() === '' ||
    Number.isNaN(Date.parse(record.reviewedAt)) ||
    REVIEW_CHECKS.some(check => record.checks?.[check] !== true)
  ) {
    throw new Error(`Review batch ${batch.batchId} metadata is invalid.`)
  }
  requireExactDecisionIds(batch, record.decisions)
  const entryById = new Map(batch.entries.map(entry => [entry.entryId, entry]))
  return {
    ...record,
    decisions: record.decisions.map(decision =>
      validateDecision(entryById.get(decision.entryId), decision)
    ),
  }
}

export const buildReviewLedgerState = ({
  inventoryDocument,
  inventorySha256,
  index,
  batchRecords,
}) => {
  if (
    inventoryDocument?.schemaVersion !== 2 ||
    inventoryDocument.draftAggregateSha256 !== index.draftAggregateSha256 ||
    index.inventorySha256 !== inventorySha256
  ) {
    throw new Error('Review inventory integrity is invalid.')
  }
  const inventory = { ...inventoryDocument, inventorySha256 }
  const batches = flattenBatches(inventoryDocument)
  const batchById = new Map(batches.map(batch => [batch.batchId, batch]))
  if (batchById.size !== batches.length) {
    throw new Error('Review inventory contains duplicate batch IDs.')
  }
  const recordByBatchId = new Map()
  for (const record of batchRecords) {
    const batch = batchById.get(record?.batchId)
    if (!batch || recordByBatchId.has(record.batchId)) {
      throw new Error('Review records contain an unknown or duplicate batch.')
    }
    recordByBatchId.set(
      record.batchId,
      validateBatchRecord(inventory, batch, record)
    )
  }

  const reviewedDecisionById = new Map(
    [...recordByBatchId.values()].flatMap(record =>
      record.decisions.map(decision => [decision.entryId, decision])
    )
  )
  const allEntries = batches.flatMap(batch => batch.entries)
  const decisions = allEntries.map(
    entry =>
      reviewedDecisionById.get(entry.entryId) ?? {
        entryId: entry.entryId,
        sourceContentSha256: entry.proposedContentSha256,
        decision: NEEDS_REVIEW,
        priorityFlags: entry.priorityFlags,
        unresolvedLinguisticFields: entry.unresolvedLinguisticFields,
      }
  )
  const reviewDecisionCounts = {
    approved: decisions.filter(decision => decision.decision === 'approved')
      .length,
    override: decisions.filter(decision => decision.decision === 'override')
      .length,
    needsReview: decisions.filter(
      decision => decision.decision === NEEDS_REVIEW
    ).length,
  }
  const ledger = {
    schemaVersion: 1,
    draftAggregateSha256: inventoryDocument.draftAggregateSha256,
    reviewedBy: null,
    reviewedAt: null,
    decisions,
  }
  const ledgerSerialized = `${JSON.stringify(ledger, null, 2)}\n`
  const reviewedBatchIds = [...recordByBatchId.keys()].sort()
  const nextIndex = {
    ...index,
    ledgerSha256: sha256(ledgerSerialized),
    unresolvedDecisionCount: reviewDecisionCounts.needsReview,
    totalBatchCount: batches.length,
    completedBatchCount: reviewedBatchIds.length,
    reviewedBatchIds,
    reviewDecisionCounts,
  }
  return { ledger, ledgerSerialized, index: nextIndex }
}

const writeAtomic = async (filename, content) => {
  const temporary = `${filename}.tmp-${process.pid}`
  await writeFile(temporary, content, { flag: 'wx' })
  await rename(temporary, filename)
}

export const rebuildReviewLedger = async reviewDir => {
  const inventoryPath = path.join(reviewDir, 'inventory.json')
  const indexPath = path.join(reviewDir, 'index.json')
  const batchDir = path.join(reviewDir, 'batches')
  const [inventoryBytes, indexBytes] = await Promise.all([
    readFile(inventoryPath),
    readFile(indexPath),
  ])
  await mkdir(batchDir, { recursive: true })
  const batchFiles = (await readdir(batchDir))
    .filter(filename => filename.endsWith('.json'))
    .sort()
  const batchRecords = await Promise.all(
    batchFiles.map(async filename =>
      JSON.parse(await readFile(path.join(batchDir, filename), 'utf8'))
    )
  )
  const state = buildReviewLedgerState({
    inventoryDocument: JSON.parse(inventoryBytes),
    inventorySha256: sha256(inventoryBytes),
    index: JSON.parse(indexBytes),
    batchRecords,
  })
  await writeAtomic(
    path.join(reviewDir, 'review-ledger.json'),
    state.ledgerSerialized
  )
  await writeAtomic(indexPath, `${JSON.stringify(state.index, null, 2)}\n`)
  return state.index
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const args = parseCliArguments(process.argv.slice(2), {
    valueOptions: ['--review-dir'],
  })
  const reviewDir = path.resolve(
    args.get('--review-dir') ??
      path.join(
        process.cwd(),
        'reports/vocabulary-organization/official-content-review-v3-003-2026-09-11'
      )
  )
  const index = await rebuildReviewLedger(reviewDir)
  console.log(
    JSON.stringify(
      {
        totalBatchCount: index.totalBatchCount,
        completedBatchCount: index.completedBatchCount,
        reviewDecisionCounts: index.reviewDecisionCounts,
        ledgerSha256: index.ledgerSha256,
        productionWrites: index.productionWrites,
      },
      null,
      2
    )
  )
}
