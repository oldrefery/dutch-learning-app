import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'
import {
  calculateArtifactAggregateSha256,
  loadVerifiedArtifactSet,
  parseCliArguments,
  sha256,
} from './artifact-integrity.mjs'
import {
  analyzeSemanticUniqueness,
  writeArtifactDirectory,
} from './build-vocabulary-packs.mjs'

const requireReviewMetadata = (reviewedBy, reviewedAt) => {
  if (
    typeof reviewedBy !== 'string' ||
    reviewedBy.trim() === '' ||
    typeof reviewedAt !== 'string' ||
    Number.isNaN(Date.parse(reviewedAt))
  ) {
    throw new Error(
      'Use --reviewed-by <stable reviewer> --reviewed-at <ISO timestamp> after editorial review.'
    )
  }
  return {
    reviewedBy: reviewedBy.trim(),
    reviewedAt: new Date(reviewedAt).toISOString(),
  }
}

const requireUniqueDecisions = decisions => {
  if (!Array.isArray(decisions)) {
    throw new Error('The review ledger must contain decisions.')
  }
  const entryIds = decisions.map(decision => decision?.entryId)
  if (
    entryIds.some(entryId => typeof entryId !== 'string') ||
    new Set(entryIds).size !== entryIds.length
  ) {
    throw new Error('Review ledger entry IDs must be present and unique.')
  }
  return new Map(decisions.map(decision => [decision.entryId, decision]))
}

const applyDecision = (entry, decision) => {
  const sourceContentSha256 = sha256(canonicalizeOfficialContent(entry))
  if (decision?.sourceContentSha256 !== sourceContentSha256) {
    throw new Error(`Review decision is stale for ${entry.entry_id}.`)
  }
  if (decision.decision === 'approved') {
    if (decision.finalEntry !== undefined) {
      throw new Error(
        `Approved decision ${entry.entry_id} cannot replace content.`
      )
    }
    return entry
  }
  if (decision.decision === 'exclude') {
    if (
      typeof decision.explanation !== 'string' ||
      decision.explanation.trim() === '' ||
      decision.finalEntry !== undefined ||
      decision.finalContentSha256 !== undefined
    ) {
      throw new Error(`Invalid exclusion decision for ${entry.entry_id}.`)
    }
    return null
  }
  if (
    decision.decision !== 'override' ||
    typeof decision.explanation !== 'string' ||
    decision.explanation.trim() === '' ||
    !decision.finalEntry ||
    decision.finalEntry.entry_id !== entry.entry_id
  ) {
    throw new Error(`Invalid override decision for ${entry.entry_id}.`)
  }
  if (
    decision.finalContentSha256 !==
    sha256(canonicalizeOfficialContent(decision.finalEntry))
  ) {
    throw new Error(`Override content hash is invalid for ${entry.entry_id}.`)
  }
  return decision.finalEntry
}

const assertLinguisticReviewComplete = entry => {
  if (entry.part_of_speech === 'verb') {
    if (
      typeof entry.is_irregular !== 'boolean' ||
      !Object.hasOwn(entry, 'conjugation')
    ) {
      throw new Error(
        `Verb ${entry.entry_id} has unresolved irregularity or conjugation.`
      )
    }
  }
  if (entry.part_of_speech === 'noun' && !Object.hasOwn(entry, 'plural')) {
    throw new Error(`Noun ${entry.entry_id} has an unresolved plural.`)
  }
}

export const validateReviewLedger = ({
  ledger,
  ledgerBytes,
  draftIndex,
  packs,
  reviewedBy,
  reviewedAt,
}) => {
  const ledgerReviewTimestamp = Date.parse(ledger?.reviewedAt)
  if (
    ledger?.schemaVersion !== 1 ||
    ledger.draftAggregateSha256 !== draftIndex.draftAggregateSha256 ||
    ledger.reviewedBy !== reviewedBy ||
    Number.isNaN(ledgerReviewTimestamp) ||
    new Date(ledgerReviewTimestamp).toISOString() !== reviewedAt
  ) {
    throw new Error('The review ledger is not bound to this draft and review.')
  }
  const decisionById = requireUniqueDecisions(ledger.decisions)
  const entryCount = packs.reduce(
    (count, pack) => count + pack.manifest.entries.length,
    0
  )
  if (decisionById.size !== entryCount) {
    throw new Error('The review ledger does not cover every draft entry.')
  }
  const draftIds = new Set(
    packs.flatMap(pack => pack.manifest.entries.map(entry => entry.entry_id))
  )
  if ([...decisionById].some(([entryId]) => !draftIds.has(entryId))) {
    throw new Error('The review ledger contains an unknown entry.')
  }
  const reviewedPacks = packs.map(pack => ({
    ...pack,
    manifest: {
      ...pack.manifest,
      entries: pack.manifest.entries.flatMap(entry => {
        const reviewedEntry = applyDecision(
          entry,
          decisionById.get(entry.entry_id)
        )
        if (reviewedEntry === null) {
          return []
        }
        assertLinguisticReviewComplete(reviewedEntry)
        return [reviewedEntry]
      }),
    },
  }))
  const semanticUniqueness = analyzeSemanticUniqueness(
    reviewedPacks.map(pack => pack.manifest)
  )
  if (semanticUniqueness.collisionGroupCount > 0) {
    throw new Error('Review overrides introduce semantic key collisions.')
  }
  for (const pack of reviewedPacks) {
    pack.manifest.provenance.source_unique_semantic_count =
      semanticUniqueness.uniqueSemanticCount
  }
  return {
    reviewedPacks,
    reviewLedgerSha256: sha256(ledgerBytes),
    semanticUniqueness,
  }
}

