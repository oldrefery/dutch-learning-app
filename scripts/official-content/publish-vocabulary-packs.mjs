import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'

const sha256 = value => createHash('sha256').update(value).digest('hex')

const argument = name => {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

const releaseDir = path.resolve(
  argument('--release') ??
    path.join(
      process.cwd(),
      'reports/vocabulary-organization/official-content-release-2026-09-11'
    )
)
const release = JSON.parse(
  await readFile(path.join(releaseDir, 'index.json'), 'utf8')
)
if (!release.approvedBy || !release.approvedAt) {
  throw new Error('The official content release has not been approved.')
}
if (release.files.length !== release.catalog.length) {
  throw new Error('The release index has inconsistent pack metadata.')
}

const packs = []
for (const [index, file] of release.files.entries()) {
  const serialized = await readFile(
    path.join(releaseDir, file.filename),
    'utf8'
  )
  if (sha256(serialized) !== file.fileSha256) {
    throw new Error(`File integrity check failed for ${file.filename}.`)
  }
  const manifest = JSON.parse(serialized)
  const validation = validateOfficialContentManifest(manifest)
  if (
    !validation.success ||
    validation.data.content_review.status !== 'approved'
  ) {
    throw new Error(`Manifest ${file.filename} is not publication-ready.`)
  }
  if (
    sha256(canonicalizeOfficialContent(validation.data)) !== file.contentSha256
  ) {
    throw new Error(`Content integrity check failed for ${file.filename}.`)
  }
  const catalog = release.catalog[index]
  if (
    catalog.pack_id !== validation.data.pack_id ||
    catalog.version !== validation.data.version ||
    catalog.entry_count !== validation.data.entries.length ||
    catalog.content_sha256 !== file.contentSha256
  ) {
    throw new Error(`Catalog identity check failed for ${file.filename}.`)
  }
  packs.push({ catalog, manifest: validation.data })
}

const apply = process.argv.includes('--apply')
if (!apply) {
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        approvedBy: release.approvedBy,
        approvedAt: release.approvedAt,
        packCount: packs.length,
        entryCount: packs.reduce(
          (sum, pack) => sum + pack.manifest.entries.length,
          0
        ),
        productionWrites: 0,
      },
      null,
      2
    )
  )
  process.exit(0)
}

const projectRef = argument('--project-ref')
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!projectRef || !supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Publication requires --project-ref, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.'
  )
}
const url = new URL(supabaseUrl)
if (url.hostname !== `${projectRef}.supabase.co`) {
  throw new Error(
    'The confirmed project reference does not match SUPABASE_URL.'
  )
}

const publishedAt = new Date().toISOString()
for (const pack of packs) {
  const response = await fetch(
    `${url.origin}/rest/v1/rpc/publish_official_content_pack`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
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
    }
  )
  if (!response.ok) {
    throw new Error(
      `Publication failed for ${pack.catalog.pack_id}: ${response.status} ${await response.text()}`
    )
  }
}

console.log(
  JSON.stringify(
    {
      mode: 'applied',
      projectRef,
      publishedAt,
      packCount: packs.length,
      entryCount: release.entryCount,
    },
    null,
    2
  )
)
