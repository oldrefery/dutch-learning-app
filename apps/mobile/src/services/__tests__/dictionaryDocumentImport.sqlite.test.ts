import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { createMockWord } from '@/__tests__/helpers/factories'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryImportRepository } from '@/db/dictionaryImportRepository'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { ExpressionType } from '@/types/ExpressionTypes'
import {
  exportOfflineDictionaryCollection,
  importOfflineDictionaryCollection,
  previewDictionaryTransfer,
  parseDictionaryTransferText,
  MAX_DICTIONARY_TRANSFER_TEXT_LENGTH,
} from '../dictionaryTransferService'

jest.mock('@/db/initDB')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: jest.fn(() => true),
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))

const OWNER = '10000000-0000-4000-8000-000000000001'
const RECIPIENT = '10000000-0000-4000-8000-000000000002'
const SOURCE = '20000000-0000-4000-8000-000000000001'
const TARGET = '20000000-0000-4000-8000-000000000002'
const AT = '2026-10-02T08:00:00.000Z'
const WORDS_SQL = 'SELECT * FROM words ORDER BY word_id'
const CONTENT_SQL =
  'SELECT * FROM dictionary_content_commands ORDER BY sequence'
const INTENTS_SQL = 'SELECT * FROM dictionary_import_intents ORDER BY sequence'
const sourceWord = createMockWord({
  word_id: '30000000-0000-4000-8000-000000000001',
  user_id: OWNER,
  collection_id: SOURCE,
  dutch_lemma: 'op losse schroeven staan',
  part_of_speech: 'expression',
  article: null,
  is_expression: true,
  expression_type: ExpressionType.PHRASE,
  interval_days: 42,
  repetition_count: 9,
  easiness_factor: 3.1,
  last_reviewed_at: AT,
  usage_notes: {
    summary: 'Private summary',
    contrasts: [
      {
        term: 'losstaan',
        distinction: 'Private contrast',
        example: {
          nl: 'Het plan staat op losse schroeven.',
          en: 'The plan is uncertain.',
          ru: 'План под вопросом.',
        },
      },
    ],
  },
  conjugation: {
    present: 'staat',
    simple_past: 'stond',
    simple_past_plural: 'stonden',
    past_participle: 'gestaan',
  },
  image_url: 'https://example.invalid/private.jpg',
  tts_url: 'https://example.invalid/private.mp3',
})
const content = wordToDictionaryContent(sourceWord)
const documentText = (entries = [content]) =>
  JSON.stringify({
    schema_version: 1,
    collection: { name: 'Private content' },
    entries: entries.map(item => ({ content: item })),
  })

