import type { DatabaseSync } from 'node:sqlite'
import type { Word } from '@/types/database'
import { wordRepository } from '../wordRepository'
import { createTestDatabase } from './sqlite.fixture'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const USER_ID = 'official-pack-fixture-user'
const COLLECTION_ID = 'official-pack-fixture-collection'
const TIMESTAMP = '2026-09-11T12:00:00.000Z'
const WORD_COUNT_QUERY = 'SELECT COUNT(*) AS count FROM words'

const createWord = (index: number, overrides: Partial<Word> = {}): Word => ({
  word_id: `official-word-${index}`,
  user_id: USER_ID,
  collection_id: COLLECTION_ID,
  dutch_lemma: `woord-${index}`,
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
  translations: { en: [`word ${index}`] },
  examples: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  image_url: null,
  tts_url: null,
  interval_days: 0,
  repetition_count: 0,
  easiness_factor: 2.5,
  next_review_date: '2026-09-11',
  last_reviewed_at: null,
  analysis_notes: null,
  usage_notes: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  ...overrides,
})

describe('official pack imports in real SQLite', () => {
  let database: DatabaseSync

  beforeEach(() => {
    database = createTestDatabase()
  })

  afterEach(() => database.close())

  it('stores a large pack atomically as pending without changing supplied SRS values', async () => {
    const words = Array.from({ length: 122 }, (_, index) =>
      createWord(
        index,
        index === 0
          ? {
              interval_days: 21,
              repetition_count: 5,
              easiness_factor: 2.8,
              next_review_date: '2026-10-02',
              last_reviewed_at: '2026-09-10T08:00:00.000Z',
            }
          : {}
      )
    )

    await wordRepository.addWords(words)

    expect(database.prepare(WORD_COUNT_QUERY).get()).toEqual({ count: 122 })
    expect(
      database
        .prepare(
          `SELECT interval_days, repetition_count, easiness_factor,
                  next_review_date, last_reviewed_at, sync_status
             FROM words WHERE word_id = 'official-word-0'`
        )
        .get()
    ).toEqual({
      interval_days: 21,
      repetition_count: 5,
      easiness_factor: 2.8,
      next_review_date: '2026-10-02',
      last_reviewed_at: '2026-09-10T08:00:00.000Z',
      sync_status: 'pending',
    })
  })

  it('rolls back the whole batch on a semantic duplicate and permits a clean retry', async () => {
    const duplicate = createWord(2, {
      word_id: 'duplicate-word-id',
      dutch_lemma: 'woord-1',
    })

    await expect(
      wordRepository.addWords([createWord(1), duplicate])
    ).rejects.toThrow()
    expect(database.prepare(WORD_COUNT_QUERY).get()).toEqual({ count: 0 })

    await wordRepository.addWords([
      createWord(1),
      { ...duplicate, dutch_lemma: 'uniek-woord' },
    ])
    expect(database.prepare(WORD_COUNT_QUERY).get()).toEqual({ count: 2 })
  })

  it('preserves an existing word and its progress when a mixed batch conflicts', async () => {
    const existingWord = createWord(7, {
      interval_days: 34,
      repetition_count: 8,
      easiness_factor: 2.9,
      next_review_date: '2026-10-15',
    })
    await wordRepository.addWord(existingWord)

    await expect(
      wordRepository.addWords([
        createWord(8),
        createWord(9, {
          dutch_lemma: existingWord.dutch_lemma,
          article: existingWord.article,
          part_of_speech: existingWord.part_of_speech,
        }),
      ])
    ).rejects.toThrow()

    expect(
      database
        .prepare(
          `SELECT interval_days, repetition_count, easiness_factor,
                  next_review_date FROM words WHERE word_id = ?`
        )
        .get(existingWord.word_id)
    ).toEqual({
      interval_days: 34,
      repetition_count: 8,
      easiness_factor: 2.9,
      next_review_date: '2026-10-15',
    })
    expect(database.prepare(WORD_COUNT_QUERY).get()).toEqual({ count: 1 })
  })
})
