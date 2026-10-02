import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { Word } from '@/types/database'
import { createTestDatabase } from './sqlite.fixture'
import { dictionaryContentRepository } from '../dictionaryContentRepository'
import { wordRepository } from '../wordRepository'
import { parseDictionaryContent } from '@woordenaar/domain'
import { syncStatusService } from '@/services/syncStatusService'

jest.mock('@/utils/network', () => ({
  getLastSyncTimestamp: jest.fn().mockResolvedValue(null),
  isNetworkAvailable: jest.fn().mockResolvedValue(true),
}))

jest.mock('../initDB')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))

const USER_ID = '98f2a74c-e25a-4cd9-809b-91bdbd34e3ee'
const OTHER_USER_ID = 'a337e11e-5d9e-4af8-8c84-724fe44d3730'
const WORD_ID = '3c74297a-56a4-4ec0-830d-871dba0ee0c2'
const TIMESTAMP = '2026-09-21T16:00:00.000Z'

const word: Word = {
  word_id: WORD_ID,
  user_id: USER_ID,
  collection_id: null,
  dutch_lemma: 'huis',
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
  plural: 'huizen',
  register: 'neutral',
  translations: { en: ['house'] },
  examples: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  image_url: null,
  tts_url: null,
  interval_days: 1,
  repetition_count: 0,
  easiness_factor: 2.5,
  next_review_date: '2026-09-22',
  last_reviewed_at: null,
  analysis_notes: null,
  usage_notes: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
}

describe('dictionary content persistence across restart', () => {
  let directory: string
  let path: string
  let database: DatabaseSync

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'dictionary-content-restart-'))
    path = join(directory, 'woordenaar.sqlite')
    database = createTestDatabase(path)
  })

  afterEach(() => {
    database.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('retains private fallback, pending intent and owner cursor after restart', async () => {
    await wordRepository.addWord(word)
    await dictionaryContentRepository.advanceChangeCursor(
      USER_ID,
      17,
      TIMESTAMP
    )
    const operationId = (
      await dictionaryContentRepository.getPendingCommands(USER_ID)
    )[0].command.operation_id

    database.close()
    database = createTestDatabase(path, false)

    expect(await dictionaryContentRepository.getChangeCursor(USER_ID)).toBe(17)
    expect(
      await dictionaryContentRepository.getChangeCursor(OTHER_USER_ID)
    ).toBe(0)
    expect(
      (await dictionaryContentRepository.getPendingCommands(USER_ID))[0].command
        .operation_id
    ).toBe(operationId)
    expect(
      await dictionaryContentRepository.getPendingCommands(OTHER_USER_ID)
    ).toEqual([])
    expect(
      (
        await dictionaryContentRepository.getMaterializedContent(USER_ID, [
          WORD_ID,
        ])
      ).get(WORD_ID)
    ).toMatchObject({
      content_version: 1,
      dependency_status: 'ready',
      effective: { source: 'fallback', content: { dutch_lemma: 'huis' } },
    })
    expect(
      await dictionaryContentRepository.getMaterializedContent(OTHER_USER_ID, [
        WORD_ID,
      ])
    ).toEqual(new Map())
  })

  it('keeps hydration-only status pending across restart until the card is saved', async () => {
    await wordRepository.addWord(word)
    const pending =
      await dictionaryContentRepository.getPendingCommands(USER_ID)
    await dictionaryContentRepository.acknowledgeCommand(
      USER_ID,
      pending[0].command.operation_id
    )
    database
      .prepare("UPDATE words SET sync_status = 'synced' WHERE word_id = ?")
      .run(WORD_ID)
    expect((await syncStatusService.getSnapshot(USER_ID)).totalPending).toBe(0)
    await dictionaryContentRepository.advanceChangeCursor(
      USER_ID,
      17,
      TIMESTAMP
    )
    await dictionaryContentRepository.requireCardRefresh(USER_ID, [
      WORD_ID,
      WORD_ID,
    ])

    database.close()
    database = createTestDatabase(path, false)

    expect(await dictionaryContentRepository.getChangeCursor(USER_ID)).toBe(17)
    expect(
      await dictionaryContentRepository.getPendingCommands(USER_ID)
    ).toEqual([])
    expect((await syncStatusService.getSnapshot(USER_ID)).totalPending).toBe(1)
    expect(
      (await syncStatusService.getSnapshot(OTHER_USER_ID)).totalPending
    ).toBe(0)
    const materialized = (
      await dictionaryContentRepository.getMaterializedContent(USER_ID, [
        WORD_ID,
      ])
    ).get(WORD_ID)
    expect(materialized).toBeDefined()
    if (!materialized) throw new Error('Missing fixture card')
    const content = parseDictionaryContent(materialized.effective.content)
    if (!content.success) throw new Error('Invalid fixture content')
    await dictionaryContentRepository.saveCardStates([
      {
        word_id: WORD_ID,
        user_id: USER_ID,
        content_version: 1,
        reference: null,
        fallback_content: content.data,
        overrides: {},
        updated_at: TIMESTAMP,
      },
    ])
    expect((await syncStatusService.getSnapshot(USER_ID)).totalPending).toBe(0)
    expect(
      await wordRepository.getWordByIdAndUserId(WORD_ID, USER_ID)
    ).toMatchObject({
      word_id: WORD_ID,
      interval_days: word.interval_days,
      repetition_count: word.repetition_count,
      easiness_factor: word.easiness_factor,
      last_reviewed_at: word.last_reviewed_at,
    })
  })

  it.each(['', '   '])(
    'saves a new private word with blank analysis notes %j',
    async notes => {
      await expect(
        wordRepository.addWord({ ...word, analysis_notes: notes })
      ).resolves.toBeUndefined()
      expect(
        (await dictionaryContentRepository.getPendingCommands(USER_ID))[0]
          .command
      ).toMatchObject({
        kind: 'create-private',
        content: { analysis_notes: null },
      })
    }
  )

  it('preserves nonblank private analysis notes and the original legacy row', async () => {
    const notes = '  Private note  '
    await wordRepository.addWord({ ...word, analysis_notes: notes })
    expect(
      (await dictionaryContentRepository.getPendingCommands(USER_ID))[0].command
    ).toMatchObject({
      kind: 'create-private',
      content: { analysis_notes: notes.trim() },
    })
    expect(
      database
        .prepare('SELECT analysis_notes FROM words WHERE word_id = ?')
        .get(WORD_ID)
    ).toMatchObject({ analysis_notes: notes })
  })
})
