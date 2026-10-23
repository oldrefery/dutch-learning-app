import {
  matchDictionaryAnalysisResponse,
  parseDictionaryAnalysisClientOperation,
  requireSameAnalysisOperation,
  requireDictionaryAnalysisNextAttempt,
  isDictionaryAnalysisTerminal,
  type DictionaryAnalysisAttemptJournal,
  type DictionaryAnalysisClientOperation,
} from '@woordenaar/domain'

const PREFIX = 'dictionary-analysis-v2:'
const MAX_OPERATIONS = 100
const MAX_BYTES = 256_000
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

type ExclusiveLock = <T>(name: string, action: () => Promise<T>) => Promise<T>

/** Metadata only. All writers for an owner use one exclusive browser lock.
 * No unlocked fallback, automatic eviction or clear; explicit replacement retains terminal history. */
export function createBrowserDictionaryAnalysisJournal(ports: {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  withLock: ExclusiveLock
  assertHead(operation: DictionaryAnalysisClientOperation): Promise<void>
}): DictionaryAnalysisAttemptJournal {
  const key = (userId: string) => {
    if (!UUID.test(userId)) throw new Error('Invalid shared analysis owner')
    return `${PREFIX}${userId}`
  }
  const readAll = (
    userId: string
  ): {
    rows: DictionaryAnalysisClientOperation[]
    archived: DictionaryAnalysisClientOperation[]
  } => {
    const raw = ports.storage.getItem(key(userId))
    if (raw === null) return { rows: [], archived: [] }
    if (raw.length > MAX_BYTES)
      throw new Error('Shared analysis journal exceeds its limit')
    const values: unknown = JSON.parse(raw)
    let active: unknown = values
    let history: unknown = []
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      const envelope = values as Record<string, unknown>
      if (Object.keys(envelope).length !== 3 || envelope.protocol_version !== 3)
        throw new Error('Invalid shared analysis journal')
      active = envelope.active
      history = envelope.archived
    }
    if (
      !Array.isArray(active) ||
      !Array.isArray(history) ||
      active.length + history.length > MAX_OPERATIONS
    )
      throw new Error('Invalid shared analysis journal')
    const rows = active.map(parseDictionaryAnalysisClientOperation)
    const archived = history.map(parseDictionaryAnalysisClientOperation)
    const all = [...rows, ...archived]
    if (
      all.some(row => row.user_id !== userId) ||
      new Set(rows.map(row => row.word_id)).size !== rows.length ||
      new Set(all.map(row => row.command.operation_id)).size !== all.length ||
      archived.some(
        row => !row.submitted || !isDictionaryAnalysisTerminal(row.response)
      )
    )
      throw new Error('Shared analysis journal identity mismatch')
    return { rows, archived }
  }
  const writeAll = (
    userId: string,
    state: {
      rows: DictionaryAnalysisClientOperation[]
      archived: DictionaryAnalysisClientOperation[]
    },
    assertOwner: () => void
  ) => {
    // One key stores active + history atomically. Old array readers fail closed
    // after the first archive; reads of a legacy array never mutate it.
    const raw = JSON.stringify(
      state.archived.length
        ? { protocol_version: 3, active: state.rows, archived: state.archived }
        : state.rows
    )
    if (
      state.rows.length + state.archived.length > MAX_OPERATIONS ||
      raw.length > MAX_BYTES
    )
      throw new Error('Shared analysis journal exceeds its limit')
    assertOwner()
    ports.storage.setItem(key(userId), raw)
    assertOwner()
  }
  const mutate = async (
    expected: DictionaryAnalysisClientOperation,
    assertOwner: () => void,
    change: (
      current: DictionaryAnalysisClientOperation
    ) => Promise<DictionaryAnalysisClientOperation>
  ) =>
    ports.withLock(key(expected.user_id), async () => {
      assertOwner()
      const state = readAll(expected.user_id)
      const { rows } = state
      const current = requireSameAnalysisOperation(
        rows.find(row => row.word_id === expected.word_id) ?? null,
        expected
      )
      const saved = await change(current)
      writeAll(
        expected.user_id,
        {
          ...state,
          rows: rows.map(row => (row.word_id === saved.word_id ? saved : row)),
        },
        assertOwner
      )
      return saved
    })
  return {
    async history(userId, wordId) {
      return readAll(userId)
        .archived.filter(row => row.word_id === wordId)
        .reverse()
    },
    async replace(expected, value, assertOwner) {
      return ports.withLock(key(expected.user_id), async () => {
        assertOwner()
        const state = readAll(expected.user_id)
        const current =
          state.rows.find(row => row.word_id === expected.word_id) ?? null
        const saved = requireDictionaryAnalysisNextAttempt(
          current,
          expected,
          value
        )
        if (
          [...state.rows, ...state.archived].some(
            row => row.command.operation_id === saved.command.operation_id
          )
        )
          throw new Error('Shared analysis operation ID is already reserved')
        await ports.assertHead(saved)
        writeAll(
          expected.user_id,
          {
            rows: state.rows.map(row =>
              row.word_id === expected.word_id ? saved : row
            ),
            archived: [...state.archived, current!],
          },
          assertOwner
        )
        return saved
      })
    },
    async read(userId, wordId) {
      return readAll(userId).rows.find(row => row.word_id === wordId) ?? null
    },
    async prepare(value, assertOwner) {
      const operation = parseDictionaryAnalysisClientOperation(value)
      if (operation.submitted || operation.response !== null)
        throw new Error('Expected a fresh shared analysis intent')
      return ports.withLock(key(operation.user_id), async () => {
        assertOwner()
        const state = readAll(operation.user_id)
        const { rows } = state
        const previous = rows.find(row => row.word_id === operation.word_id)
        if (previous) {
          assertOwner()
          return previous
        }
        if (
          [...rows, ...state.archived].some(
            row => row.command.operation_id === operation.command.operation_id
          )
        )
          throw new Error('Shared analysis operation ID is already reserved')
        await ports.assertHead(operation)
        writeAll(
          operation.user_id,
          { ...state, rows: [...rows, operation] },
          assertOwner
        )
        return operation
      })
    },
    async claim(operation, assertOwner) {
      let claimed = false
      await mutate(operation, assertOwner, async current => {
        if (current.submitted) return current
        await ports.assertHead(current)
        claimed = true
        return { ...current, submitted: true }
      })
      return claimed
    },
    async save(operation, response, assertOwner) {
      return mutate(operation, assertOwner, async current => {
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
}

export function createBrowserAnalysisJournal(
  assertHead: (operation: DictionaryAnalysisClientOperation) => Promise<void>
): DictionaryAnalysisAttemptJournal {
  if (typeof window === 'undefined' || !navigator.locks)
    throw new Error('Durable shared analysis storage is unavailable')
  return createBrowserDictionaryAnalysisJournal({
    storage: window.localStorage,
    withLock: async (name, action) =>
      await navigator.locks.request(name, { mode: 'exclusive' }, action),
    assertHead,
  })
}
