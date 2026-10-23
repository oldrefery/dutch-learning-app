import {
  matchDictionaryAnalysisResponse,
  parseDictionaryAnalysisClientOperation,
  requireSameAnalysisOperation,
  requireDictionaryAnalysisNextAttempt,
  isDictionaryAnalysisTerminal,
  DICTIONARY_ANALYSIS_HISTORY_LIMIT,
  type DictionaryAnalysisClientOperation,
  type DictionaryAnalysisAttemptJournal,
} from '@woordenaar/domain'
import { getDatabase } from './initDB'

type Database = Awaited<ReturnType<typeof getDatabase>>
const read = async (db: Database, userId: string, wordId: string) => {
  const row = await db.getFirstAsync<{
    operation_id: string
    operation_json: string
  }>(
    'SELECT operation_id, operation_json FROM dictionary_analysis_client_operations WHERE user_id = ? AND word_id = ?',
    [userId, wordId]
  )
  if (!row) return null
  const operation = parseDictionaryAnalysisClientOperation(
    JSON.parse(row.operation_json) as unknown
  )
  if (
    operation.user_id !== userId ||
    operation.word_id !== wordId ||
    operation.command.operation_id !== row.operation_id
  )
    throw new Error('Local shared analysis owner mismatch')
  return operation
}
const write = async (
  db: Database,
  operation: DictionaryAnalysisClientOperation
) => {
  const result = await db.runAsync(
    'UPDATE dictionary_analysis_client_operations SET operation_json = ? WHERE user_id = ? AND word_id = ? AND operation_id = ?',
    JSON.stringify(operation),
    operation.user_id,
    operation.word_id,
    operation.command.operation_id
  )
  if (result.changes !== 1)
    throw new Error('Local shared analysis operation changed')
}
const assertHead = async (
  db: Database,
  operation: DictionaryAnalysisClientOperation
) => {
  const card = await db.getFirstAsync<{ card_json: string }>(
    `SELECT cards.card_json FROM dictionary_effective_card_cache cards JOIN words ON words.word_id = cards.word_id AND words.user_id = cards.user_id
     WHERE cards.user_id = ? AND cards.word_id = ? AND words.deleted_at IS NULL AND cards.mode = 'follow'`,
    [operation.user_id, operation.word_id]
  )
  const cached: unknown = card ? JSON.parse(card.card_json) : null
  if (
    !cached ||
    typeof cached !== 'object' ||
    !('mode' in cached) ||
    cached.mode !== 'follow' ||
    !('word_id' in cached) ||
    cached.word_id !== operation.word_id ||
    !('reference' in cached) ||
    !cached.reference ||
    typeof cached.reference !== 'object' ||
    !('entry_id' in cached.reference) ||
    cached.reference.entry_id !== operation.command.entry_id ||
    !('revision_id' in cached.reference) ||
    cached.reference.revision_id !== operation.command.expected_revision_id ||
    !('head_sequence' in cached) ||
    cached.head_sequence !== operation.command.expected_head_sequence
  )
    throw new Error('Sync shared dictionary content before requesting analysis')
}
const mutate = async (
  expected: DictionaryAnalysisClientOperation,
  assertOwner: () => void,
  change: (
    current: DictionaryAnalysisClientOperation,
    tx: Database
  ) =>
    | DictionaryAnalysisClientOperation
    | Promise<DictionaryAnalysisClientOperation>
) => {
  const db = await getDatabase()
  let saved = expected
  await db.withExclusiveTransactionAsync(async tx => {
    assertOwner()
    const current = requireSameAnalysisOperation(
      await read(tx, expected.user_id, expected.word_id),
      expected
    )
    saved = await change(current, tx)
    await write(tx, saved)
    assertOwner()
  })
  return saved
}
export const dictionaryAnalysisRepository: DictionaryAnalysisAttemptJournal = {
  async history(userId, wordId) {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{
      word_id: string
      operation_id: string
      operation_json: string
    }>(
      'SELECT word_id, operation_id, operation_json FROM dictionary_analysis_client_history WHERE user_id = ? AND word_id = ? ORDER BY archive_sequence DESC LIMIT ?',
      [userId, wordId, DICTIONARY_ANALYSIS_HISTORY_LIMIT + 1]
    )
    if (rows.length > DICTIONARY_ANALYSIS_HISTORY_LIMIT)
      throw new Error('Shared analysis history exceeds its limit')
    return rows.map(row => {
      const operation = parseDictionaryAnalysisClientOperation(
        JSON.parse(row.operation_json)
      )
      if (
        operation.user_id !== userId ||
        operation.word_id !== wordId ||
        row.word_id !== wordId ||
        operation.command.operation_id !== row.operation_id ||
        !operation.submitted ||
        !isDictionaryAnalysisTerminal(operation.response)
      )
        throw new Error('Invalid archived shared analysis')
      return operation
    })
  },
  async replace(expected, value, assertOwner) {
    const db = await getDatabase()
    let saved = value
    await db.withExclusiveTransactionAsync(async tx => {
      assertOwner()
      const current = await read(tx, expected.user_id, expected.word_id)
      saved = requireDictionaryAnalysisNextAttempt(current, expected, value)
      const count = await tx.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM dictionary_analysis_client_history WHERE user_id = ?',
        [saved.user_id]
      )
      if (!count || count.count >= DICTIONARY_ANALYSIS_HISTORY_LIMIT)
        throw new Error('Shared analysis history exceeds its limit')
      const reused = await tx.getFirstAsync<{ operation_id: string }>(
        'SELECT operation_id FROM dictionary_analysis_client_history WHERE user_id = ? AND operation_id = ? UNION ALL SELECT operation_id FROM dictionary_analysis_client_operations WHERE user_id = ? AND operation_id = ?',
        [
          saved.user_id,
          saved.command.operation_id,
          saved.user_id,
          saved.command.operation_id,
        ]
      )
      if (reused)
        throw new Error('Shared analysis operation ID is already reserved')
      await assertHead(tx, saved)
      assertOwner()
      await tx.runAsync(
        'INSERT INTO dictionary_analysis_client_history(user_id,word_id,operation_id,operation_json) VALUES (?, ?, ?, ?)',
        expected.user_id,
        expected.word_id,
        expected.command.operation_id,
        JSON.stringify(current)
      )
      const result = await tx.runAsync(
        'UPDATE dictionary_analysis_client_operations SET operation_id = ?, operation_json = ? WHERE user_id = ? AND word_id = ? AND operation_id = ?',
        saved.command.operation_id,
        JSON.stringify(saved),
        expected.user_id,
        expected.word_id,
        expected.command.operation_id
      )
      if (result.changes !== 1)
        throw new Error('Local shared analysis operation changed')
      assertOwner()
    })
    return saved
  },
  async read(userId, wordId) {
    return read(await getDatabase(), userId, wordId)
  },
  async prepare(value, assertOwner) {
    const operation = parseDictionaryAnalysisClientOperation(value)
    if (operation.submitted || operation.response !== null)
      throw new Error('Expected a fresh shared analysis intent')
    const db = await getDatabase()
    let saved = operation
    await db.withExclusiveTransactionAsync(async tx => {
      assertOwner()
      const previous = await read(tx, operation.user_id, operation.word_id)
      if (previous) {
        saved = previous
        assertOwner()
        return
      }
      const archived = await tx.getFirstAsync<{ operation_id: string }>(
        'SELECT operation_id FROM dictionary_analysis_client_history WHERE user_id = ? AND operation_id = ?',
        [operation.user_id, operation.command.operation_id]
      )
      if (archived)
        throw new Error('Shared analysis operation ID is already reserved')
      await assertHead(tx, operation)
      await tx.runAsync(
        'INSERT INTO dictionary_analysis_client_operations(user_id,word_id,operation_id,operation_json) VALUES (?, ?, ?, ?)',
        operation.user_id,
        operation.word_id,
        operation.command.operation_id,
        JSON.stringify(operation)
      )
      assertOwner()
    })
    return saved
  },
  async claim(operation, assertOwner) {
    let claimed = false
    await mutate(operation, assertOwner, async (current, tx) => {
      if (current.submitted) return current
      await assertHead(tx, current)
      claimed = true
      return { ...current, submitted: true }
    })
    return claimed
  },
  async save(operation, response, assertOwner) {
    return mutate(operation, assertOwner, current => {
      if (!current.submitted)
        throw new Error('Shared analysis was not submitted')
      return {
        ...current,
        response: matchDictionaryAnalysisResponse(
          current.command,
          response,
          current.response
        ),
      }
    })
  },
}
