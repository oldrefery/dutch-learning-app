import {
  canonicalizeCefrInput,
  type DictionaryContent,
} from '../../../../packages/domain/src/shared-dictionary.ts'
import {
  CALIBRATION_NAMESPACE,
  REQUIRED_SLICES,
  validateFixture,
} from './fixture.ts'
import { profileDigest } from './profile.ts'
import { requestDigest } from './report.ts'
import { sha256 } from './validation.ts'

// Every label, review reference, model and approval in these builders is fictional.
// Reviewed-shaped variants exercise validation only; they are not quality evidence.
export const syntheticProfile = () => ({
  namespace: 'dictionary-cefr-method-v1',
  input_schema_version: 1,
  method_revision: 'synthetic-method-1',
  prompt_revision: 'synthetic-prompt-1',
  provider: 'fake-provider',
  requested_model: 'fake-model',
  resolved_model_version: null,
  generation_config: { temperature: 0, max_output_tokens: 64 },
})

export const syntheticPolicy = () => ({
  revision: 'TEST-ONLY-policy',
  reviewer: 'TEST-ONLY-reviewer',
  approval_ref: 'TEST-ONLY-approval',
  confidence_threshold: 0.8,
  confidence_bins: [0, 0.5, 0.8, 1],
  minimum_items_per_split: 2,
  minimum_items_per_slice: 1,
  minimum_scored_items: 1,
  minimum_accepted_items: 1,
  minimum_abstention_accuracy: 1,
  minimum_coverage: 0.5,
  minimum_exact: 0.8,
  minimum_within_one: 0.9,
  minimum_accepted_accuracy: 0.9,
  maximum_severe_error_rate: 0,
})

export const syntheticContent = (lemma: string): DictionaryContent => ({
  dutch_lemma: lemma,
  dutch_original: null,
  part_of_speech: 'noun',
  article: 'de',
  translations: {
    en: ['Synthetic meaning for mechanics testing only'],
    ru: [],
  },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: null,
  register: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})

export const syntheticItem = async (
  id: string,
  split: string,
  slice = 'ordinary'
) => {
  const content = syntheticContent(`synthetic-${id}`)
  const canonical = canonicalizeCefrInput(content)
  const abstain = slice === 'ambiguous' || slice === 'conflicting-examples'
  return {
    id,
    family: id,
    split,
    slices: [slice],
    content,
    canonical_input: canonical,
    input_sha256: await sha256(canonical),
    input_schema_version: 1,
    ambiguous: abstain,
    expectation: abstain
      ? { kind: 'abstain', levels: [] }
      : { kind: 'levels', levels: ['A2'] },
    review: {
      state: 'unreviewed',
      reviewer: null as string | null,
      adjudication: null as string | null,
      evidence_ref: null as string | null,
      permission_ref: null as string | null,
    },
  }
}

export const syntheticInputs = async (reviewedShape = false) => {
  const items = []
  for (const split of ['calibration', 'held_out']) {
    for (const slice of REQUIRED_SLICES) {
      const item = await syntheticItem(`${split}-${slice}`, split, slice)
      if (reviewedShape)
        item.review = {
          state: 'reviewed',
          reviewer: 'TEST-ONLY-reviewer',
          adjudication: 'TEST-ONLY-adjudication',
          evidence_ref: 'TEST-ONLY-evidence',
          permission_ref: 'TEST-ONLY-permission',
        }
      items.push(item)
    }
  }
  const fixture = {
    namespace: CALIBRATION_NAMESPACE,
    revision: 'TEST-ONLY-fixture-1',
    origin: reviewedShape ? 'reviewed' : 'synthetic',
    items,
  }
  const profile = syntheticProfile()
  const profileSha = await profileDigest(profile)
  const parsed = await validateFixture(fixture)
  const responses = {
    profile_sha256: profileSha,
    request_sha256: await requestDigest(parsed, profileSha),
    provenance: {
      kind: reviewedShape ? 'provider' : 'fake',
      run_id: 'TEST-ONLY-run',
    },
    responses: items.map(item => ({
      id: item.id,
      input_sha256: item.input_sha256,
      response_id: `TEST-ONLY-response-${item.id}`,
      candidate: item.ambiguous
        ? { level: null as string | null, confidence: null as number | null }
        : { level: 'A2' as string | null, confidence: 0.9 as number | null },
    })),
  }
  return { fixture, profile, policy: syntheticPolicy(), responses }
}

export const rebindSyntheticInputs = async (
  input: Awaited<ReturnType<typeof syntheticInputs>>
) => {
  const fixture = await validateFixture(input.fixture)
  input.responses.profile_sha256 = await profileDigest(input.profile)
  input.responses.request_sha256 = await requestDigest(
    fixture,
    input.responses.profile_sha256
  )
}
