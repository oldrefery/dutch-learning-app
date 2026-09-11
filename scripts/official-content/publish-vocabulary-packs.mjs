import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  loadVerifiedArtifactSet,
  parseCliArguments,
} from './artifact-integrity.mjs'

const DEFAULT_TIMEOUT_MS = 15_000

const publicationTarget = (projectRef, supabaseUrl, serviceRoleKey) => {
  if (!projectRef || !supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Publication requires --project-ref, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.'
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
  return { projectRef, url, serviceRoleKey }
}

const publishPack = async ({
  pack,
  target,
  publishedAt,
  fetchImpl,
  timeoutMs,
}) => {
  const response = await fetchImpl(
    `${target.url.origin}/rest/v1/rpc/publish_official_content_pack`,
    {
      method: 'POST',
      headers: {
        apikey: target.serviceRoleKey,
        Authorization: `Bearer ${target.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_manifest: pack.manifest,
        p_content_sha256: pack.catalog.content_sha256,
        p_cefr_level: pack.catalog.cefr_level,
        p_display_order: pack.catalog.display_order,
        p_entry_count: pack.catalog.entry_count,
        p_reviewed_at: pack.manifest.content_review.reviewed_at,
        p_published_at: publishedAt,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    }
  )
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`)
  }
}

export class OfficialContentPublicationError extends Error {
  constructor(summary) {
    super(
      `Publication failed for: ${summary.failedPackIds.join(', ')}. Completed: ${summary.completedPackIds.join(', ') || 'none'}. Rerun the same release safely to resume.`
    )
    this.name = 'OfficialContentPublicationError'
    this.summary = summary
  }
}

export const publishVocabularyPacks = async ({
  releaseDir,
  apply = false,
  projectRef,
  supabaseUrl,
  serviceRoleKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => new Date().toISOString(),
}) => {
  const { index: release, packs } = await loadVerifiedArtifactSet(releaseDir, {
    requiredStatus: 'approved',
    aggregateField: 'releaseAggregateSha256',
  })
  if (
    !release.approvedBy ||
    Number.isNaN(Date.parse(release.approvedAt)) ||
    typeof release.reviewLedgerSha256 !== 'string' ||
    release.approvedFromDraftSha256 !== release.draftAggregateSha256
  ) {
    throw new Error(
      'The official content release has invalid approval metadata.'
    )
  }
  const baseSummary = {
    mode: apply ? 'applied' : 'dry-run',
    approvedBy: release.approvedBy,
    approvedAt: release.approvedAt,
    releaseAggregateSha256: release.releaseAggregateSha256,
    packCount: packs.length,
    entryCount: packs.reduce(
      (sum, pack) => sum + pack.manifest.entries.length,
      0
    ),
    productionWrites: 0,
    completedPackIds: [],
    failedPackIds: [],
  }
  if (!apply) return baseSummary
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error('Publication timeout must be between 1 and 60000 ms.')
  }

  const target = publicationTarget(projectRef, supabaseUrl, serviceRoleKey)
  const publishedAt = now()
  const summary = {
    ...baseSummary,
    projectRef: target.projectRef,
    publishedAt,
  }
  for (const pack of packs) {
    try {
      await publishPack({
        pack,
        target,
        publishedAt,
        fetchImpl,
        timeoutMs,
      })
      summary.completedPackIds.push(pack.manifest.pack_id)
    } catch {
      summary.failedPackIds.push(pack.manifest.pack_id)
    }
  }
  summary.productionWrites = summary.completedPackIds.length
  if (summary.failedPackIds.length > 0) {
    throw new OfficialContentPublicationError(summary)
  }
  return summary
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const args = parseCliArguments(process.argv.slice(2), {
    valueOptions: ['--release', '--project-ref'],
    booleanOptions: ['--apply'],
  })
  const releaseDir = path.resolve(
    args.get('--release') ??
      path.join(
        process.cwd(),
        'reports/vocabulary-organization/official-content-release-2026-09-11'
      )
  )
  try {
    const summary = await publishVocabularyPacks({
      releaseDir,
      apply: args.has('--apply'),
      projectRef: args.get('--project-ref'),
      supabaseUrl: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    if (error instanceof OfficialContentPublicationError) {
      console.error(JSON.stringify(error.summary, null, 2))
    }
    throw error
  }
}
