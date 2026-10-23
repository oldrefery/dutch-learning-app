import {
  parseDictionaryAnalysisValidationV1,
  parseDictionaryRevisionProvenanceV2,
  type DictionaryContent,
} from '@woordenaar/domain'

const revision = '11111111-1111-4111-8111-111111111111'
const digest = 'a'.repeat(64)
const content: DictionaryContent = {
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: [] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'banken',
  register: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const packet = {
  validator_version: 'qualified-validator-v1',
  policy_sha256: digest,
  anchor_sha256: digest,
  input_sha256: digest,
  result_sha256: digest,
  meaning_evidence_sha256: digest,
  outcome: 'accepted',
  decision_code: 'same-meaning',
  content,
  content_sha256: digest,
  cefr_input_sha256: digest,
}
const human = {
  revision_id: revision,
  content_sha256: digest,
  verified_at: '2026-10-10T12:00:00Z',
  method: 'human',
  validator_version: null,
  provider: null,
  model: null,
}
const machine = {
  ...human,
  method: 'automated',
  validator_version: 'qualified-validator-v1',
  provider: 'provider',
  model: 'model',
}
const REJECTED = 'rejected'

describe('machine validation and redacted publication provenance', () => {
  it('accepts a complete evidence packet without confusing it with a human review', () => {
    expect(parseDictionaryAnalysisValidationV1(packet)).toEqual({
      success: true,
      data: packet,
    })
  })
  it.each([
    { ...packet, actor_id: revision },
    { ...packet, reviewed_by: revision },
    { ...packet, result_sha256: 'invalid' },
    { ...packet, outcome: 'approved' },
    { ...packet, decision_code: 'confidence-high' },
    { ...packet, outcome: 'review-required' },
    { ...packet, content_sha256: null },
    { ...packet, content: { ...content, translations: { en: [], ru: [] } } },
    {
      ...packet,
      content: { ...content, usage_notes: { arbitrary: 'private prompt' } },
    },
  ])(
    'rejects inconsistent, incomplete or client-injected validation evidence %p',
    input => {
      expect(parseDictionaryAnalysisValidationV1(input).success).toBe(false)
    }
  )
  it('preserves explicit rejected and uncertain outcomes without a publishable candidate', () => {
    for (const [outcome, code] of [
      [REJECTED, 'meaning-mismatch'],
      ['review-required', 'meaning-uncertain'],
    ]) {
      const input = {
        ...packet,
        outcome,
        decision_code: code,
        content: null,
        content_sha256: null,
        cefr_input_sha256: null,
      }
      expect(parseDictionaryAnalysisValidationV1(input)).toEqual({
        success: true,
        data: input,
      })
      expect(
        parseDictionaryAnalysisValidationV1({ ...input, content }).success
      ).toBe(false)
    }
  })
  it('accepts separate human/automated records and an empty bounded batch', () => {
    expect(parseDictionaryRevisionProvenanceV2([human])).toEqual({
      success: true,
      data: [human],
    })
    expect(parseDictionaryRevisionProvenanceV2([machine])).toEqual({
      success: true,
      data: [machine],
    })
    expect(parseDictionaryRevisionProvenanceV2([])).toEqual({
      success: true,
      data: [],
    })
  })
  it.each(
    [
      [human, human],
      [{ ...human, actor_id: revision }],
      [{ ...human, prompt: 'private' }],
      [{ ...human, validator_version: 'machine-marked-human' }],
      [{ ...machine, provider: null }],
      [{ ...machine, verified_at: 'yesterday' }],
      [{ ...machine, content_sha256: null }],
      Array(501).fill(human),
    ].map(input => [input])
  )(
    'rejects leaked, duplicate, unbounded or misleading provenance %p',
    input => {
      expect(parseDictionaryRevisionProvenanceV2(input).success).toBe(false)
    }
  )
})