export const approveVocabularyPacks = async ({
  inputDir,
  outputDir,
  reviewLedgerPath,
  reviewedBy,
  reviewedAt,
}) => {
  const review = requireReviewMetadata(reviewedBy, reviewedAt)
  const [{ index: draftIndex, packs }, ledgerBytes] = await Promise.all([
    loadVerifiedArtifactSet(inputDir, {
      requiredStatus: 'pending',
      aggregateField: 'draftAggregateSha256',
    }),
    readFile(reviewLedgerPath),
  ])
  const ledger = JSON.parse(ledgerBytes)
  const { reviewedPacks, reviewLedgerSha256, semanticUniqueness } =
    validateReviewLedger({
      ledger,
      ledgerBytes,
      draftIndex,
      packs,
      ...review,
    })

  const artifacts = new Map()
  const files = reviewedPacks.map(pack => {
    const manifest = {
      ...pack.manifest,
      content_review: {
        status: 'approved',
        reviewed_by: review.reviewedBy,
        reviewed_at: review.reviewedAt,
        notes:
          'The complete private review ledger records a current decision and content hash for every released entry.',
      },
    }
    const validation = validateOfficialContentManifest(manifest)
    if (!validation.success) {
      throw new Error(`Approved manifest ${pack.file.filename} is invalid.`)
    }
    const serialized = `${JSON.stringify(validation.data, null, 2)}\n`
    artifacts.set(pack.file.filename, serialized)
    return {
      ...pack.file,
      entryCount: validation.data.entries.length,
      contentSha256: sha256(canonicalizeOfficialContent(validation.data)),
      fileSha256: sha256(serialized),
    }
  })
  const fileByIdentity = new Map(
    files.map(file => [`${file.packId}@${file.version}`, file])
  )
  const catalog = draftIndex.catalog.map(item => {
    const file = fileByIdentity.get(`${item.pack_id}@${item.version}`)
    return {
      ...item,
      entry_count: file.entryCount,
      content_sha256: file.contentSha256,
      review_status: 'published',
    }
  })
  const releaseIndex = {
    ...draftIndex,
    entryCount: files.reduce((count, file) => count + file.entryCount, 0),
    semanticUniqueness,
    approvedFromDraftSha256: draftIndex.draftAggregateSha256,
    approvedAt: review.reviewedAt,
    approvedBy: review.reviewedBy,
    reviewLedgerSha256,
    catalog,
    files,
    releaseAggregateSha256: calculateArtifactAggregateSha256(files),
  }
  artifacts.set('index.json', `${JSON.stringify(releaseIndex, null, 2)}\n`)
  await writeArtifactDirectory(outputDir, artifacts)
  return releaseIndex
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const root = process.cwd()
  const args = parseCliArguments(process.argv.slice(2), {
    valueOptions: [
      '--input',
      '--out',
      '--review-ledger',
      '--reviewed-by',
      '--reviewed-at',
    ],
  })
  const inputDir = path.resolve(
    args.get('--input') ??
      path.join(
        root,
        'reports/vocabulary-organization/official-content-drafts-v3-2026-09-11'
      )
  )
  const outputDir = path.resolve(
    args.get('--out') ??
      path.join(
        root,
        'reports/vocabulary-organization/official-content-release-2026-09-11'
      )
  )
  const reviewLedgerPath = path.resolve(
    args.get('--review-ledger') ??
      path.join(
        root,
        'reports/vocabulary-organization/official-content-review-v3-003-2026-09-11/review-ledger.json'
      )
  )
  const release = await approveVocabularyPacks({
    inputDir,
    outputDir,
    reviewLedgerPath,
    reviewedBy: args.get('--reviewed-by'),
    reviewedAt: args.get('--reviewed-at'),
  })
  console.log(
    JSON.stringify(
      {
        approvedBy: release.approvedBy,
        approvedAt: release.approvedAt,
        packCount: release.packCount,
        entryCount: release.entryCount,
        releaseAggregateSha256: release.releaseAggregateSha256,
        productionWrites: release.productionWrites,
      },
      null,
      2
    )
  )
}
