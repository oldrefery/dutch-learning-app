import type { SQLiteDatabase } from 'expo-sqlite'
import {
  assertCreationJournalOwner,
  claimCreationJournalRows,
  parseCreationJournalRows,
  prepareCreationJournalRows,
  saveCreationJournalRows,
  type DictionaryCreationJournal,
  type DictionaryCreationJournalOwner,
  type DictionaryCreationJournalRow,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'

const readRows = async (db: SQLiteDatabase, userId: string) => {
  const indexed = await db.getAllAsync<{
    resolution_id: string
    operation_id: string | null
    payload_json: string
  }>(
    'SELECT resolution_id,operation_id,payload_json FROM dictionary_creation_client_journal WHERE user_id = ? ORDER BY sequence',
    [userId]
  )
  const rows = parseCreationJournalRows(
    indexed.map(row => JSON.parse(row.payload_json) as unknown),
    userId
  )
  if (
    rows.some(
      (row, i) =>
        row.session.request.resolution_id !== indexed[i].resolution_id ||
        (row.session.command?.operation_id ?? null) !== indexed[i].operation_id
    )
  )
    throw new Error('Creation journal indexed identity mismatch')
  return rows
}
type Change<T> = (rows: DictionaryCreationJournalRow[]) => {
  rows: DictionaryCreationJournalRow[]
  result: T
}
const access = async <T>(
  userId: string,
  owner: DictionaryCreationJournalOwner,
  change: Change<T>
): Promise<T> => {
  assertCreationJournalOwner(userId, owner)
  await owner.check()
  assertCreationJournalOwner(userId, owner)
  const db = await getDatabase()
  let result!: T
  await db.withExclusiveTransactionAsync(async tx => {
    assertCreationJournalOwner(userId, owner)
    const before = await readRows(tx, userId)
    assertCreationJournalOwner(userId, owner)
    const next = change(before)
    for (const row of next.rows) {
      const old = before.find(
        saved =>
          saved.session.request.resolution_id ===
          row.session.request.resolution_id
      )
      if (JSON.stringify(old) === JSON.stringify(row)) continue
      assertCreationJournalOwner(userId, owner)
      await tx.runAsync(
        `INSERT INTO dictionary_creation_client_journal(user_id,resolution_id,operation_id,payload_json) VALUES (?,?,?,?)
         ON CONFLICT(user_id,resolution_id) DO UPDATE SET operation_id=excluded.operation_id,payload_json=excluded.payload_json`,
        userId,
        row.session.request.resolution_id,
        row.session.command?.operation_id ?? null,
        JSON.stringify(row)
      )
      assertCreationJournalOwner(userId, owner)
    }
    result = next.result
    assertCreationJournalOwner(userId, owner)
  })
  assertCreationJournalOwner(userId, owner)
  return result
}
const savedRow = (rows: DictionaryCreationJournalRow[], id: string) => {
  const row = rows.find(value => value.session.request.resolution_id === id)
  if (!row) throw new Error('Creation journal request is unavailable')
  return row
}
export const dictionaryCreationRepository: DictionaryCreationJournal = {
  list: (userId, owner) =>
    access(userId, owner, rows => ({ rows, result: rows })),
  read: (userId, id, owner) =>
    access(userId, owner, rows => ({
      rows,
      result:
        rows.find(row => row.session.request.resolution_id === id) ?? null,
    })),
  prepare: (value, owner) =>
    access(value.session.user_id, owner, rows => {
      const next = prepareCreationJournalRows(rows, value)
      return {
        rows: next,
        result: savedRow(next, value.session.request.resolution_id),
      }
    }),
  save: (expected, value, owner) =>
    access(expected.session.user_id, owner, rows => {
      const next = saveCreationJournalRows(rows, expected, value)
      return {
        rows: next,
        result: savedRow(next, expected.session.request.resolution_id),
      }
    }),
  claim: (expected, owner) =>
    access(expected.session.user_id, owner, rows => {
      const { rows: next, ...result } = claimCreationJournalRows(rows, expected)
      return { rows: next, result }
    }),
  claimAdoption: (expected, owner) =>
    access(expected.session.user_id, owner, rows => {
      const { rows: next, ...result } = claimCreationJournalRows(
        rows,
        expected,
        true
      )
      return { rows: next, result }
    }),
}
