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
    expect(buildConflictSafeAnalysisUpdate(analysis)).not.toMatchObject({
      dutch_lemma: expect.anything(),
      part_of_speech: expect.anything(),
      article: expect.anything(),
    })
  })
})
