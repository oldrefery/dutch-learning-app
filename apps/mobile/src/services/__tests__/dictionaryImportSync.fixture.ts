import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { createMockWord } from '@/__tests__/helpers/factories'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryImportRepository } from '@/db/dictionaryImportRepository'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import type { DictionaryImportRecovery } from '@woordenaar/domain'

export const USER = '10000000-0000-4000-8000-000000000001'
export const WORD = '20000000-0000-4000-8000-000000000001'
export const SECOND = '20000000-0000-4000-8000-000000000002'
export const ORIGINAL = '30000000-0000-4000-8000-000000000001'
export const TARGET = '30000000-0000-4000-8000-000000000002'
export const NEXT = '30000000-0000-4000-8000-000000000003'
export const OPERATION = '40000000-0000-4000-8000-000000000001'
export const REPLACEMENT = '40000000-0000-4000-8000-000000000002'
export const CANCEL = '40000000-0000-4000-8000-000000000003'
export const assertOwner = () => {}
export const WORD_SQL = 'SELECT * FROM words WHERE word_id = ?'
export const DELIVERY_SQL =
  'SELECT * FROM dictionary_import_delivery WHERE word_id = ?'
export const OUTBOX_SQL =
  'SELECT * FROM dictionary_import_recovery_outbox WHERE word_id = ?'

export function openImportFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'woordenaar-d10-sync-sqlite-'))
  const db = createTestDatabase(join(directory, 'fixture.sqlite'))
  for (const id of [ORIGINAL, TARGET, NEXT])
    db.prepare(
      `INSERT INTO collections(collection_id,user_id,name,created_at,updated_at)
     VALUES (?,?,?,'2026-10-02','2026-10-02')`
    ).run(id, USER, id)
  return {
    db,
    close: () => {
      db.close()
      rmSync(directory, { recursive: true, force: true })
    },
    async create(wordId = WORD): Promise<DictionaryImportRecovery> {
      const word = createMockWord({
        word_id: wordId,
        user_id: USER,
        dutch_lemma: `fixture-${wordId}`,
        collection_id: ORIGINAL,
        repetition_count: 7,
        interval_days: 27,
      })
      await wordRepository.addWords([word], undefined, [
        { kind: 'private-copy', content: wordToDictionaryContent(word) },
      ])
      const row = (await dictionaryImportRepository.getPending(USER)).find(
        row => row.intent.word_id === wordId
      )!
      return {
        protocol_version: 1,
        operation_id: OPERATION,
        original_intent: row.intent,
        expected_recovery_version: 0,
        expected_collection_id: ORIGINAL,
        target_collection_id: TARGET,
      }
    },
  }
}
