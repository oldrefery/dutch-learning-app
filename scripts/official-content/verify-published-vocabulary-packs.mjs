import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  loadVerifiedArtifactSet,
  parseCliArguments,
} from './artifact-integrity.mjs'

const DEFAULT_TIMEOUT_MS = 15_000

const verificationTarget = (projectRef, supabaseUrl, anonKey) => {
  if (!projectRef || !supabaseUrl || !anonKey) {
    throw new Error(
      'Verification requires --project-ref, SUPABASE_URL, and SUPABASE_ANON_KEY.'
    )
  }
  const url = new URL(supabaseUrl)
  if (
    url.protocol !== 'https:' ||
    url.hostname !== `${projectRef}.supabase.co` ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'The confirmed project reference must match an exact HTTPS Supabase URL.'
    )
  }
  return { url, anonKey }
}

const loadRows = async ({
  target,
  table,
  select,
  packIds,
  fetchImpl,
  timeoutMs,
}) => {
  const url = new URL(`/rest/v1/${table}`, target.url)
  url.searchParams.set('select', select)
  url.searchParams.set('pack_id', `in.(${packIds.join(',')})`)
  const response = await fetchImpl(url, {
    headers: {
      apikey: target.anonKey,
      Authorization: `Bearer ${target.anonKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(
      `Published official content verification failed: ${response.status} ${await response.text()}`
    )
  }
  const rows = await response.json()
  if (!Array.isArray(rows)) {
    throw new Error('Published official content returned an invalid response.')
  }
  return rows
}

export const verifyPublishedVocabularyPacks = async ({
  releaseDir,
  projectRef,
  supabaseUrl,
  anonKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error('Verification timeout must be between 1 and 60000 ms.')
  }
  const target = verificationTarget(projectRef, supabaseUrl, anonKey)
  const { index, packs } = await loadVerifiedArtifactSet(releaseDir, {
    requiredStatus: 'approved',
    aggregateField: 'releaseAggregateSha256',
  })
  const packIds = packs.map(pack => pack.manifest.pack_id)
  const catalogRows = await loadRows({
    target,
    table: 'official_content_packs',
    select:
      'pack_id,slug,title,description,cefr_level,entry_count,display_order,current_version,published_at',
    packIds,
    fetchImpl,
    timeoutMs,
  })
  const versionRows = await loadRows({
    target,
    table: 'official_content_pack_versions',
    select:
      'pack_id,version,title,description,cefr_level,entry_count,display_order,manifest,content_sha256,review_status,reviewed_at,published_at',
    packIds,
    fetchImpl,
    timeoutMs,
  })

  assert.equal(
    catalogRows.length,
    packs.length,
    'Published catalog count mismatch.'
  )
  for (const pack of packs) {
    const expected = pack.catalog
    const manifest = pack.manifest
    const catalogMatches = catalogRows.filter(
      row => row.pack_id === manifest.pack_id
    )
    assert.equal(
      catalogMatches.length,
      1,
      `Catalog row mismatch for ${manifest.pack_id}.`
    )
    assert.deepEqual(
      catalogMatches[0],
      {
        pack_id: manifest.pack_id,
        slug: manifest.pack_id,
        title: manifest.title,
        description: manifest.description,
        cefr_level: expected.cefr_level,
        entry_count: expected.entry_count,
        display_order: expected.display_order,
        current_version: manifest.version,
        published_at: catalogMatches[0].published_at,
      },
      `Catalog metadata mismatch for ${manifest.pack_id}.`
    )
    assert.ok(
      catalogMatches[0].published_at,
      `Missing publication time for ${manifest.pack_id}.`
    )

    const versionMatches = versionRows.filter(
      row =>
        row.pack_id === manifest.pack_id && row.version === manifest.version
    )
    assert.equal(
      versionMatches.length,
      1,
      `Version row mismatch for ${manifest.pack_id}.`
    )
    assert.deepEqual(
      versionMatches[0],
      {
        pack_id: manifest.pack_id,
        version: manifest.version,
        title: manifest.title,
        description: manifest.description,
        cefr_level: expected.cefr_level,
        entry_count: expected.entry_count,
        display_order: expected.display_order,
        manifest,
        content_sha256: expected.content_sha256,
        review_status: 'published',
        reviewed_at: manifest.content_review.reviewed_at,
        published_at: versionMatches[0].published_at,
      },
      `Published version mismatch for ${manifest.pack_id}.`
    )
    assert.ok(
      versionMatches[0].published_at,
      `Missing version publication time for ${manifest.pack_id}.`
    )
  }

  return {
    mode: 'anonymous-read-verification',
    releaseAggregateSha256: index.releaseAggregateSha256,
    packCount: packs.length,
    entryCount: packs.reduce(
      (sum, pack) => sum + pack.manifest.entries.length,
      0
    ),
    verifiedPackIds: packIds,
    productionWrites: 0,
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const args = parseCliArguments(process.argv.slice(2), {
    valueOptions: ['--release', '--project-ref'],
  })
  const releaseDir = path.resolve(
    args.get('--release') ??
      path.join(
        process.cwd(),
        'reports/vocabulary-organization/official-content-release-2026-09-11'
      )
  )
  const summary = await verifyPublishedVocabularyPacks({
    releaseDir,
    projectRef: args.get('--project-ref'),
    supabaseUrl: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  })
  console.log(JSON.stringify(summary, null, 2))
}
