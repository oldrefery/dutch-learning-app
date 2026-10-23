import type { SQLiteDatabase } from 'expo-sqlite'
import {
  followingImportRoot,
  parseFollowingImportRows,
  prepareFollowingImportRows,
  saveFollowingImportRows,
  FOLLOWING_IMPORT_JOURNAL_TEXT_LIMIT,
  type FollowingImportJournal,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'

const UNAVAILABLE = 'Following import operation is unavailable'
const readRows = async (db: SQLiteDatabase, userId: string) => {
  const rows = await db.getAllAsync<{
    operation_id: string
    word_id: string
    payload_json: string
  }>(
    'SELECT operation_id,word_id,payload_json FROM dictionary_following_import_journal WHERE user_id = ? ORDER BY sequence',
    [userId]
  )
  const parsed = parseFollowingImportRows(
    rows.map(row => JSON.parse(row.payload_json) as unknown),
    userId
  )
  if (
    parsed.some(
      (row, index) =>
        row.request.operation_id !== rows[index].operation_id ||
        followingImportRoot(row).word_id !== rows[index].word_id
    )
  )
    throw new Error('Following import indexed identity mismatch')
  return parsed
}
const requireCapacity = (rows: FollowingImportOperation[]) => {
  if (JSON.stringify(rows).length > FOLLOWING_IMPORT_JOURNAL_TEXT_LIMIT)
    throw new Error('Following import journal exceeds its limit')
}

export const dictionaryFollowingImportRepository: FollowingImportJournal = {
  async list(userId) {
    return readRows(await getDatabase(), userId)
  },
  async prepare(value, assertOwner) {
    let saved: FollowingImportOperation | undefined
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const rows = await readRows(transaction, value.user_id)
      const next = prepareFollowingImportRows(rows, value)
      requireCapacity(next)
      saved = next.find(
        row => row.request.operation_id === value.request.operation_id
      )
      if (!saved) throw new Error(UNAVAILABLE)
      if (next.length !== rows.length) {
        const root = followingImportRoot(saved)
        const legacy = await transaction.getFirstAsync<{ word_id: string }>(
          `SELECT word_id FROM dictionary_import_delivery WHERE user_id = ? AND
            (word_id = ? OR json_extract(original_intent_json, '$.operation_id') = ?)
           UNION ALL SELECT word_id FROM dictionary_import_recovery_outbox WHERE user_id = ? AND operation_id = ?
           UNION ALL SELECT word_id FROM words WHERE user_id = ? AND word_id = ? AND ? = 'import' LIMIT 1`,
          [
            saved.user_id,
            root.word_id,
            saved.request.operation_id,
            saved.user_id,
            saved.request.operation_id,
            saved.user_id,
            root.word_id,
            saved.kind,
          ]
        )
        if (legacy)
          throw new Error('Personal import identity is already reserved')
        await transaction.runAsync(
          'INSERT INTO dictionary_following_import_journal(user_id,operation_id,word_id,payload_json) VALUES (?,?,?,?)',
          saved.user_id,
          saved.request.operation_id,
          root.word_id,
          JSON.stringify(saved)
        )
      }
      assertOwner()
    })
    if (!saved) throw new Error(UNAVAILABLE)
    return saved
  },
  async save(expected, value, assertOwner) {
    let saved: FollowingImportOperation | undefined
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      assertOwner()
      const rows = await readRows(transaction, expected.user_id)
      const next = saveFollowingImportRows(rows, expected, value)
      requireCapacity(next)
      saved = next.find(
        row => row.request.operation_id === expected.request.operation_id
      )
      await transaction.runAsync(
        'UPDATE dictionary_following_import_journal SET payload_json = ? WHERE user_id = ? AND operation_id = ?',
        JSON.stringify(saved),
        expected.user_id,
        expected.request.operation_id
      )
      assertOwner()
    })
    if (!saved) throw new Error(UNAVAILABLE)
    return saved
  },
}
