import type { SQLiteDatabase } from 'expo-sqlite'
import {
  parseFollowingTransferRows,
  prepareFollowingTransferRows,
  decideFollowingTransferRows,
  FOLLOWING_TRANSFER_TEXT_LIMIT,
  type FollowingTransferJournal,
  type FollowingTransferSession,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'

const UNAVAILABLE = 'Following transfer session is unavailable'
const readRows = async (db: SQLiteDatabase, userId: string) => {
  const rows = await db.getAllAsync<{
    session_id: string
    payload_json: string
  }>(
    'SELECT session_id,payload_json FROM dictionary_following_transfer_sessions WHERE user_id = ? ORDER BY sequence',
    [userId]
  )
  if (
    rows.reduce((length, row) => length + row.payload_json.length, 0) >
    FOLLOWING_TRANSFER_TEXT_LIMIT
  )
    throw new Error('Following transfer storage exceeds its limit')
  const parsed = parseFollowingTransferRows(
    rows.map(row => JSON.parse(row.payload_json) as unknown),
    userId
  )
  if (parsed.some((row, index) => row.session_id !== rows[index].session_id))
    throw new Error('Following transfer indexed identity mismatch')
  return parsed
}
const mutate = async (
  userId: string,
  sessionId: string,
  assertOwner: () => void,
  change: (rows: FollowingTransferSession[]) => FollowingTransferSession[]
) => {
  let saved: FollowingTransferSession | undefined
  const db = await getDatabase()
  await db.withExclusiveTransactionAsync(async transaction => {
    assertOwner()
    const rows = await readRows(transaction, userId)
    const next = change(rows)
    saved = next.find(row => row.session_id === sessionId)
    if (!saved) throw new Error(UNAVAILABLE)
    await transaction.runAsync(
      `INSERT INTO dictionary_following_transfer_sessions(user_id,session_id,payload_json) VALUES (?,?,?)
       ON CONFLICT(user_id,session_id) DO UPDATE SET payload_json = excluded.payload_json`,
      userId,
      sessionId,
      JSON.stringify(saved)
    )
    assertOwner()
  })
  if (!saved) throw new Error(UNAVAILABLE)
  return saved
}
export const dictionaryFollowingTransferRepository: FollowingTransferJournal = {
  async list(userId) {
    return readRows(await getDatabase(), userId)
  },
  prepare: (value, assertOwner) =>
    mutate(value.user_id, value.session_id, assertOwner, rows =>
      prepareFollowingTransferRows(rows, value)
    ),
  decide: (expected, revisions, createId, assertOwner) =>
    mutate(expected.user_id, expected.session_id, assertOwner, rows =>
      decideFollowingTransferRows(rows, expected, revisions, createId)
    ),
}
