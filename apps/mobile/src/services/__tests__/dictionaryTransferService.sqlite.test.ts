import type { DatabaseSync } from 'node:sqlite'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { exportOfflineDictionaryCollection } from '../dictionaryTransferService'
import {
  getStarterPackPreview,
  loadOfficialDutchA1Pack,
} from '../starterPackService'
import type { Word } from '@/types/database'
import { parseDictionaryCollectionExport } from '@woordenaar/domain'

jest.mock('@/db/initDB')
jest.mock('@/lib/sentry')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))

const owner = '10000000-0000-4000-8000-000000000001'
const other = '20000000-0000-4000-8000-000000000001'
const collection = '30000000-0000-4000-8000-000000000001'
const at = '2026-10-02T06:00:00.000Z'
const word: Word = {
  ...getStarterPackPreview(loadOfficialDutchA1Pack()).words[0],
  word_id: '40000000-0000-4000-8000-000000000001',
  user_id: owner,
  collection_id: collection,
  interval_days: 34,
  repetition_count: 8,
  easiness_factor: 2.9,
  next_review_date: '2026-11-10',
  last_reviewed_at: at,
}

describe('offline self-contained dictionary export in SQLite', () => {
  let database: DatabaseSync
  beforeEach(async () => {
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValue({ currentUserId: owner } as never)
    database = createTestDatabase()
    database
      .prepare(
        'INSERT INTO collections(collection_id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(collection, owner, 'Owned offline content', at, at)
    await wordRepository.addWord(word)
    await wordRepository.addWord({
      ...word,
      word_id: '50000000-0000-4000-8000-000000000001',
      user_id: other,
      collection_id: '60000000-0000-4000-8000-000000000001',
      translations: { en: ['hidden other owner'] },
    })
  })
  afterEach(() => database.close())

  it('exports only owned effective content and leaves SRS and queues unchanged', async () => {
    const before = database
      .prepare('SELECT * FROM dictionary_content_commands ORDER BY sequence')
      .all()
    const document = await exportOfflineDictionaryCollection(collection)
    expect(parseDictionaryCollectionExport(document)).toEqual(document)
    expect(document.entries).toHaveLength(1)
    expect(document.entries[0].content.translations).toMatchObject(
      word.translations
    )
    for (const key of [
      'word_id',
      'user_id',
      'interval_days',
      'repetition_count',
      'next_review_date',
      'reference',
    ]) {
      expect(document.entries[0]).not.toHaveProperty(key)
      expect(document.entries[0].content).not.toHaveProperty(key)
    }
    expect(JSON.stringify(document)).not.toContain('hidden other owner')
    expect(
      database
        .prepare('SELECT * FROM dictionary_content_commands ORDER BY sequence')
        .all()
    ).toEqual(before)
    expect(
      database
        .prepare(
          'SELECT interval_days, repetition_count FROM words WHERE word_id = ?'
        )
        .get(word.word_id)
    ).toEqual({ interval_days: 34, repetition_count: 8 })
  })

  it('requires the complete pinned dependency and includes private media overrides', async () => {
    const reference = {
      entry_id: '70000000-0000-4000-8000-000000000001',
      revision_id: '80000000-0000-4000-8000-000000000001',
    }
    database
      .prepare(
        'UPDATE dictionary_card_content SET entry_id = ?, revision_id = ?, fallback_content_json = NULL WHERE word_id = ?'
      )
      .run(reference.entry_id, reference.revision_id, word.word_id)
    await expect(exportOfflineDictionaryCollection(collection)).rejects.toThrow(
      'incomplete'
    )
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
    await wordRepository.updateWordImage(
      word.word_id,
      owner,
      'https://example.invalid/owned-private.jpg'
    )
    const document = await exportOfflineDictionaryCollection(collection)
    expect(document.entries[0].content.image_url).toBe(
      'https://example.invalid/owned-private.jpg'
    )
    expect(JSON.stringify(document)).not.toContain(reference.revision_id)
  })

  it('rejects another collection and account changes', async () => {
    await expect(exportOfflineDictionaryCollection('foreign')).rejects.toThrow(
      'access denied'
    )
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValueOnce({ currentUserId: owner } as never)
      .mockReturnValue({ currentUserId: other } as never)
    await expect(exportOfflineDictionaryCollection(collection)).rejects.toThrow(
      'account changed'
    )
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValue({ currentUserId: null } as never)
    await expect(exportOfflineDictionaryCollection(collection)).rejects.toThrow(
      'Authentication'
    )
  })
})
