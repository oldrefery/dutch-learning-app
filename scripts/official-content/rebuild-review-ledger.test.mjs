import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalizeOfficialContent } from '../../packages/content/src/manifest.ts'
import { sha256 } from './artifact-integrity.mjs'
import { buildReviewLedgerState } from './rebuild-review-ledger.mjs'

const DRAFT_HASH = 'draft-hash'
const ENTRY_ONE = 'entry-1'
const ENTRY_TWO = 'entry-2'
const ENTRY_ONE_SOURCE = `${ENTRY_ONE}-source`
const ENTRY_TWO_SOURCE = `${ENTRY_TWO}-source`
const BATCH_ID = 'pack-1-batch-01'

const entry = id => ({
  entryId: id,
  proposedContentSha256: `${id}-source`,
  priorityFlags: [],
  unresolvedLinguisticFields: [],
  proposedEntry: {
    entry_id: id,
    dutch_lemma: id,
    part_of_speech: 'noun',
    translations: { en: [id] },
    article: 'het',
    plural: `${id}s`,
  },
})

const input = () => {
  const inventoryDocument = {
    schemaVersion: 2,
    draftAggregateSha256: DRAFT_HASH,
    packs: [
      {
        packId: 'pack-1',
        batches: [
          {
            batchId: BATCH_ID,
            entries: [entry(ENTRY_ONE), entry(ENTRY_TWO)],
          },
        ],
      },
    ],
  }
  const bytes = `${JSON.stringify(inventoryDocument)}\n`
  const inventorySha256 = sha256(bytes)
  return {
    inventoryDocument,
    inventorySha256,
    index: {
      schemaVersion: 1,
      productionWrites: 0,
      draftAggregateSha256: DRAFT_HASH,
      inventorySha256,
    },
    batchRecords: [],
  }
}

const checks = {
  spelling: true,
  grammar: true,
  translations: true,
  examples: true,
  register: true,
  appropriateness: true,
  senseAndLevel: true,
}

test('rebuilds a complete ledger from immutable reviewed batches', () => {
  const data = input()
  const finalEntry = {
    ...data.inventoryDocument.packs[0].batches[0].entries[1].proposedEntry,
    translations: { en: ['corrected'] },
  }
  data.batchRecords = [
    {
      schemaVersion: 1,
      inventorySha256: data.inventorySha256,
      draftAggregateSha256: DRAFT_HASH,
      batchId: BATCH_ID,
      reviewedBy: 'editorial-reviewer',
      reviewedAt: '2026-09-11T00:00:00.000Z',
      checks,
      decisions: [
        {
          entryId: ENTRY_ONE,
          sourceContentSha256: ENTRY_ONE_SOURCE,
          decision: 'approved',
        },
        {
          entryId: ENTRY_TWO,
          sourceContentSha256: ENTRY_TWO_SOURCE,
          decision: 'override',
          explanation: 'Correct the translation.',
          finalEntry,
          finalContentSha256: sha256(canonicalizeOfficialContent(finalEntry)),
        },
      ],
    },
  ]

  const state = buildReviewLedgerState(data)

  assert.equal(state.index.completedBatchCount, 1)
  assert.deepEqual(state.index.reviewDecisionCounts, {
    approved: 1,
    override: 1,
    needsReview: 0,
  })
  assert.equal(state.ledger.decisions[1].finalEntry, finalEntry)
})

test('keeps uninspected entries unresolved', () => {
  const state = buildReviewLedgerState(input())

  assert.equal(state.index.completedBatchCount, 0)
  assert.equal(state.index.unresolvedDecisionCount, 2)
  assert.ok(
    state.ledger.decisions.every(
      decision => decision.decision === 'needs-review'
    )
  )
})

test('rejects incomplete checks, stale hashes, and incomplete decisions', () => {
  const data = input()
  const record = {
    schemaVersion: 1,
    inventorySha256: data.inventorySha256,
    draftAggregateSha256: DRAFT_HASH,
    batchId: BATCH_ID,
    reviewedBy: 'editorial-reviewer',
    reviewedAt: '2026-09-11T00:00:00.000Z',
    checks: { ...checks },
    decisions: [
      {
        entryId: ENTRY_ONE,
        sourceContentSha256: ENTRY_ONE_SOURCE,
        decision: 'approved',
      },
      {
        entryId: ENTRY_TWO,
        sourceContentSha256: ENTRY_TWO_SOURCE,
        decision: 'approved',
      },
    ],
  }

  record.checks.examples = false
  assert.throws(
    () => buildReviewLedgerState({ ...data, batchRecords: [record] }),
    /metadata is invalid/
  )
  record.checks.examples = true
  record.decisions[0].sourceContentSha256 = 'stale'
  assert.throws(
    () => buildReviewLedgerState({ ...data, batchRecords: [record] }),
    /stale/
  )
  record.decisions[0].sourceContentSha256 = ENTRY_ONE_SOURCE
  record.decisions.pop()
  assert.throws(
    () => buildReviewLedgerState({ ...data, batchRecords: [record] }),
    /incomplete decisions/
  )
})
