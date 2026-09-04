import type { ReviewEventEvidence, ReviewWord } from './types'
import {
  buildRecognitionOptions,
  getReviewAnswer,
  getReviewIntervalLabel,
  isDueOnLocalDate,
  resolveAdaptiveReviewMode,
  selectReviewWords,
} from './review-domain'

const makeWord = (overrides: Partial<ReviewWord> = {}): ReviewWord => ({
  article: null,
  collectionId: '11111111-1111-4111-8111-111111111111',
  dutchLemma: 'lopen',
  dutchOriginal: 'lopen',
  easinessFactor: 2.5,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  imageUrl: null,
  intervalDays: 0,
  lastReviewedAt: null,
  nextReviewDate: '2026-08-30',
  partOfSpeech: 'verb',
  repetitionCount: 0,
  translations: { en: ['to walk'] },
  ttsUrl: null,
  ...overrides,
})

const makeEvent = (
  index: number,
  overrides: Partial<ReviewEventEvidence> = {}
): ReviewEventEvidence => ({
  answeredCorrectly: true,
  assessment: 'good',
  eventId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  reviewMode: 'recognition',
  reviewedAt: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
  wordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ...overrides,
})

describe('review domain', () => {
  it('compares due dates using the browser local calendar day', () => {
    const localDate = new Date(2026, 7, 30, 0, 5)

    expect(isDueOnLocalDate('2026-08-30', localDate)).toBe(true)
    expect(isDueOnLocalDate('2026-08-31', localDate)).toBe(false)
  })

  it('supports all, collection, and difficult due scopes', () => {
    const words = [
      makeWord(),
      makeWord({
        collectionId: '22222222-2222-4222-8222-222222222222',
        easinessFactor: 2,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
      makeWord({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        nextReviewDate: '2026-08-31',
      }),
    ]
    const date = new Date(2026, 7, 30, 12)

    expect(selectReviewWords(words, 'all-due', null, date)).toHaveLength(2)
    expect(
      selectReviewWords(
        words,
        'collection-due',
        '11111111-1111-4111-8111-111111111111',
        date
      ).map(word => word.id)
    ).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])
    expect(selectReviewWords(words, 'difficult-due', null, date)).toHaveLength(
      1
    )
  })

  it('builds deterministic recognition options without semantic duplicates', () => {
    const currentWord = makeWord()
    const options = buildRecognitionOptions(currentWord, [
      currentWord,
      makeWord({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        translations: { en: ['to run'] },
      }),
      makeWord({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        translations: { en: ['to read'] },
      }),
      makeWord({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        translations: { en: ['to run'] },
      }),
    ])

    expect(options).toHaveLength(3)
    expect(options?.filter(option => option.isCorrect)).toEqual([
      expect.objectContaining({ label: 'to walk' }),
    ])
  })

  it('reveals translations for recall and Dutch for production', () => {
    const verb = makeWord()
    const noun = makeWord({
      article: 'het',
      dutchLemma: 'huis',
      partOfSpeech: 'noun',
      translations: { en: ['house'] },
    })

    expect(getReviewAnswer(verb, 'recognition')).toBe('to walk')
    expect(getReviewAnswer(verb, 'meaning-recall')).toBe('to walk')
    expect(getReviewAnswer(noun, 'dutch-production')).toBe('het huis')
  })

  it('describes the next interval for every assessment', () => {
    const newWord = makeWord()
    const establishedWord = makeWord({
      easinessFactor: 2.5,
      intervalDays: 6,
      repetitionCount: 2,
    })

    expect(getReviewIntervalLabel(newWord, 'again')).toBe('in 10 minutes')
    expect(getReviewIntervalLabel(newWord, 'hard')).toBe('in 1 day')
    expect(getReviewIntervalLabel(newWord, 'good')).toBe('in 1 day')
    expect(getReviewIntervalLabel(newWord, 'easy')).toBe('in 4 days')
    expect(getReviewIntervalLabel(establishedWord, 'good')).toBe('in 15 days')
    expect(getReviewIntervalLabel(establishedWord, 'easy')).toBe('in 20 days')
  })

  it('promotes and demotes adaptive review mode with the mobile policy', () => {
    const recognitionSuccesses = [0, 1, 2].map(index => makeEvent(index))
    expect(resolveAdaptiveReviewMode(recognitionSuccesses)).toMatchObject({
      mode: 'meaning-recall',
      previousMode: 'recognition',
      reason: 'promotion',
    })

    const meaningFailures = [
      ...recognitionSuccesses,
      makeEvent(3, {
        answeredCorrectly: null,
        assessment: 'again',
        reviewMode: 'meaning-recall',
      }),
      makeEvent(4, {
        answeredCorrectly: null,
        assessment: 'good',
        reviewMode: 'meaning-recall',
      }),
      makeEvent(5, {
        answeredCorrectly: null,
        assessment: 'again',
        reviewMode: 'meaning-recall',
      }),
    ]

    expect(resolveAdaptiveReviewMode(meaningFailures)).toMatchObject({
      mode: 'recognition',
      previousMode: 'meaning-recall',
      reason: 'demotion',
    })
  })
})
