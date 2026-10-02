import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
  type OfficialContentManifest,
  type OfficialContentEntry,
} from './manifest'
import type { Sha256 } from './remote'

/** Full linguistic content, with the same defaults on both clients and SQL. */
export const officialEntryToDictionaryContent = (
  entry: OfficialContentEntry
) => ({
  dutch_lemma: entry.dutch_lemma,
  dutch_original: entry.dutch_original ?? entry.dutch_lemma,
  part_of_speech: entry.part_of_speech,
  article: entry.article ?? null,
  translations: { en: entry.translations.en, ru: entry.translations.ru ?? [] },
  examples: (entry.examples ?? []).map(example => ({
    ...example,
    ru: example.ru ?? null,
  })),
  is_irregular: entry.is_irregular ?? false,
  is_reflexive: entry.is_reflexive ?? false,
  is_expression: entry.is_expression ?? false,
  expression_type: entry.expression_type ?? null,
  is_separable: entry.is_separable ?? false,
  prefix_part: entry.prefix_part ?? null,
  root_verb: entry.root_verb ?? null,
  plural: entry.plural ?? null,
  register: entry.register ?? 'neutral',
  synonyms: entry.synonyms ?? [],
  antonyms: entry.antonyms ?? [],
  conjugation: entry.conjugation
    ? {
        ...entry.conjugation,
        simple_past_plural: entry.conjugation.simple_past_plural ?? null,
      }
    : null,
  preposition: entry.preposition ?? null,
  analysis_notes: entry.analysis_notes ?? null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})

/** A separate receipt leaves the published v1 manifest and its digest intact. */
export interface OfficialDictionaryMapping {
  schema_version: 1
  pack_id: string
  version: string
  manifest_sha256: string
  entries: OfficialDictionaryMappingEntry[]
}

export interface OfficialDictionaryMappingEntry {
  pack_entry_id: string
  reference: { entry_id: string; revision_id: string }
  revision_content_sha256: string
  revision: {
    revision_no: number
    schema_version: 1
    cefr_input_sha256: string
  }
  provenance: { source_id: string; provenance_locator: string }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DIGEST = /^[0-9a-f]{64}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => key in value)
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)
const digest = (value: unknown): value is string =>
  typeof value === 'string' && DIGEST.test(value)

const invalidMapping = (): never => {
  throw new Error('Official dictionary mapping is invalid.')
}

/** Structural validation does not authorize publication or access to a revision. */
export function parseOfficialDictionaryMapping(
  value: unknown
): OfficialDictionaryMapping {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'schema_version',
      'pack_id',
      'version',
      'manifest_sha256',
      'entries',
    ]) ||
    value.schema_version !== 1 ||
    !nonEmpty(value.pack_id) ||
    !nonEmpty(value.version) ||
    !digest(value.manifest_sha256) ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0
  )
    return invalidMapping()

  const ids = new Set<string>()
  const entries: OfficialDictionaryMappingEntry[] = value.entries.map(entry => {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, [
        'pack_entry_id',
        'reference',
        'revision_content_sha256',
        'revision',
        'provenance',
      ]) ||
      !nonEmpty(entry.pack_entry_id) ||
      ids.has(entry.pack_entry_id) ||
      !digest(entry.revision_content_sha256) ||
      !isRecord(entry.revision) ||
      !exactKeys(entry.revision, [
        'revision_no',
        'schema_version',
        'cefr_input_sha256',
      ]) ||
      typeof entry.revision.revision_no !== 'number' ||
      !Number.isSafeInteger(entry.revision.revision_no) ||
      entry.revision.revision_no <= 0 ||
      entry.revision.schema_version !== 1 ||
      !digest(entry.revision.cefr_input_sha256) ||
      !isRecord(entry.reference) ||
      !exactKeys(entry.reference, ['entry_id', 'revision_id']) ||
      !uuid(entry.reference.entry_id) ||
      !uuid(entry.reference.revision_id) ||
      !isRecord(entry.provenance) ||
      !exactKeys(entry.provenance, ['source_id', 'provenance_locator']) ||
      !uuid(entry.provenance.source_id) ||
      !nonEmpty(entry.provenance.provenance_locator)
    )
      return invalidMapping()
    ids.add(entry.pack_entry_id)
    return {
      pack_entry_id: entry.pack_entry_id,
      reference: {
        entry_id: entry.reference.entry_id,
        revision_id: entry.reference.revision_id,
      },
      revision_content_sha256: entry.revision_content_sha256,
      revision: {
        revision_no: entry.revision.revision_no,
        schema_version: 1,
        cefr_input_sha256: entry.revision.cefr_input_sha256,
      },
      provenance: {
        source_id: entry.provenance.source_id,
        provenance_locator: entry.provenance.provenance_locator,
      },
    }
  })
  return {
    schema_version: 1,
    pack_id: value.pack_id,
    version: value.version,
    manifest_sha256: value.manifest_sha256,
    entries,
  }
}

/** Partial mappings are explicit: unmapped entries retain the legacy private copy. */
export async function verifyOfficialDictionaryMapping(
  value: unknown,
  manifest: OfficialContentManifest,
  sha256: Sha256
): Promise<OfficialDictionaryMapping> {
  const mapping = parseOfficialDictionaryMapping(value)
  const validation = validateOfficialContentManifest(manifest)
  if (!validation.success || manifest.content_review.status !== 'approved') {
    throw new Error(
      'Official dictionary mapping requires an approved manifest.'
    )
  }
  const entryIds = new Set(manifest.entries.map(entry => entry.entry_id))
  if (
    mapping.pack_id !== manifest.pack_id ||
    mapping.version !== manifest.version ||
    mapping.manifest_sha256 !==
      (await sha256(canonicalizeOfficialContent(manifest))) ||
    mapping.entries.some(entry => !entryIds.has(entry.pack_entry_id))
  ) {
    throw new Error('Official dictionary mapping does not match the manifest.')
  }
  const byId = new Map(manifest.entries.map(entry => [entry.entry_id, entry]))
  for (const entry of mapping.entries) {
    const original = byId.get(entry.pack_entry_id)
    if (!original)
      throw new Error('Official dictionary mapping entry is missing.')
    const content = officialEntryToDictionaryContent(original)
    if (
      entry.revision_content_sha256 !==
      (await sha256(canonicalizeOfficialContent(content)))
    ) {
      throw new Error(
        'Official dictionary mapping content does not match the manifest.'
      )
    }
    const linguistic = { ...content }
    const input = Object.fromEntries(
      Object.entries(linguistic).filter(
        ([key]) => key !== 'image_url' && key !== 'tts_url'
      )
    )
    if (
      entry.revision.cefr_input_sha256 !==
      (await sha256(
        canonicalizeOfficialContent({
          assessment_schema_version: 1,
          content: input,
        })
      ))
    )
      throw new Error(
        'Official dictionary mapping CEFR input does not match the manifest.'
      )
  }
  return mapping
}

/** The manifest supplies content; the trusted receipt supplies pinned metadata. */
export const officialDictionaryDependencies = (
  manifest: OfficialContentManifest,
  mapping: OfficialDictionaryMapping
) =>
  mapping.entries.map(entry => {
    const original = manifest.entries.find(
      item => item.entry_id === entry.pack_entry_id
    )
    if (!original)
      throw new Error('Official dictionary mapping entry is missing.')
    return {
      revision: {
        ...entry.reference,
        ...entry.revision,
        content: officialEntryToDictionaryContent(original),
        content_sha256: entry.revision_content_sha256,
        review_status: 'published' as const,
      },
    }
  })
