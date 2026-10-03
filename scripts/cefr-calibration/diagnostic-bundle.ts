import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  canonicalizeCefrInput,
  canonicalizeJson,
  CEFR_LEVELS,
  parseDictionaryContent,
  type CefrLevel,
} from '../../packages/domain/src/shared-dictionary.ts'
import { REQUIRED_SLICES } from '../../supabase/functions/_shared/cefr-calibration/fixture.ts'
import {
  validateProfile,
  type MethodProfile,
} from '../../supabase/functions/_shared/cefr-calibration/profile.ts'

const sha = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex')
const fail = (code: string): never => {
  throw new Error(`Invalid diagnostic run: ${code}`)
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('object_required')
  return value as Record<string, unknown>
}
const positiveInteger = (value: unknown, max: number): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > max)
    return fail('invalid_limit')
  return value as number
}

const validBand = (value: unknown): value is CefrLevel[] | null =>
  value === null ||
  (Array.isArray(value) &&
    value.length > 0 &&
    value.every(level => CEFR_LEVELS.includes(level as CefrLevel)))

const validSlices = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    slice =>
      typeof slice === 'string' &&
      REQUIRED_SLICES.includes(slice as (typeof REQUIRED_SLICES)[number])
  )

const inputMatches = (
  row: Record<string, unknown>,
  input: string,
  hash: string,
  seen: Set<string>
): boolean =>
  row.canonical_input === input && row.input_sha256 === hash && !seen.has(hash)

const noGoldFields = (row: Record<string, unknown>): boolean =>
  row.expected_levels === null &&
  row.expected_abstention === null &&
  row.ambiguity === null
const referenceMatches = (
  ref: Record<string, unknown> | undefined,
  hash: string
): ref is Record<string, unknown> =>
  Boolean(
    ref &&
    ref.input_sha256 === hash &&
    ref.calibration_eligible === false &&
    ref.confidence === null
  )

const bindFamily = (
  families: Map<string, string>,
  lemmas: Map<string, string>,
  family: string,
  lemma: string,
  split: string
): void => {
  for (const [map, key] of [
    [families, family],
    [lemmas, lemma],
  ] as const) {
    if (map.has(key) && map.get(key) !== split) fail('split_leakage')
    map.set(key, split)
  }
}

const preparedBundles = new WeakSet<object>()
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
export const isPreparedBundle = (value: DiagnosticBundle): boolean =>
  preparedBundles.has(value)

export interface DiagnosticPaths {
  worklist: string
  reference: string
  profile: string
  prompt: string
  proposal: string
}
export interface Meaning {
  id: string
  split: 'calibration' | 'held_out'
  input: string
  inputHash: string
  reference: CefrLevel[] | null
  slices: string[]
  ambiguityProbe: boolean
}
export interface DiagnosticBundle {
  readonly meanings: readonly Meaning[]
  readonly prompt: string
  readonly profile: MethodProfile
  readonly profileSha256: string
  readonly worklistSha256: string
  readonly referenceSha256: string
  readonly proposalSha256: string
  readonly promptSha256: string
  readonly bindingSha256: string
  readonly maxAttempts: number
  readonly maxRequests: number
  readonly maxInputTokens: number
  readonly maxOutputTokens: number
  readonly maxReasoningTokens: number
  readonly costPerAttempt: number
  readonly tokensPerAttempt: number
  readonly ceiling: number
  readonly rates: { input: number; output: number; reasoning: number }
}

