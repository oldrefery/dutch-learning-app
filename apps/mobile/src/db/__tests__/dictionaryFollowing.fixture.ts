import type {
  DictionaryContent,
  DictionaryEffectiveBatchV2,
} from '@woordenaar/domain'

export const OWNER_A = '11111111-1111-4111-8111-111111111111'
export const OWNER_B = '22222222-2222-4222-8222-222222222222'
export const WORD_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const WORD_A2 = 'abababab-abab-4bab-8bab-abababababab'
export const WORD_B = 'acacacac-acac-4cac-8cac-acacacacacac'
export const ENTRY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const REVISION_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
export const REVISION_2 = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'
export const AT = '2026-10-10T12:00:00.000Z'

export const followingContent: DictionaryContent = {
  dutch_lemma: 'huis',
  dutch_original: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: ['дом'] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'huizen',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}

export const followingBatch = (
  sequence = '9007199254740993',
  revisionId = REVISION_1,
  ids = [WORD_A]
): DictionaryEffectiveBatchV2 => ({
  protocol_version: 2,
  watermark: sequence,
  cards: ids.map(word_id => ({
    word_id,
    mode: 'follow',
    content_version: '9007199254740992',
    reference: { entry_id: ENTRY, revision_id: revisionId },
    adopted_revision_id: REVISION_1,
    head_sequence: sequence,
    legacy_content: null,
    removed_fields: [],
    cefr: { level: null, status: 'unknown', confidence: null },
  })),
  revisions:
    ids.length === 0
      ? []
      : [
          {
            revision_id: revisionId,
            entry_id: ENTRY,
            revision_no: revisionId === REVISION_1 ? 1 : 2,
            schema_version: 1,
            content: {
              ...followingContent,
              translations: {
                en: [revisionId === REVISION_1 ? 'house' : 'home'],
                ru: ['дом'],
              },
            },
            content_sha256: (revisionId === REVISION_1 ? 'a' : 'c').repeat(64),
            cefr_input_sha256: 'b'.repeat(64),
            review_status: 'published',
          },
        ],
})

export const followingPage = (
  after: string,
  next: string,
  revisionId = REVISION_1
) => ({
  protocol_version: 2,
  after,
  next_cursor: next,
  latest_cursor: next,
  has_more: false,
  changes:
    next === after
      ? []
      : [
          {
            cursor: next,
            kind: 'revision-head',
            entry_id: ENTRY,
            revision_id: revisionId,
            assessment_id: null,
          },
        ],
})
