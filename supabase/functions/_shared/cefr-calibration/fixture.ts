import {
  canonicalizeCefrInput,
  CEFR_LEVELS,
  type CefrLevel,
  parseDictionaryContent,
} from '../../../../packages/domain/src/shared-dictionary.ts'
import {
  digest,
  list,
  nullableText,
  objectDigest,
  record,
  requireValid,
  sha256,
  strings,
  text,
} from './validation.ts'

export const CALIBRATION_NAMESPACE = 'dictionary-cefr-calibration-v1'
export const REQUIRED_SLICES = Object.freeze([
  'sense-pairs',
  'inflections',
  'reflexive-verbs',
  'separable-verbs',
  'compounds',
  'idioms',
  'ordinary',
  'specialized',
  'rare-missing',
  'ambiguous',
  'conflicting-examples',
] as const)

export type Expectation =
  { kind: 'abstain' } | { kind: 'levels'; levels: CefrLevel[] }
export interface FixtureItem {
  id: string
  family: string
  split: 'calibration' | 'held_out'
  slices: string[]
  canonical_input: string
  input_sha256: string
  input_schema_version: 1
  ambiguous: boolean
  expectation: Expectation
  review: {
    state: 'reviewed' | 'unreviewed' | 'disputed'
    reviewer: string | null
    adjudication: string | null
    evidence_ref: string | null
    permission_ref: string | null
  }
}

export interface CalibrationFixture {
  namespace: typeof CALIBRATION_NAMESPACE
  revision: string
  origin: 'synthetic' | 'reviewed' | 'unreviewed'
  items: FixtureItem[]
  sha256: string
}

export const parseExpectation = (value: unknown): Expectation => {
  const raw = record(value)
  if (raw.kind === 'abstain') return { kind: 'abstain' }
  requireValid(raw.kind === 'levels', 'expectation_kind')
  const levels = strings(raw.levels)
  requireValid(
    levels.length > 0 &&
      levels.every(level => CEFR_LEVELS.includes(level as CefrLevel)),
    'expected_levels'
  )
  return { kind: 'levels', levels: levels as CefrLevel[] }
}

const parseReview = (value: unknown): FixtureItem['review'] => {
  const raw = record(value)
  const state = raw.state
  requireValid(
    state === 'reviewed' || state === 'unreviewed' || state === 'disputed',
    'review_state'
  )
  const review: FixtureItem['review'] = {
    state,
    reviewer: nullableText(raw.reviewer),
    adjudication: nullableText(raw.adjudication),
    evidence_ref: nullableText(raw.evidence_ref),
    permission_ref: nullableText(raw.permission_ref),
  }
  if (state === 'reviewed') {
    requireValid(
      Object.values(review).every(value => value !== null),
      'review_evidence_required'
    )
  }
  return review
}

const parseItem = async (
  value: unknown,
  origin: CalibrationFixture['origin']
): Promise<FixtureItem> => {
  const raw = record(value)
  requireValid(raw.input_schema_version === 1, 'meaning_input_schema')
  requireValid(
    raw.split === 'calibration' || raw.split === 'held_out',
    'fixture_split'
  )
  requireValid(typeof raw.ambiguous === 'boolean', 'ambiguity_required')
  const parsed = parseDictionaryContent(raw.content)
  requireValid(parsed.success, 'dictionary_content')
  const canonical = canonicalizeCefrInput(parsed.data)
  requireValid(raw.canonical_input === canonical, 'canonical_input_mismatch')
  requireValid(
    digest(raw.input_sha256) === (await sha256(canonical)),
    'input_digest_mismatch'
  )
  const expectation = parseExpectation(raw.expectation)
  const review = parseReview(raw.review)
  if (expectation.kind === 'levels' && origin !== 'synthetic') {
    requireValid(review.state === 'reviewed', 'known_label_requires_review')
  }
  if (origin === 'reviewed')
    requireValid(review.state === 'reviewed', 'fixture_not_fully_reviewed')
  const slices = strings(raw.slices)
  requireValid(
    slices.length > 0 &&
      slices.every(slice =>
        REQUIRED_SLICES.includes(slice as (typeof REQUIRED_SLICES)[number])
      ),
    'fixture_slices'
  )
  return {
    id: text(raw.id),
    family: text(raw.family),
    split: raw.split,
    slices,
    canonical_input: canonical,
    input_sha256: digest(raw.input_sha256),
    input_schema_version: 1,
    ambiguous: raw.ambiguous,
    expectation,
    review,
  }
}

const validatePartitions = (items: FixtureItem[]): void => {
  const ids = new Set<string>()
  const inputs = new Set<string>()
  const splits = new Map<string, string>()
  for (const item of items) {
    requireValid(!ids.has(item.id), 'duplicate_item_id')
    ids.add(item.id)
    requireValid(!inputs.has(item.input_sha256), 'duplicate_meaning_input')
    inputs.add(item.input_sha256)
    const content = JSON.parse(item.canonical_input).content
    // Family labels require editorial review; exact homographs and hashes are also fenced.
    const lemma = String(content.dutch_lemma)
      .normalize('NFC')
      .trim()
      .toLowerCase()
    for (const key of [
      `family:${item.family}`,
      `lemma:${lemma}`,
      `input:${item.input_sha256}`,
    ]) {
      requireValid(
        !splits.has(key) || splits.get(key) === item.split,
        'partition_leakage'
      )
      splits.set(key, item.split)
    }
  }
}

export const validateFixture = async (
  value: unknown
): Promise<CalibrationFixture> => {
  const raw = record(value)
  requireValid(raw.namespace === CALIBRATION_NAMESPACE, 'fixture_namespace')
  requireValid(
    raw.origin === 'synthetic' ||
      raw.origin === 'reviewed' ||
      raw.origin === 'unreviewed',
    'fixture_origin'
  )
  const items: FixtureItem[] = []
  for (const item of list(raw.items))
    items.push(await parseItem(item, raw.origin))
  requireValid(items.length > 0, 'empty_fixture')
  validatePartitions(items)
  return {
    namespace: CALIBRATION_NAMESPACE,
    revision: text(raw.revision),
    origin: raw.origin,
    items,
    sha256: await objectDigest(raw),
  }
}
