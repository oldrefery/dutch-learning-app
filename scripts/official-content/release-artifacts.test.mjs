import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { canonicalizeOfficialContent } from '../../packages/content/src/manifest.ts'
import {
  approveVocabularyPacks,
  validateReviewLedger,
} from './approve-vocabulary-packs.mjs'
import {
  assertNoForbiddenPublicTerms,
  calculateArtifactAggregateSha256,
  loadVerifiedArtifactSet,
  parseCliArguments,
  sha256,
} from './artifact-integrity.mjs'
import { writeArtifactDirectory } from './build-vocabulary-packs.mjs'
import {
  OfficialContentPublicationError,
  publishVocabularyPacks,
} from './publish-vocabulary-packs.mjs'

const REVIEWED_AT = '2026-09-11T12:00:00.000Z'
const REVIEWED_BY = 'editor@example.test'
const FIRST_PACK_ID = 'dutch-a1-01'
const SECOND_PACK_ID = 'dutch-a1-02'
const PACK_FILENAME = 'dutch-a1-01-1.0.0.json'
const INDEX_FILENAME = 'index.json'
const SYNTHETIC_SUPABASE_URL = 'https://synthetic.supabase.co'

const pendingManifest = ({
  packId = FIRST_PACK_ID,
  entryId = 'entry-synthetic',
  lemma = 'leren',
} = {}) => ({
  schema_version: 1,
  pack_id: packId,
  version: '1.0.0',
  title: 'Dutch A1 · Pack 01',
  description: 'Synthetic test pack.',
  source_language: 'nl',
  translation_languages: ['en'],
  created_at: REVIEWED_AT,
  license: { name: 'Test', url: null, notes: 'Synthetic test content.' },
  provenance: {
    origin: 'existing-project-library',
    source_snapshot_at: REVIEWED_AT,
    source_card_count: 1,
    source_unique_semantic_count: 1,
    selection_method: 'Synthetic fixture.',
    notes: 'Synthetic fixture.',
    excluded_sources: ['Private data'],
  },
  content_review: {
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    notes: 'Pending review.',
  },
  entries: [
    {
      entry_id: entryId,
      dutch_lemma: lemma,
      part_of_speech: 'verb',
      translations: { en: ['to learn'] },
      examples: [{ nl: 'Ik leer.', en: 'I learn.' }],
      is_irregular: false,
      is_reflexive: false,
      is_expression: false,
      is_separable: false,
      conjugation: null,
      article: null,
      register: 'neutral',
    },
  ],
})

