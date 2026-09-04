import { createMockWord } from '@/__tests__/helpers/factories'
import {
  buildRecognitionOptions,
  getDutchProductionAnswer,
  getPreferredTranslation,
} from '../reviewDistractors'

describe('reviewDistractors', () => {
  const currentWord = createMockWord({
    word_id: 'current',
    dutch_lemma: 'huis',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['house'], ru: ['дом'] },
  })

  const vocabulary = [
    currentWord,
    createMockWord({
      word_id: 'noun-1',
      dutch_lemma: 'tafel',
      part_of_speech: 'noun',
      translations: { en: ['table'] },
    }),
    createMockWord({
      word_id: 'noun-2',
      dutch_lemma: 'stoel',
      part_of_speech: 'noun',
      translations: { en: ['chair'] },
    }),
    createMockWord({
      word_id: 'verb-1',
      dutch_lemma: 'lopen',
      part_of_speech: 'verb',
      article: null,
      translations: { en: ['to walk'] },
    }),
    createMockWord({
      word_id: 'verb-2',
      dutch_lemma: 'slapen',
      part_of_speech: 'verb',
      article: null,
      translations: { en: ['to sleep'] },
    }),
  ]

  it('builds stable options without duplicate labels', () => {
    const first = buildRecognitionOptions(currentWord, vocabulary)
    const second = buildRecognitionOptions(currentWord, [...vocabulary])

    expect(first).toEqual(second)
    expect(first).toHaveLength(4)
    expect(first?.filter(option => option.isCorrect)).toEqual([
      expect.objectContaining({ label: 'house' }),
    ])
    expect(new Set(first?.map(option => option.label)).size).toBe(first?.length)
  })

  it('prefers same-part-of-speech distractors', () => {
    const options = buildRecognitionOptions(currentWord, vocabulary, 3)

    expect(options?.map(option => option.id).sort()).toEqual(
      ['current', 'noun-1', 'noun-2'].sort()
    )
  })

  it('excludes identical and semantic duplicate translations', () => {
    const options = buildRecognitionOptions(currentWord, [
      currentWord,
      createMockWord({
        word_id: 'duplicate-primary',
        translations: { en: [' house '] },
      }),
      createMockWord({
        word_id: 'duplicate-secondary',
        translations: { en: ['home'], ru: ['дом'] },
      }),
      createMockWord({
        word_id: 'safe-1',
        translations: { en: ['table'] },
      }),
      createMockWord({
        word_id: 'safe-2',
        translations: { en: ['chair'] },
      }),
    ])

    expect(options?.map(option => option.id)).not.toContain('duplicate-primary')
    expect(options?.map(option => option.id)).not.toContain(
      'duplicate-secondary'
    )
  })

  it('falls back when fewer than two safe distractors exist', () => {
    const options = buildRecognitionOptions(currentWord, [
      currentWord,
      createMockWord({
        word_id: 'only-safe-option',
        translations: { en: ['table'] },
      }),
    ])

    expect(options).toBeNull()
  })

  it('uses Russian when no English translation is available', () => {
    const word = createMockWord({ translations: { en: [], ru: ['  дом  '] } })

    expect(getPreferredTranslation(word)).toBe('дом')
  })

  it('returns null when no usable translation exists', () => {
    const word = createMockWord({ translations: { en: ['  '], ru: [] } })

    expect(getPreferredTranslation(word)).toBeNull()
  })

  it('includes the known article in a Dutch noun answer', () => {
    expect(getDutchProductionAnswer(currentWord)).toBe('het huis')
  })
})