describe('self-contained dictionary document reimport', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let activeOwner: string | null
  const snapshot = () => ({
    words: db.prepare(WORDS_SQL).all(),
    content: db.prepare(CONTENT_SQL).all(),
    intents: db.prepare(INTENTS_SQL).all(),
    learning: db.prepare('SELECT * FROM learning_commands').all(),
  })
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'woordenaar-d10-document-'))
    path = join(directory, 'cards.sqlite')
    db = createTestDatabase(path)
    activeOwner = OWNER
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
    jest
      .mocked(useApplicationStore.getState)
      .mockImplementation(() => ({ currentUserId: activeOwner }) as never)
    const insert = db.prepare(
      'INSERT INTO collections(collection_id,user_id,name,created_at,updated_at,sync_status) VALUES (?,?,?,?,?,?)'
    )
    insert.run(SOURCE, OWNER, 'Original', AT, AT, 'synced')
    insert.run(TARGET, RECIPIENT, 'Recipient target', AT, AT, 'synced')
    await wordRepository.addWord(sourceWord)
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('reimports full effective content for another owner without source access, with fresh IDs and durable private queues', async () => {
    const exported = await exportOfflineDictionaryCollection(SOURCE)
    expect(exported.entries[0].content).toEqual(content)
    const old = snapshot()
    activeOwner = RECIPIENT
    const text = JSON.stringify(exported)
    const preview = previewDictionaryTransfer(text)
    expect(preview.words[0].word_id).toBe('0')
    expect(preview.words[0]).not.toHaveProperty('user_id')
    expect(preview.words[0]).not.toHaveProperty('repetition_count')
    expect(
      await importOfflineDictionaryCollection(text, TARGET, ['0'], RECIPIENT)
    ).toEqual({ importedCount: 1, skippedCount: 0 })
    const [copy] = await wordRepository.getWordsByUserId(RECIPIENT)
    expect(copy.word_id).not.toBe(sourceWord.word_id)
    expect(copy).toMatchObject({
      user_id: RECIPIENT,
      collection_id: TARGET,
      interval_days: 0,
      repetition_count: 0,
      easiness_factor: 2.5,
      last_reviewed_at: null,
    })
    expect(wordToDictionaryContent(copy)).toEqual(content)
    expect(
      db.prepare('SELECT * FROM words WHERE user_id = ?').all(OWNER)
    ).toEqual(old.words)
    const [pending] = await dictionaryImportRepository.getPending(RECIPIENT)
    expect(pending.intent).toMatchObject({
      word_id: copy.word_id,
      collection_id: TARGET,
      source: { kind: 'private-copy', content },
    })
    expect(pending.intent.source).not.toHaveProperty('reference')
    db.close()
    db = createTestDatabase(path, false)
    expect(await dictionaryImportRepository.getPending(RECIPIENT)).toEqual([
      pending,
    ])
    // The recipient can export and replay after the original owner's content disappears.
    db.prepare('DELETE FROM dictionary_content_commands WHERE user_id = ?').run(
      OWNER
    )
    db.prepare('DELETE FROM dictionary_card_content WHERE user_id = ?').run(
      OWNER
    )
    db.prepare('DELETE FROM words WHERE user_id = ?').run(OWNER)
    expect((await exportOfflineDictionaryCollection(TARGET)).entries).toEqual(
      exported.entries
    )
    expect(await dictionaryImportRepository.getPending(RECIPIENT)).toEqual([
      pending,
    ])
  })

  it('skips active duplicates in any collection and within a document without moving cards or changing SRS/queues', async () => {
    db.exec(
      `INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at) VALUES ('queued-reset','reset','${OWNER}','${sourceWord.word_id}','${AT}')`
    )
    const before = snapshot()
    const text = documentText([
      content,
      { ...content, dutch_lemma: 'een nieuw woord' },
      { ...content, dutch_lemma: 'een nieuw woord' },
    ])
    const result = await importOfflineDictionaryCollection(
      text,
      SOURCE,
      ['0', '1', '2'],
      OWNER
    )
    expect(result).toEqual({ importedCount: 1, skippedCount: 2 })
    expect(
      db
        .prepare('SELECT * FROM words WHERE word_id = ?')
        .get(sourceWord.word_id)
    ).toEqual(before.words[0])
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual(
      before.learning
    )
    expect(db.prepare(CONTENT_SQL).all()[0]).toEqual(before.content[0])
    expect(
      await importOfflineDictionaryCollection(text, SOURCE, ['1'], OWNER)
    ).toEqual({ importedCount: 0, skippedCount: 1 })
    expect(await dictionaryImportRepository.getPending(OWNER)).toHaveLength(1)
  })

  it('imports only selected entries and ignores tombstoned duplicates without resurrecting them', async () => {
    db.prepare(
      'UPDATE words SET deleted_at = ?, sync_status = ? WHERE word_id = ?'
    ).run(AT, 'deleted', sourceWord.word_id)
    const deleted = snapshot()
    const text = documentText([
      content,
      { ...content, dutch_lemma: 'not selected' },
    ])
    expect(
      await importOfflineDictionaryCollection(text, SOURCE, ['0'], OWNER)
    ).toEqual({ importedCount: 1, skippedCount: 0 })
    const owned = await wordRepository.getWordsByUserId(OWNER)
    expect(owned).toHaveLength(1)
    expect(owned[0].word_id).not.toBe(sourceWord.word_id)
    expect(
      db
        .prepare('SELECT * FROM words WHERE word_id = ?')
        .get(sourceWord.word_id)
    ).toEqual(deleted.words[0])
  })

  it('rolls back cards and both queues when persistence fails partway through a batch', async () => {
    activeOwner = RECIPIENT
    const before = snapshot()
    db.exec(
      `CREATE TRIGGER fail_second_import BEFORE INSERT ON dictionary_import_intents WHEN (SELECT COUNT(*) FROM dictionary_import_intents) > 0 BEGIN SELECT RAISE(ABORT, 'synthetic persistence failure'); END`
    )
    const text = documentText([content, { ...content, dutch_lemma: 'second' }])
    await expect(
      importOfflineDictionaryCollection(text, TARGET, ['0', '1'], RECIPIENT)
    ).rejects.toThrow('synthetic persistence failure')
    expect(snapshot()).toEqual(before)
  })

  it('rolls back when the active owner changes during the transaction', async () => {
    activeOwner = RECIPIENT
    const before = snapshot()
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValueOnce({ currentUserId: RECIPIENT } as never)
      .mockReturnValueOnce({ currentUserId: RECIPIENT } as never)
      .mockReturnValueOnce({ currentUserId: OWNER } as never)
    await expect(
      importOfflineDictionaryCollection(
        documentText(),
        TARGET,
        ['0'],
        RECIPIENT
      )
    ).rejects.toThrow('account changed')
    expect(snapshot()).toEqual(before)
  })

  it('requires an active owned target, but does not require collection write access', async () => {
    const before = snapshot()
    await expect(
      importOfflineDictionaryCollection(documentText(), TARGET, ['0'], OWNER)
    ).rejects.toThrow('access denied')
    db.prepare(
      "UPDATE collections SET sync_status = 'deleted' WHERE collection_id = ?"
    ).run(SOURCE)
    await expect(
      importOfflineDictionaryCollection(documentText(), SOURCE, ['0'], OWNER)
    ).rejects.toThrow('access denied')
    expect(snapshot()).toEqual(before)
    db.prepare(
      "UPDATE collections SET sync_status = 'synced' WHERE collection_id = ?"
    ).run(SOURCE)
    activeOwner = RECIPIENT
    jest.mocked(useApplicationStore.getState).mockImplementation(
      () =>
        ({
          currentUserId: activeOwner,
          userAccessLevel: 'read_only',
        }) as never
    )
    const targetBefore = db
      .prepare('SELECT * FROM collections WHERE collection_id = ?')
      .get(TARGET)
    expect(
      await importOfflineDictionaryCollection(
        documentText(),
        TARGET,
        ['0'],
        RECIPIENT
      )
    ).toEqual({ importedCount: 1, skippedCount: 0 })
    expect(
      db
        .prepare('SELECT * FROM collections WHERE collection_id = ?')
        .get(TARGET)
    ).toEqual(targetBefore)
  })

  it.each(
    [[], ['1'], ['-1'], ['00'], ['0', '0'], ['word-id']].map(ids => ({ ids }))
  )('rejects invalid selections %j before any mutation', async ({ ids }) => {
    const before = snapshot()
    await expect(
      importOfflineDictionaryCollection(documentText(), SOURCE, ids, OWNER)
    ).rejects.toThrow('valid document entries')
    expect(snapshot()).toEqual(before)
  })

  it('rejects malformed, future, reference-dependent and learning-state documents', () => {
    const base = JSON.parse(documentText()) as {
      schema_version: number
      entries: object[]
    }
    for (const input of [
      '{',
      JSON.stringify({ ...base, schema_version: 2 }),
      JSON.stringify({
        ...base,
        entries: [{ content, reference: { revision_id: 'private' } }],
      }),
      JSON.stringify({
        ...base,
        entries: [{ content: { ...content, repetition_count: 9 } }],
      }),
    ])
      expect(() => parseDictionaryTransferText(input)).toThrow(
        'Invalid dictionary'
      )
    expect(() =>
      parseDictionaryTransferText(
        ' '.repeat(MAX_DICTIONARY_TRANSFER_TEXT_LENGTH + 1)
      )
    ).toThrow('too large')
    expect(() =>
      previewDictionaryTransfer(
        documentText([{ ...content, expression_type: 'future-expression' }])
      )
    ).toThrow('not supported')
  })

  it('does not import when dormant or signed out', async () => {
    const before = snapshot()
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(false)
    await expect(
      importOfflineDictionaryCollection(documentText(), SOURCE, ['0'], OWNER)
    ).rejects.toThrow('unavailable')
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
    activeOwner = null
    await expect(
      importOfflineDictionaryCollection(documentText(), SOURCE, ['0'], OWNER)
    ).rejects.toThrow('account changed')
    expect(snapshot()).toEqual(before)
  })
})
