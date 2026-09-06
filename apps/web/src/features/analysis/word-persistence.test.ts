import { parseWordAnalysis } from './analysis-contract'
import {
  buildConflictSafeAnalysisUpdate,
  buildWordAnalysisUpdate,
  buildWordInsert,
} from './word-persistence'

const analysis = parseWordAnalysis({
  dutch_original: 'het huis',
  dutch_lemma: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: ['дом'] },
  examples: [{ nl: 'Mijn huis.', en: 'My house.' }],
  tts_url: 'https://example.com/huis.mp3',
})

describe('word persistence mappers', () => {
  it('builds the initial mobile-compatible SRS row', () => {
    expect(
      buildWordInsert(
        analysis,
        'user-1',
        'collection-1',
        new Date('2026-08-30T15:00:00.000Z')
      )
    ).toMatchObject({
      dutch_lemma: 'huis',
      user_id: 'user-1',
      collection_id: 'collection-1',
      interval_days: 1,
      repetition_count: 0,
      easiness_factor: 2.5,
      next_review_date: '2026-08-30',
      last_reviewed_at: null,
    })
  })

  it('updates linguistic data without SRS fields', () => {
    const update = buildWordAnalysisUpdate(analysis)
    expect(update).toMatchObject({ dutch_lemma: 'huis', article: 'het' })
    expect(update).not.toHaveProperty('interval_days')
    expect(update).not.toHaveProperty('repetition_count')
    expect(update).not.toHaveProperty('next_review_date')
  })

  it('preserves the current semantic key after a duplicate collision', () => {
    const update = buildConflictSafeAnalysisUpdate(analysis)
    for (const key of ['dutch_lemma', 'part_of_speech', 'article']) {
      expect(update).not.toHaveProperty(key)
    }
    expect(update).toMatchObject({
      dutch_original: 'het huis',
      translations: { en: ['house'], ru: ['дом'] },
    })
    expect(buildWordAnalysisUpdate(analysis)).toMatchObject({
      dutch_lemma: 'huis',
      part_of_speech: 'noun',
      article: 'het',
    })
  })

  it('serializes every linguistic field without changing the input or writing progress', () => {
    const richAnalysis = {
      ...analysis,
      isIrregular: true,
      isReflexive: true,
      isExpression: true,
      isSeparable: true,
      expressionType: 'phrase',
      prefixPart: 'op',
      rootVerb: 'staan',
      plural: 'huizen',
      register: 'formal' as const,
      synonyms: ['woning'],
      antonyms: ['buiten'],
      preposition: 'in',
      imageUrl: 'https://example.com/huis.jpg',
      analysisNotes: 'Usage context',
      conjugation: {
        present: 'sta op',
        simplePast: 'stond op',
        simplePastPlural: 'stonden op',
        pastParticiple: 'opgestaan',
      },
      usageNotes: {
        summary: 'A place to live',
        contrasts: [
          {
            term: 'woning',
            distinction: 'More formal',
            example: { nl: 'Een woning.', en: 'A dwelling.', ru: 'Жильё.' },
          },
          { term: 'thuis', distinction: 'At home', example: null },
        ],
      },
    }
    const before = JSON.stringify(richAnalysis)
    expect(buildWordAnalysisUpdate(richAnalysis)).toEqual({
      dutch_lemma: 'huis',
      dutch_original: 'het huis',
      part_of_speech: 'noun',
      article: 'het',
      is_irregular: true,
      is_reflexive: true,
      is_expression: true,
      is_separable: true,
      expression_type: 'phrase',
      prefix_part: 'op',
      root_verb: 'staan',
      plural: 'huizen',
      register: 'formal',
      synonyms: ['woning'],
      antonyms: ['buiten'],
      preposition: 'in',
      translations: { en: ['house'], ru: ['дом'] },
      examples: [{ nl: 'Mijn huis.', en: 'My house.', ru: null }],
      tts_url: 'https://example.com/huis.mp3',
      image_url: 'https://example.com/huis.jpg',
      analysis_notes: 'Usage context',
      conjugation: {
        present: 'sta op',
        simple_past: 'stond op',
        simple_past_plural: 'stonden op',
        past_participle: 'opgestaan',
      },
      usage_notes: {
        summary: 'A place to live',
        contrasts: [
          {
            term: 'woning',
            distinction: 'More formal',
            example: { nl: 'Een woning.', en: 'A dwelling.', ru: 'Жильё.' },
          },
          { term: 'thuis', distinction: 'At home', example: null },
        ],
      },
    })
    expect(JSON.stringify(richAnalysis)).toBe(before)
  })

  it('stores explicit empty optional data and inserts with the current UTC date', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-06T00:05:00.000Z'))
    try {
      const minimal = parseWordAnalysis({
        dutch_lemma: 'hoi',
        translations: { en: ['hello'] },
      })
      const update = buildWordAnalysisUpdate(minimal)
      expect(update).toMatchObject({
        conjugation: null,
        usage_notes: null,
        tts_url: '',
        examples: [],
      })
      expect(buildWordInsert(minimal, 'user-2', 'collection-2')).toEqual({
        ...update,
        user_id: 'user-2',
        collection_id: 'collection-2',
        easiness_factor: 2.5,
        interval_days: 1,
        repetition_count: 0,
        next_review_date: '2026-09-06',
        last_reviewed_at: null,
      })
    } finally {
      jest.useRealTimers()
    }
  })
})