const readArtifact = (path: string): { raw: string; value: unknown } => {
  const raw = readFileSync(path, 'utf8')
  return { raw, value: JSON.parse(raw) as unknown }
}
export const loadDiagnosticBundle = (
  paths: DiagnosticPaths
): DiagnosticBundle => {
  const worklist = readArtifact(paths.worklist)
  const reference = readArtifact(paths.reference)
  const profileFile = readArtifact(paths.profile)
  const proposal = readArtifact(paths.proposal)
  const prompt = readFileSync(paths.prompt, 'utf8')
  const w = object(worklist.value),
    r = object(reference.value),
    p = object(proposal.value)
  const profile = validateProfile(profileFile.value)
  const profileSha256 = sha(canonicalizeJson(profile))
  const worklistSha256 = sha(worklist.raw)
  const referenceSha256 = sha(reference.raw)
  const proposalSha256 = sha(proposal.raw)
  const promptSha256 = sha(prompt)
  const promptRevision =
    profile.method_revision === 'd11-gemini35-pilot-v2'
      ? `d11-pilot-v2:${promptSha256}`
      : profile.method_revision === 'd11-gemini35-pilot-v3'
        ? `d11-pilot-v3:${promptSha256}`
        : null
  if (
    w.namespace !== 'dictionary-cefr-review-worklist-v1' ||
    w.gold_fixture !== false ||
    w.provider_approved !== false ||
    r.namespace !== 'dictionary-cefr-provisional-reference-v1' ||
    r.reference_origin !== 'assistant_inference' ||
    r.independent_gold !== false ||
    r.calibration_eligible !== false ||
    r.publication_authorized !== false ||
    r.meaning_input_revision !== w.revision ||
    r.worklist_sha256 !== worklistSha256 ||
    p.approved !== false ||
    p.operational_qualification !== false ||
    p.independent_gold !== false ||
    p.worklist_file_sha256 !== worklistSha256 ||
    p.profile_sha256 !== profileSha256 ||
    p.prompt_sha256 !== promptSha256 ||
    profile.prompt_revision !== promptRevision
  )
    return fail('artifact_binding')
  if (
    !Array.isArray(w.items) ||
    !Array.isArray(r.items) ||
    w.items.length !== 24 ||
    r.items.length !== 24
  )
    return fail('item_count')
  const referenceById = new Map<string, Record<string, unknown>>()
  for (const raw of r.items) {
    const row = object(raw)
    if (typeof row.id !== 'string' || referenceById.has(row.id))
      return fail('duplicate_reference')
    referenceById.set(row.id, row)
  }
  const families = new Map<string, string>(),
    lemmas = new Map<string, string>()
  const ids = new Set<string>(),
    inputs = new Set<string>(),
    slices = new Set<string>()
  const meanings: Meaning[] = w.items.map(raw => {
    const row = object(raw),
      content = parseDictionaryContent(row.content)
    if (!content.success || typeof row.id !== 'string' || ids.has(row.id))
      return fail('invalid_meaning')
    ids.add(row.id)
    if (
      row.proposed_split !== 'calibration' &&
      row.proposed_split !== 'held_out'
    )
      return fail('invalid_split')
    const split = row.proposed_split
    if (!validSlices(row.proposed_slices)) return fail('invalid_slices')
    row.proposed_slices.forEach(slice => slices.add(slice))
    if (typeof row.family !== 'string' || !row.family)
      return fail('invalid_family')
    bindFamily(families, lemmas, row.family, content.data.dutch_lemma, split)
    const input = canonicalizeCefrInput(content.data)
    const inputHash = sha(input)
    if (!inputMatches(row, input, inputHash, inputs))
      return fail('input_binding')
    inputs.add(inputHash)
    if (!noGoldFields(row)) return fail('gold_fields_present')
    const review = object(row.review)
    if (review.reviewer_kind !== 'model' || review.independent !== false)
      return fail('review_origin')
    const ref = referenceById.get(row.id)
    if (!referenceMatches(ref, inputHash)) return fail('reference_binding')
    const band = ref.provisional_level_band
    if (!validBand(band)) return fail('invalid_reference_band')
    if (
      (band === null ? 'unknown' : 'model_estimated') !== ref.status ||
      typeof ref.ambiguity_or_conflict !== 'boolean'
    )
      return fail('reference_status')
    return {
      id: row.id,
      split,
      input,
      inputHash,
      reference: band as CefrLevel[] | null,
      slices: row.proposed_slices as string[],
      ambiguityProbe: ref.ambiguity_or_conflict,
    }
  })
  if (
    referenceById.size !== ids.size ||
    meanings.filter(x => x.split === 'calibration').length !== 12 ||
    meanings.filter(x => x.split === 'held_out').length !== 12 ||
    REQUIRED_SLICES.some(slice => !slices.has(slice))
  )
    return fail('reference_or_split_coverage')
  const rates = object(p.rates_microusd_per_token)
  const inputRate = Number(rates.input),
    outputRate = Number(rates.output),
    reasoningRate = Number(rates.reasoning)
  if (
    ![inputRate, outputRate, reasoningRate].every(
      x => Number.isFinite(x) && x >= 0
    )
  )
    return fail('invalid_rates')
  const maxAttempts = positiveInteger(p.max_attempts_per_item, 2)
  const maxRequests = positiveInteger(p.max_generation_requests, 48)
  const maxInputTokens = positiveInteger(p.max_input_tokens, 2000)
  const maxOutputTokens = positiveInteger(p.max_output_tokens, 2048)
  const maxReasoningTokens = positiveInteger(p.max_reasoning_tokens, 2048)
  const tokensPerAttempt = maxInputTokens + maxOutputTokens + maxReasoningTokens
  const costPerAttempt =
    maxInputTokens * inputRate +
    maxOutputTokens * outputRate +
    maxReasoningTokens * reasoningRate
  const ceiling = positiveInteger(
    p.proposed_spending_ceiling_microusd,
    2_000_000
  )
  if (
    maxRequests !== meanings.length * maxAttempts ||
    tokensPerAttempt !== p.per_attempt_reserved_tokens ||
    costPerAttempt !== p.per_attempt_reserved_microusd ||
    maxRequests * tokensPerAttempt !== p.total_reserved_tokens ||
    maxRequests * costPerAttempt !== p.total_reserved_microusd ||
    maxRequests * costPerAttempt > ceiling
  )
    return fail('proposal_arithmetic')
  const bindingSha256 = sha(
    canonicalizeJson({
      worklistSha256,
      referenceSha256,
      profileSha256,
      promptSha256,
      proposalSha256,
    })
  )
  const bundle = {
    meanings,
    prompt,
    profile,
    profileSha256,
    worklistSha256,
    referenceSha256,
    proposalSha256,
    promptSha256,
    bindingSha256,
    maxAttempts,
    maxRequests,
    maxInputTokens,
    maxOutputTokens,
    maxReasoningTokens,
    costPerAttempt,
    tokensPerAttempt,
    ceiling,
    rates: { input: inputRate, output: outputRate, reasoning: reasoningRate },
  }
  deepFreeze(bundle)
  preparedBundles.add(bundle)
  return bundle
}
