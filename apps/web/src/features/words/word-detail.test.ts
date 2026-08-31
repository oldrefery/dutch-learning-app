import { buildWordDetail, canRenderWordImage, isUuid } from './word-detail'
import type { WordRow } from './word-detail'

const createWordRow = (overrides: Partial<WordRow> = {}): WordRow => ({
  analysis_notes: null,
  antonyms: [],
  article: 'het',
  collection_id: '18efc3c3-058d-47e3-9bba-868755678c87',
  conjugation: null,
  created_at: '2026-08-01T12:00:00.000Z',
  deleted_at: null,
  dutch_lemma: 'huis',
  dutch_original: null,
  easiness_factor: 2.5,
  examples: null,
  expression_type: null,
  image_url: null,
  interval_days: 1,
  is_expression: false,
  is_irregular: false,
  is_reflexive: false,
  is_separable: false,
  last_reviewed_at: null,
  next_review_date: '2026-08-31',
  part_of_speech: 'noun',
  plural: 'huizen',
  prefix_part: null,
  preposition: null,
  register: 'neutral',
  repetition_count: 0,
  root_verb: null,
  synonyms: [],
  translations: { en: ['house'], ru: ['дом'] },
  tts_url: 'https://translate.google.com/translate_tts?q=huis',
  updated_at: null,
  usage_notes: null,
  user_id: 'user-1',
  word_id: '98f0828c-8f15-4f72-8f55-38566973ee86',
  ...overrides,
})

describe('word detail mapper', () => {
  it('normalizes the complete display contract', () => {
    const detail = buildWordDetail(
      createWordRow({
        conjugation: {
          present: 'woon',
          simple_past: 'woonde',
          past_participle: 'gewoond',
        },
        examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.' }],
        usage_notes: {
          summary: 'A common noun.',
          contrasts: [
            {
              term: 'thuis',
              distinction: 'Means at home.',
              example: { nl: 'Ik ben thuis.', en: 'I am at home.' },
            },
          ],
        },
      })
    )

    expect(detail).toMatchObject({
      dutchLemma: 'huis',
      translations: { en: ['house'], ru: ['дом'] },
      examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.' }],
      conjugation: {
        present: 'woon',
        simplePast: 'woonde',
        pastParticiple: 'gewoond',
      },
      usageNotes: {
        summary: 'A common noun.',
        contrasts: [{ term: 'thuis', distinction: 'Means at home.' }],
      },
    })
  })

  it('drops malformed optional Json structures and unsafe media URLs', () => {
    const detail = buildWordDetail(
      createWordRow({
        conjugation: { unexpected: true },
        examples: [null, { nl: 'Alleen Nederlands' }],
        image_url: 'javascript:alert(1)',
        translations: ['invalid'],
        tts_url: 'http://example.com/audio.mp3',
        usage_notes: { summary: '', contrasts: [null] },
      })
    )

    expect(detail).toMatchObject({
      conjugation: null,
      examples: [],
      imageUrl: null,
      translations: { en: [], ru: [] },
      ttsUrl: null,
      usageNotes: null,
    })
  })

  it('limits inline images to configured providers', () => {
    expect(canRenderWordImage('https://images.unsplash.com/photo-1')).toBe(true)
    expect(canRenderWordImage('https://picsum.photos/600/400')).toBe(true)
    expect(canRenderWordImage('https://example.com/photo.jpg')).toBe(false)
  })

  it('validates UUID identifiers', () => {
    expect(isUuid('98f0828c-8f15-4f72-8f55-38566973ee86')).toBe(true)
    expect(isUuid('word-1')).toBe(false)
  })
})
