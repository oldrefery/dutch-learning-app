import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'

export const sha256 = value => createHash('sha256').update(value).digest('hex')

const requireArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value
}

const requireUnique = (values, label) => {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique.`)
  }
}

export const parseCliArguments = (
  argv,
  { valueOptions = [], booleanOptions = [] }
) => {
  const allowedValues = new Set(valueOptions)
  const allowedBooleans = new Set(booleanOptions)
  const values = new Map()
  const flags = new Set()
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]
    if (allowedBooleans.has(option)) {
      if (flags.has(option)) throw new Error(`Duplicate option: ${option}`)
      flags.add(option)
      continue
    }
    if (!allowedValues.has(option)) {
      throw new Error(`Unknown option: ${String(option)}`)
    }
    if (values.has(option)) throw new Error(`Duplicate option: ${option}`)
    const value = argv[index + 1]
    if (typeof value !== 'string' || value === '' || value.startsWith('--')) {
      throw new Error(`Option ${option} requires a value.`)
    }
    values.set(option, value)
    index += 1
  }
  return {
    get: option => values.get(option),
    has: option => flags.has(option),
  }
}

const collectStringValues = (value, output = []) => {
  if (typeof value === 'string') output.push(value)
  else if (Array.isArray(value)) {
    value.forEach(item => collectStringValues(item, output))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectStringValues(item, output))
  }
  return output
}

export const assertNoForbiddenPublicTerms = (value, forbiddenTerms) => {
  const normalizedTerms = new Set(
    [...forbiddenTerms].map(term => term.toLocaleLowerCase('nl'))
  )
  for (const text of collectStringValues(value)) {
    const words = text.toLocaleLowerCase('nl').match(/\p{L}+/gu) ?? []
    const forbidden = words.find(word => normalizedTerms.has(word))
    if (forbidden) {
      throw new Error(`Forbidden public term found: ${forbidden}`)
    }
  }
}

export const assertSafeArtifactFilename = filename => {
  if (
    typeof filename !== 'string' ||
    filename === '' ||
    path.basename(filename) !== filename ||
    !filename.endsWith('.json')
  ) {
    throw new Error(`Unsafe artifact filename: ${String(filename)}`)
  }
}

export const calculateArtifactAggregateSha256 = files => {
  const records = files
    .map(file => ({
      packId: file.packId,
      version: file.version,
      filename: file.filename,
      entryCount: file.entryCount,
      contentSha256: file.contentSha256,
      fileSha256: file.fileSha256,
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename))
  return sha256(canonicalizeOfficialContent(records))
}

const validateIndexShape = index => {
  if (
    !index ||
    typeof index !== 'object' ||
    index.schemaVersion !== 1 ||
    index.productionWrites !== 0
  ) {
    throw new Error('Artifact index metadata is invalid.')
  }
  const files = requireArray(index.files, 'Artifact index files')
  const catalog = requireArray(index.catalog, 'Artifact index catalog')
  const forbiddenPublicLemmas = requireArray(
    index.forbiddenPublicLemmas,
    'Forbidden public lemmas'
  )
  if (
    !Number.isInteger(index.packCount) ||
    index.packCount !== files.length ||
    files.length !== catalog.length
  ) {
    throw new Error('Artifact index has inconsistent pack counts.')
  }
  files.forEach(file => assertSafeArtifactFilename(file.filename))
  requireUnique(
    files.map(file => file.filename),
    'Artifact filenames'
  )
  requireUnique(
    files.map(file => `${file.packId}@${file.version}`),
    'Artifact pack versions'
  )
  requireUnique(
    catalog.map(item => `${item.pack_id}@${item.version}`),
    'Catalog pack versions'
  )
  if (
    forbiddenPublicLemmas.some(
      lemma =>
        typeof lemma !== 'string' ||
        lemma === '' ||
        lemma !== lemma.toLocaleLowerCase('nl')
    )
  ) {
    throw new Error('Forbidden public lemmas are invalid.')
  }
  requireUnique(forbiddenPublicLemmas, 'Forbidden public lemmas')
  return { files, catalog, forbiddenPublicLemmas }
}

const verifyManifestFile = async (
  directory,
  file,
  catalogItem,
  requiredStatus
) => {
  const serialized = await readFile(path.join(directory, file.filename), 'utf8')
  if (sha256(serialized) !== file.fileSha256) {
    throw new Error(`File integrity check failed for ${file.filename}.`)
  }
  const validation = validateOfficialContentManifest(JSON.parse(serialized))
  if (!validation.success) {
    throw new Error(`Manifest ${file.filename} is invalid.`)
  }
  const manifest = validation.data
  if (requiredStatus && manifest.content_review.status !== requiredStatus) {
    throw new Error(
      `Manifest ${file.filename} must have ${requiredStatus} review status.`
    )
  }
  if (
    file.filename !== `${manifest.pack_id}-${manifest.version}.json` ||
    file.packId !== manifest.pack_id ||
    file.version !== manifest.version ||
    file.entryCount !== manifest.entries.length ||
    sha256(canonicalizeOfficialContent(manifest)) !== file.contentSha256 ||
    catalogItem?.pack_id !== manifest.pack_id ||
    catalogItem?.version !== manifest.version ||
    catalogItem?.entry_count !== manifest.entries.length ||
    catalogItem?.content_sha256 !== file.contentSha256
  ) {
    throw new Error(`Artifact identity check failed for ${file.filename}.`)
  }
  return { file, catalog: catalogItem, manifest, serialized }
}

export const loadVerifiedArtifactSet = async (
  directory,
  { requiredStatus, aggregateField }
) => {
  const index = JSON.parse(
    await readFile(path.join(directory, 'index.json'), 'utf8')
  )
  const { files, catalog, forbiddenPublicLemmas } = validateIndexShape(index)
  if (
    typeof index[aggregateField] !== 'string' ||
    index[aggregateField] !== calculateArtifactAggregateSha256(files)
  ) {
    throw new Error('Artifact aggregate integrity check failed.')
  }
  const catalogByIdentity = new Map(
    catalog.map(item => [`${item.pack_id}@${item.version}`, item])
  )
  const packs = await Promise.all(
    files.map(file =>
      verifyManifestFile(
        directory,
        file,
        catalogByIdentity.get(`${file.packId}@${file.version}`),
        requiredStatus
      )
    )
  )
  const entryIds = packs.flatMap(pack =>
    pack.manifest.entries.map(entry => entry.entry_id)
  )
  assertNoForbiddenPublicTerms(
    packs.map(pack => pack.manifest),
    forbiddenPublicLemmas
  )
  requireUnique(entryIds, 'Public entry IDs')
  if (
    !Number.isInteger(index.entryCount) ||
    index.entryCount !== entryIds.length
  ) {
    throw new Error('Artifact index has an inconsistent entry count.')
  }
  return { index, packs }
}
