import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

const reviewedBy = argument('--reviewed-by')
const reviewedAt = argument('--reviewed-at')
if (!reviewedBy || !reviewedAt || Number.isNaN(Date.parse(reviewedAt))) {
  throw new Error(
    'Use --reviewed-by <stable reviewer> --reviewed-at <ISO timestamp> after editorial review.'
  )
}

const root = process.cwd()
const inputDir = path.resolve(
  argument('--input') ??
    path.join(
      root,
      'reports/vocabulary-organization/official-content-drafts-2026-09-11'
    )
)
const outputDir = path.resolve(
  argument('--out') ??
    path.join(
      root,
      'reports/vocabulary-organization/official-content-release-2026-09-11'
    )
)

const draftIndex = JSON.parse(await readFile(path.join(inputDir, 'index.json')))
if (draftIndex.productionWrites !== 0) {
  throw new Error('The draft index contains unexpected production writes.')
}

await mkdir(outputDir, { recursive: true, mode: 0o700 })
const files = []
for (const draftFile of draftIndex.files) {
  const draft = JSON.parse(
    await readFile(path.join(inputDir, draftFile.filename), 'utf8')
  )
  const draftValidation = validateOfficialContentManifest(draft)
  if (!draftValidation.success) {
    throw new Error(`Draft ${draftFile.filename} is invalid.`)
  }
  if (draftValidation.data.content_review.status !== 'pending') {
    throw new Error(`Draft ${draftFile.filename} is not pending review.`)
  }

  const manifest = {
    ...draftValidation.data,
    content_review: {
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date(reviewedAt).toISOString(),
      notes:
        'Project-owner-authorized editorial review approved spelling, translations, examples, metadata, CEFR placement, frequency ordering, duplicates, and public-content exclusions.',
    },
  }
  const validation = validateOfficialContentManifest(manifest)
  if (!validation.success) {
    throw new Error(`Approved manifest ${draftFile.filename} is invalid.`)
  }
  const serialized = `${JSON.stringify(validation.data, null, 2)}\n`
  await writeFile(path.join(outputDir, draftFile.filename), serialized, {
    flag: 'wx',
    mode: 0o600,
  })
  files.push({
    ...draftFile,
    contentSha256: sha256(canonicalizeOfficialContent(validation.data)),
    fileSha256: sha256(serialized),
  })
}

const catalog = draftIndex.catalog.map((item, index) => ({
  ...item,
  content_sha256: files[index].contentSha256,
  review_status: 'published',
}))
const releaseIndex = {
  ...draftIndex,
  productionWrites: 0,
  approvedAt: new Date(reviewedAt).toISOString(),
  approvedBy: reviewedBy,
  catalog,
  files,
}
await writeFile(
  path.join(outputDir, 'index.json'),
  `${JSON.stringify(releaseIndex, null, 2)}\n`,
  { flag: 'wx', mode: 0o600 }
)
console.log(
  JSON.stringify(
    {
      approvedBy: releaseIndex.approvedBy,
      approvedAt: releaseIndex.approvedAt,
      packCount: releaseIndex.packCount,
      entryCount: releaseIndex.entryCount,
      productionWrites: releaseIndex.productionWrites,
    },
    null,
    2
  )
)
