import type { DatabaseSync } from 'node:sqlite'
import type { Word } from '@/types/database'
import { wordRepository } from '../wordRepository'
import { createTestDatabase } from './sqlite.fixture'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { dictionaryContentRepository } from '../dictionaryContentRepository'
import { wordToDictionaryContent } from '../dictionaryContentMapping'

jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: jest.fn(() => true),
}))

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const USER_ID = 'official-pack-fixture-user'
const COLLECTION_ID = 'official-pack-fixture-collection'
const TIMESTAMP = '2026-09-11T12:00:00.000Z'
const WORD_COUNT_QUERY = 'SELECT COUNT(*) AS count FROM words'
const CREATE_PRIVATE = 'create-private'
const ALL_DICTIONARY_COMMANDS = 'SELECT * FROM dictionary_content_commands'
const WORD_BY_ID = 'SELECT * FROM words WHERE word_id = ?'

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
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
    database = createTestDatabase()
  })

  afterEach(() => database.close())

  it('atomically queues pinned links after creation with independent personal IDs and complete offline fallback', async () => {
    const reference = {
      entry_id: '10000000-0000-4000-8000-000000000001',
      revision_id: '20000000-0000-4000-8000-000000000001',
    }
    const word = createWord(77, {
      word_id: '40000000-0000-4000-8000-000000000001',
      interval_days: 19,
      repetition_count: 4,
    })
    await dictionaryContentRepository.cacheDependencies([
      {
        revision: {
          ...reference,
          revision_no: 1,
          schema_version: 1,
          review_status: 'published',
          content: wordToDictionaryContent(word),
          content_sha256: 'a'.repeat(64),
          cefr_input_sha256: 'b'.repeat(64),
        },
      },
    ])
    await wordRepository.addWords([word], [reference])
    const card = database
      .prepare('SELECT * FROM dictionary_card_content WHERE word_id = ?')
      .get(word.word_id)
    expect(card).toMatchObject({
      word_id: word.word_id,
      content_version: 2,
      entry_id: reference.entry_id,
      revision_id: reference.revision_id,
    })
    expect(card?.fallback_content_json).toBeNull()
    const materialized =
      await dictionaryContentRepository.getMaterializedContent(USER_ID, [
        word.word_id,
      ])
    expect(materialized.get(word.word_id)?.effective.content).toMatchObject({
      translations: word.translations,
    })
    expect(materialized.get(word.word_id)?.dependency_status).toBe('ready')
    const commands = database
      .prepare(
        'SELECT payload_json FROM dictionary_content_commands ORDER BY sequence'
      )
      .all()
      .map(row => JSON.parse(String(row.payload_json)))
    expect(commands).toHaveLength(2)
    expect(commands[0]).toMatchObject({
      word_id: word.word_id,
      kind: CREATE_PRIVATE,
      expected_content_version: 0,
    })
    expect(commands[1]).toMatchObject({
      word_id: word.word_id,
      kind: 'link',
      expected_content_version: 1,
      reference,
      overrides: {},
    })
    expect(
      database
        .prepare(
          'SELECT interval_days, repetition_count FROM words WHERE word_id = ?'
        )
        .get(word.word_id)
    ).toEqual({ interval_days: 19, repetition_count: 4 })
    await wordRepository.updateWordImage(
      word.word_id,
      USER_ID,
      'https://example.invalid/private-image.jpg'
    )
    const edited = database
      .prepare('SELECT * FROM dictionary_card_content WHERE word_id = ?')
      .get(word.word_id)
    expect(edited).toMatchObject({
      content_version: 3,
      entry_id: reference.entry_id,
    })
    expect(JSON.parse(String(edited?.overrides_json))).toEqual({
      image_url: {
        op: 'set',
        value: 'https://example.invalid/private-image.jpg',
      },
    })
  })

  it('rejects malformed reference batches before inserting any words or commands', async () => {
    await expect(wordRepository.addWords([createWord(78)], [])).rejects.toThrow(
      'Invalid official import references'
    )
    await expect(
      wordRepository.addWords(
        [createWord(78)],
        [{ entry_id: 'bad', revision_id: 'bad' }]
      )
    ).rejects.toThrow('Invalid official import references')
    expect(database.prepare(WORD_COUNT_QUERY).get()).toEqual({ count: 0 })
    expect(database.prepare(ALL_DICTIONARY_COMMANDS).all()).toEqual([])
    await expect(
      wordRepository.addWords(
        [createWord(79)],
        [
          {
            entry_id: '10000000-0000-4000-8000-000000000001',
            revision_id: '20000000-0000-4000-8000-000000000001',
          },
        ]
      )
    ).rejects.toThrow('dependency is missing')
    expect(database.prepare(WORD_COUNT_QUERY).get()).toEqual({ count: 0 })
  })

  it('keeps the legacy path authoritative when dictionary adoption is disabled', async () => {
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(false)
    const word = createWord(999)
    await wordRepository.addWord(word)
    await wordRepository.updateAnalyzedWord({ ...word, plural: 'changed' })
    await wordRepository.updateWordImage(
      word.word_id,
      USER_ID,
      'https://example.com/image.jpg'
    )
    expect(database.prepare(ALL_DICTIONARY_COMMANDS).all()).toEqual([])
    expect(
      database.prepare('SELECT * FROM dictionary_card_content').all()
    ).toEqual([])
    expect(
      database.prepare('SELECT plural, image_url FROM words').get()
    ).toMatchObject({
      plural: 'changed',
      image_url: 'https://example.com/image.jpg',
    })
  })

  it('preserves pending legacy content before the first activated hydration', async () => {
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(false)
    const original = createWord(888)
    await wordRepository.addWord(original)
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
    await wordRepository.preserveLegacyPendingContent(USER_ID)
    await wordRepository.preserveLegacyPendingContent(USER_ID)
    const rows = database
      .prepare('SELECT payload_json FROM dictionary_content_commands')
      .all()
    expect(rows).toHaveLength(1)
    expect(JSON.parse(String(rows[0].payload_json))).toMatchObject({
      word_id: original.word_id,
      kind: CREATE_PRIVATE,
      content: { dutch_lemma: original.dutch_lemma },
    })
  })

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
    expect(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM dictionary_card_content
           WHERE user_id = ?`
        )
        .get(USER_ID)
    ).toEqual({ count: 122 })
    expect(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM dictionary_content_commands
           WHERE user_id = ? AND kind = 'create-private'`
        )
        .get(USER_ID)
    ).toEqual({ count: 122 })
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
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM dictionary_card_content')
        .get()
    ).toEqual({ count: 0 })
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM dictionary_content_commands')
        .get()
    ).toEqual({ count: 0 })

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

  it('queues projected content versions for re-analysis and private media edits', async () => {
    const original = createWord(11)
    await wordRepository.addWord(original)

    const reanalyzed: Word = {
      ...original,
      translations: { en: ['updated word'] },
      updated_at: '2026-09-21T15:00:00.000Z',
    }
    await wordRepository.updateAnalyzedWord(reanalyzed)
    await wordRepository.updateWordImage(
      original.word_id,
      original.user_id,
      'https://example.com/private.jpg'
    )

    expect(
      database
        .prepare(
          `SELECT content_version, entry_id, revision_id,
                  json_extract(fallback_content_json, '$.translations.en[0]') AS translation,
                  json_extract(overrides_json, '$.image_url.value') AS image_url
           FROM dictionary_card_content WHERE word_id = ?`
        )
        .get(original.word_id)
    ).toEqual({
      content_version: 3,
      entry_id: null,
      revision_id: null,
      translation: 'updated word',
      image_url: 'https://example.com/private.jpg',
    })
    expect(
      database
        .prepare(
          `SELECT kind, expected_content_version
           FROM dictionary_content_commands
           WHERE word_id = ? ORDER BY sequence`
        )
        .all(original.word_id)
    ).toEqual([
      { kind: CREATE_PRIVATE, expected_content_version: 0 },
      { kind: 'resolve-conflict', expected_content_version: 1 },
      { kind: 'edit-private', expected_content_version: 2 },
    ])
  })

  it('preserves the complete private override map when changing an image', async () => {
    const original = createWord(777)
    await wordRepository.addWord(original)
    const overrides = {
      plural: { op: 'set', value: 'private plural' },
      tts_url: { op: 'remove' },
    }
    database
      .prepare(
        'UPDATE dictionary_card_content SET overrides_json = ? WHERE word_id = ?'
      )
      .run(JSON.stringify(overrides), original.word_id)
    await wordRepository.updateWordImage(
      original.word_id,
      USER_ID,
      'https://example.com/new.jpg'
    )
    const row = database
      .prepare(
        'SELECT payload_json FROM dictionary_content_commands ORDER BY sequence DESC LIMIT 1'
      )
      .get()
    expect(JSON.parse(String(row?.payload_json))).toMatchObject({
      overrides: {
        ...overrides,
        image_url: { op: 'set', value: 'https://example.com/new.jpg' },
      },
    })
  })

  it('preserves dictionary commands when the personal row was already acknowledged', async () => {
    const original = createWord(30)
    await wordRepository.addWord(original)
    await wordRepository.markWordsSynced([original])
    const before = database.prepare(WORD_BY_ID).get(original.word_id)
    const commands = database.prepare(ALL_DICTIONARY_COMMANDS).all()
    await wordRepository.saveWords(
      [{ ...original, translations: { en: ['stale remote copy'] } }],
      { preserveUnsynced: true }
    )
    expect(database.prepare(WORD_BY_ID).get(original.word_id)).toEqual(before)
    expect(database.prepare(ALL_DICTIONARY_COMMANDS).all()).toEqual(commands)
  })

  it('does not remap a dictionary-backed personal identity to a remote semantic duplicate', async () => {
    const original = createWord(31)
    await wordRepository.addWord(original)
    await wordRepository.markWordsSynced([original])
    database
      .prepare('DELETE FROM dictionary_content_commands WHERE word_id = ?')
      .run(original.word_id)
    const before = database.prepare(WORD_BY_ID).get(original.word_id)
    await expect(
      wordRepository.saveWords(
        [{ ...original, word_id: 'different-personal-id' }],
        { preserveUnsynced: true }
      )
    ).rejects.toThrow('Personal word identity conflict')
    expect(database.prepare(WORD_BY_ID).get(original.word_id)).toEqual(before)
  })

  it('rolls back re-analysis when its dictionary command cannot be stored', async () => {
    const original = createWord(12)
    await wordRepository.addWord(original)
    database.exec(`CREATE TRIGGER fail_reanalysis_dictionary_command
      BEFORE INSERT ON dictionary_content_commands
      WHEN NEW.kind = 'resolve-conflict'
      BEGIN SELECT RAISE(ABORT, 'command storage failed'); END;`)

    await expect(
      wordRepository.updateAnalyzedWord({
        ...original,
        translations: { en: ['must roll back'] },
        updated_at: '2026-09-21T16:00:00.000Z',
      })
    ).rejects.toThrow('command storage failed')

    expect(
      database
        .prepare('SELECT translations FROM words WHERE word_id = ?')
        .get(original.word_id)
    ).toEqual({ translations: JSON.stringify(original.translations) })
    expect(
      database
        .prepare(
          `SELECT content_version FROM dictionary_card_content WHERE word_id = ?`
        )
        .get(original.word_id)
    ).toEqual({ content_version: 1 })
    expect(
      database
        .prepare(
          `SELECT COUNT(*) AS count FROM dictionary_content_commands WHERE word_id = ?`
        )
        .get(original.word_id)
    ).toEqual({ count: 1 })
  })
})