const prepareDraft = async (root, manifests = [pendingManifest()]) => {
  const draftDir = path.join(root, 'draft')
  const artifacts = new Map()
  const files = manifests.map(manifest => {
    const filename = `${manifest.pack_id}-${manifest.version}.json`
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`
    artifacts.set(filename, serialized)
    return {
      packId: manifest.pack_id,
      version: manifest.version,
      filename,
      entryCount: manifest.entries.length,
      contentSha256: sha256(canonicalizeOfficialContent(manifest)),
      fileSha256: sha256(serialized),
    }
  })
  const index = {
    schemaVersion: 1,
    productionWrites: 0,
    packCount: files.length,
    entryCount: manifests.reduce(
      (count, manifest) => count + manifest.entries.length,
      0
    ),
    forbiddenPublicLemmas: [
      'hottentot',
      'klit',
      'mongool',
      'piemel',
      'rukken',
      'swaffelen',
    ],
    catalog: manifests.map((manifest, index) => ({
      pack_id: manifest.pack_id,
      version: manifest.version,
      entry_count: manifest.entries.length,
      content_sha256: files[index].contentSha256,
      review_status: 'draft',
    })),
    files,
    draftAggregateSha256: calculateArtifactAggregateSha256(files),
  }
  artifacts.set(INDEX_FILENAME, `${JSON.stringify(index, null, 2)}\n`)
  await writeArtifactDirectory(draftDir, artifacts)
  return { draftDir, index, manifest: manifests[0], manifests }
}

const prepareLedger = async (root, index, manifestInput, decisions) => {
  const manifests = Array.isArray(manifestInput)
    ? manifestInput
    : [manifestInput]
  const ledger = {
    schemaVersion: 1,
    draftAggregateSha256: index.draftAggregateSha256,
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
    decisions:
      decisions ??
      manifests.flatMap(manifest =>
        manifest.entries.map(entry => ({
          entryId: entry.entry_id,
          sourceContentSha256: sha256(canonicalizeOfficialContent(entry)),
          decision: 'approved',
        }))
      ),
  }
  const ledgerPath = path.join(root, 'review-ledger.json')
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
  return ledgerPath
}

test('approves only the exact complete review ledger into an atomic release', async context => {
  const root = await mkdtemp(path.join(tmpdir(), 'official-content-approve-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const { draftDir, index, manifest } = await prepareDraft(root)
  const reviewLedgerPath = await prepareLedger(root, index, manifest)
  const outputDir = path.join(root, 'release')

  const release = await approveVocabularyPacks({
    inputDir: draftDir,
    outputDir,
    reviewLedgerPath,
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
  })

  assert.equal(release.approvedFromDraftSha256, index.draftAggregateSha256)
  assert.match(release.reviewLedgerSha256, /^[a-f\d]{64}$/u)
  assert.match(release.releaseAggregateSha256, /^[a-f\d]{64}$/u)
  const verified = await loadVerifiedArtifactSet(outputDir, {
    requiredStatus: 'approved',
    aggregateField: 'releaseAggregateSha256',
  })
  assert.equal(verified.packs[0].manifest.entries[0].is_irregular, false)

  const dryRun = await publishVocabularyPacks({ releaseDir: outputDir })
  assert.equal(dryRun.mode, 'dry-run')
  assert.equal(dryRun.productionWrites, 0)
  assert.deepEqual(dryRun.completedPackIds, [])

  await assert.rejects(
    publishVocabularyPacks({
      releaseDir: outputDir,
      apply: true,
      projectRef: 'synthetic',
      supabaseUrl: 'http://synthetic.supabase.co',
      serviceRoleKey: 'secret',
      fetchImpl: async () => ({ ok: true }),
    }),
    /exact HTTPS Supabase URL/
  )

  const requests = []
  const applied = await publishVocabularyPacks({
    releaseDir: outputDir,
    apply: true,
    projectRef: 'synthetic',
    supabaseUrl: SYNTHETIC_SUPABASE_URL,
    serviceRoleKey: 'secret',
    fetchImpl: async (url, request) => {
      requests.push({ url, request })
      return { ok: true }
    },
    now: () => REVIEWED_AT,
  })
  assert.deepEqual(applied.completedPackIds, [FIRST_PACK_ID])
  assert.deepEqual(applied.failedPackIds, [])
  assert.equal(applied.productionWrites, 1)
  assert.equal(requests[0].request.signal.aborted, false)
})

test('rejects tampered drafts and incomplete review ledgers without output', async context => {
  const root = await mkdtemp(path.join(tmpdir(), 'official-content-reject-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const { draftDir, index, manifest } = await prepareDraft(root)
  const reviewLedgerPath = await prepareLedger(root, index, manifest, [])
  const outputDir = path.join(root, 'release')

  await assert.rejects(
    approveVocabularyPacks({
      inputDir: draftDir,
      outputDir,
      reviewLedgerPath,
      reviewedBy: REVIEWED_BY,
      reviewedAt: REVIEWED_AT,
    }),
    /does not cover every draft entry/
  )
  await assert.rejects(readFile(path.join(outputDir, INDEX_FILENAME)), {
    code: 'ENOENT',
  })

  await writeFile(path.join(draftDir, PACK_FILENAME), '{"tampered":true}\n')
  await assert.rejects(
    loadVerifiedArtifactSet(draftDir, {
      requiredStatus: 'pending',
      aggregateField: 'draftAggregateSha256',
    }),
    /File integrity check failed/
  )
})

test('rejects stale decisions and unresolved linguistic fields', () => {
  const manifest = pendingManifest()
  delete manifest.entries[0].is_irregular
  const draftIndex = { draftAggregateSha256: 'draft' }
  const decision = {
    entryId: manifest.entries[0].entry_id,
    sourceContentSha256: sha256(
      canonicalizeOfficialContent(manifest.entries[0])
    ),
    decision: 'approved',
  }
  const ledger = {
    schemaVersion: 1,
    draftAggregateSha256: 'draft',
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
    decisions: [decision],
  }
  assert.throws(
    () =>
      validateReviewLedger({
        ledger,
        ledgerBytes: JSON.stringify(ledger),
        draftIndex,
        packs: [{ manifest }],
        reviewedBy: REVIEWED_BY,
        reviewedAt: REVIEWED_AT,
      }),
    /unresolved irregularity or conjugation/
  )

  decision.sourceContentSha256 = 'stale'
  assert.throws(
    () =>
      validateReviewLedger({
        ledger,
        ledgerBytes: JSON.stringify(ledger),
        draftIndex,
        packs: [{ manifest: pendingManifest() }],
        reviewedBy: REVIEWED_BY,
        reviewedAt: REVIEWED_AT,
      }),
    /Review decision is stale/
  )

  decision.sourceContentSha256 = sha256(
    canonicalizeOfficialContent(manifest.entries[0])
  )
  decision.decision = 'needs-review'
  assert.throws(
    () =>
      validateReviewLedger({
        ledger,
        ledgerBytes: JSON.stringify(ledger),
        draftIndex,
        packs: [{ manifest }],
        reviewedBy: REVIEWED_BY,
        reviewedAt: REVIEWED_AT,
      }),
    /Invalid override decision/
  )
})

test('rejects semantic collisions introduced by review overrides', () => {
  const first = pendingManifest()
  const second = pendingManifest({
    packId: SECOND_PACK_ID,
    entryId: 'entry-second',
    lemma: 'werken',
  })
  const sourceEntry = second.entries[0]
  const finalEntry = { ...sourceEntry, dutch_lemma: 'leren' }
  const draftIndex = { draftAggregateSha256: 'draft' }
  const ledger = {
    schemaVersion: 1,
    draftAggregateSha256: 'draft',
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
    decisions: [
      {
        entryId: first.entries[0].entry_id,
        sourceContentSha256: sha256(
          canonicalizeOfficialContent(first.entries[0])
        ),
        decision: 'approved',
      },
      {
        entryId: sourceEntry.entry_id,
        sourceContentSha256: sha256(canonicalizeOfficialContent(sourceEntry)),
        decision: 'override',
        explanation: 'Synthetic collision regression.',
        finalEntry,
        finalContentSha256: sha256(canonicalizeOfficialContent(finalEntry)),
      },
    ],
  }
  assert.throws(
    () =>
      validateReviewLedger({
        ledger,
        ledgerBytes: JSON.stringify(ledger),
        draftIndex,
        packs: [{ manifest: first }, { manifest: second }],
        reviewedBy: REVIEWED_BY,
        reviewedAt: REVIEWED_AT,
      }),
    /semantic key collisions/
  )
})

test('excludes a reviewed semantic duplicate and reconciles release counts', async context => {
  const root = await mkdtemp(path.join(tmpdir(), 'official-content-exclude-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const manifest = pendingManifest()
  const duplicate = structuredClone(manifest.entries[0])
  duplicate.entry_id = 'entry-duplicate'
  manifest.entries.push(duplicate)
  manifest.provenance.source_card_count = 2
  const { draftDir, index } = await prepareDraft(root, [manifest])
  const decisions = [
    {
      entryId: manifest.entries[0].entry_id,
      sourceContentSha256: sha256(
        canonicalizeOfficialContent(manifest.entries[0])
      ),
      decision: 'approved',
    },
    {
      entryId: duplicate.entry_id,
      sourceContentSha256: sha256(canonicalizeOfficialContent(duplicate)),
      decision: 'exclude',
      explanation: 'The released semantic key is already represented.',
    },
  ]
  const reviewLedgerPath = await prepareLedger(root, index, manifest, decisions)
  const outputDir = path.join(root, 'release')

  const release = await approveVocabularyPacks({
    inputDir: draftDir,
    outputDir,
    reviewLedgerPath,
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
  })

  assert.equal(release.entryCount, 1)
  assert.deepEqual(release.semanticUniqueness, {
    entryCount: 1,
    uniqueSemanticCount: 1,
    collisionGroupCount: 0,
    collidingEntryCount: 0,
    collisions: [],
  })
  assert.equal(release.files[0].entryCount, 1)
  assert.equal(release.catalog[0].entry_count, 1)
  const verified = await loadVerifiedArtifactSet(outputDir, {
    requiredStatus: 'approved',
    aggregateField: 'releaseAggregateSha256',
  })
  assert.deepEqual(
    verified.packs[0].manifest.entries.map(entry => entry.entry_id),
    [manifest.entries[0].entry_id]
  )

  decisions[1].finalEntry = duplicate
  assert.throws(
    () =>
      validateReviewLedger({
        ledger: {
          schemaVersion: 1,
          draftAggregateSha256: index.draftAggregateSha256,
          reviewedBy: REVIEWED_BY,
          reviewedAt: REVIEWED_AT,
          decisions,
        },
        ledgerBytes: 'invalid exclusion',
        draftIndex: index,
        packs: [{ manifest }],
        reviewedBy: REVIEWED_BY,
        reviewedAt: REVIEWED_AT,
      }),
    /Invalid exclusion decision/
  )
})

test('scans every public string field for excluded whole words', () => {
  assert.throws(
    () =>
      assertNoForbiddenPublicTerms(
        { examples: [{ nl: 'Dit voorbeeld bevat mongool.' }] },
        ['mongool']
      ),
    /Forbidden public term found: mongool/
  )
  assert.doesNotThrow(() =>
    assertNoForbiddenPublicTerms(
      { examples: [{ nl: 'Dit woord is ongemakkelijk.' }] },
      ['gemak']
    )
  )
})

test('rejects unknown, duplicated, and valueless CLI options', () => {
  assert.throws(
    () => parseCliArguments(['--unknown'], { valueOptions: ['--out'] }),
    /Unknown option/
  )
  assert.throws(
    () =>
      parseCliArguments(['--out', 'one', '--out', 'two'], {
        valueOptions: ['--out'],
      }),
    /Duplicate option/
  )
  assert.throws(
    () => parseCliArguments(['--out', '--apply'], { valueOptions: ['--out'] }),
    /requires a value/
  )
})

test('rejects duplicate, incomplete, and escaping artifact indexes', async context => {
  const root = await mkdtemp(path.join(tmpdir(), 'official-content-index-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const { draftDir, index } = await prepareDraft(root)
  const indexPath = path.join(draftDir, INDEX_FILENAME)

  const duplicate = {
    ...index,
    packCount: 2,
    entryCount: 2,
    files: [index.files[0], index.files[0]],
    catalog: [index.catalog[0], index.catalog[0]],
  }
  duplicate.draftAggregateSha256 = calculateArtifactAggregateSha256(
    duplicate.files
  )
  await writeFile(indexPath, `${JSON.stringify(duplicate, null, 2)}\n`)
  await assert.rejects(
    loadVerifiedArtifactSet(draftDir, {
      requiredStatus: 'pending',
      aggregateField: 'draftAggregateSha256',
    }),
    /Artifact filenames must be unique/
  )

  const incomplete = { ...index, packCount: 2 }
  await writeFile(indexPath, `${JSON.stringify(incomplete, null, 2)}\n`)
  await assert.rejects(
    loadVerifiedArtifactSet(draftDir, {
      requiredStatus: 'pending',
      aggregateField: 'draftAggregateSha256',
    }),
    /inconsistent pack counts/
  )

  const escaping = {
    ...index,
    files: [{ ...index.files[0], filename: '../private.json' }],
  }
  escaping.draftAggregateSha256 = calculateArtifactAggregateSha256(
    escaping.files
  )
  await writeFile(indexPath, `${JSON.stringify(escaping, null, 2)}\n`)
  await assert.rejects(
    loadVerifiedArtifactSet(draftDir, {
      requiredStatus: 'pending',
      aggregateField: 'draftAggregateSha256',
    }),
    /Unsafe artifact filename/
  )
})

test('reports partial publication and safely retries the immutable release', async context => {
  const root = await mkdtemp(path.join(tmpdir(), 'official-content-resume-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const manifests = [
    pendingManifest(),
    pendingManifest({
      packId: SECOND_PACK_ID,
      entryId: 'entry-second',
      lemma: 'werken',
    }),
  ]
  const { draftDir, index } = await prepareDraft(root, manifests)
  const reviewLedgerPath = await prepareLedger(root, index, manifests)
  const releaseDir = path.join(root, 'release')
  await approveVocabularyPacks({
    inputDir: draftDir,
    outputDir: releaseDir,
    reviewLedgerPath,
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
  })

  let request = 0
  await assert.rejects(
    publishVocabularyPacks({
      releaseDir,
      apply: true,
      projectRef: 'synthetic',
      supabaseUrl: SYNTHETIC_SUPABASE_URL,
      serviceRoleKey: 'secret',
      fetchImpl: async () => {
        request += 1
        return request === 1
          ? { ok: true }
          : { ok: false, status: 503, text: async () => 'Unavailable' }
      },
      now: () => REVIEWED_AT,
    }),
    error => {
      assert.ok(error instanceof OfficialContentPublicationError)
      assert.deepEqual(error.summary.completedPackIds, [FIRST_PACK_ID])
      assert.deepEqual(error.summary.failedPackIds, [SECOND_PACK_ID])
      return true
    }
  )

  const retry = await publishVocabularyPacks({
    releaseDir,
    apply: true,
    projectRef: 'synthetic',
    supabaseUrl: SYNTHETIC_SUPABASE_URL,
    serviceRoleKey: 'secret',
    fetchImpl: async () => ({ ok: true }),
    now: () => REVIEWED_AT,
  })
  assert.deepEqual(retry.completedPackIds, [FIRST_PACK_ID, SECOND_PACK_ID])
  assert.deepEqual(retry.failedPackIds, [])
})
