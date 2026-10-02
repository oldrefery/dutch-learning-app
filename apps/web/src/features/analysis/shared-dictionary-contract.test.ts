import {
  canonicalizeCefrInput,
  resolveEffectiveDictionaryContent,
  resolveInheritedCefr,
  type DictionaryContent,
} from '@woordenaar/domain'

const entryId = '11111111-1111-4111-8111-111111111111'
const revisionId = '22222222-2222-4222-8222-222222222222'
const digest = (value: string) => value.repeat(64)

const content = (): DictionaryContent => ({
  dutch_lemma: 'fiets',
  dutch_original: 'fiets',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['bicycle'], ru: [] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'fietsen',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})

describe('shared dictionary contract on web', () => {
  it('uses the domain resolver without a web-only interpretation', () => {
    const result = resolveEffectiveDictionaryContent({
      reference: { entry_id: entryId, revision_id: revisionId },
      revision: {
        revision_id: revisionId,
        entry_id: entryId,
        revision_no: 1,
        schema_version: 1,
        content: content(),
        content_sha256: digest('a'),
        cefr_input_sha256: digest('b'),
        review_status: 'published',
      },
      fallback_content: null,
      overrides: { plural: { op: 'remove' } },
    })
    expect(result).toMatchObject({
      source: 'pinned',
      content: { plural: null },
    })
    expect(
      resolveInheritedCefr({
        reference: null,
        revision: null,
        overrides: {},
        assessment: null,
      })
    ).toEqual({
      level: null,
      status: 'unknown',
      reason: 'unlinked-or-missing-revision',
    })
    expect(canonicalizeCefrInput(content())).toContain(
      'assessment_schema_version'
    )
  })
})
