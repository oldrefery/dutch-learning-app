import type { LocalDictionaryMaterialization } from '../dictionaryContentRepository'
import {
  applyDictionaryMaterialization,
  applyDictionaryMaterializations,
} from '../dictionaryWordMaterialization'
import type { Word } from '@/types/database'

const LAST_REVIEWED_AT = '2026-09-20T12:00:00.000Z'

const word: Word = {
  word_id: '3c74297a-56a4-4ec0-830d-871dba0ee0c2',
  user_id: '98f2a74c-e25a-4cd9-809b-91bdbd34e3ee',
  collection_id: null,
  dutch_lemma: 'legacy huis',
  dutch_original: null,
  part_of_speech: 'noun',
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  article: 'het',
  plural: null,
  register: 'neutral',
  translations: { en: ['legacy house'] },
  examples: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  image_url: null,
  tts_url: null,
  interval_days: 21,
  repetition_count: 5,
  easiness_factor: 2.8,
  next_review_date: '2026-10-12',
  last_reviewed_at: LAST_REVIEWED_AT,
  analysis_notes: null,
  usage_notes: null,
  created_at: '2026-09-01T12:00:00.000Z',
  updated_at: LAST_REVIEWED_AT,
}

const materialization: LocalDictionaryMaterialization = {
  word_id: word.word_id,
  content_version: 4,
  reference: {
    entry_id: 'ff6eae80-7fca-49df-8bb3-86d0c14e38e1',
    revision_id: 'c0340c22-1e70-48f8-b681-30e380083a55',
  },
  dependency_status: 'ready',
  effective: {
    source: 'pinned',
    removed_fields: ['translations'],
    content: {
      dutch_lemma: 'huis',
      dutch_original: 'huis',
      part_of_speech: 'noun',
      article: 'het',
      translations: null,
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
      synonyms: ['woning'],
      antonyms: [],
      conjugation: null,
      preposition: null,
      analysis_notes: null,
      usage_notes: null,
      image_url: 'https://example.com/huis.jpg',
      tts_url: null,
    },
  },
  cefr: { level: 'A2', status: 'estimated', reason: 'inherited' },
}

describe('dictionary word materialization', () => {
  it('projects effective content and CEFR without changing learning state', () => {
    const result = applyDictionaryMaterialization(word, materialization)

    expect(result).toMatchObject({
      dutch_lemma: 'huis',
      plural: 'huizen',
      translations: { en: [], ru: [] },
      synonyms: ['woning'],
      image_url: 'https://example.com/huis.jpg',
      cefr_level: 'A2',
      cefr_status: 'estimated',
      dictionary_content_source: 'pinned',
      interval_days: 21,
      repetition_count: 5,
      easiness_factor: 2.8,
      next_review_date: '2026-10-12',
      last_reviewed_at: LAST_REVIEWED_AT,
    })
  })

  it('leaves words without local dictionary state unchanged', () => {
    expect(applyDictionaryMaterializations([word], new Map())).toEqual([word])
  })
})
