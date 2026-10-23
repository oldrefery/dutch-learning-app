import {
  assertCreationJournalOwner,
  claimCreationJournalRows,
  CREATION_JOURNAL_TEXT_LIMIT,
  parseCreationJournalRows,
  prepareCreationJournalRows,
  saveCreationJournalRows,
  type DictionaryCreationJournal,
  type DictionaryCreationJournalOwner,
  type DictionaryCreationJournalRow,
} from '@woordenaar/domain'

const PREFIX = 'dictionary-creation-v2:'
type Change<T> = (rows: DictionaryCreationJournalRow[]) => {
  rows: DictionaryCreationJournalRow[]
  result: T
}
/** One atomic owner key under an exclusive Web Lock. No eviction or unlocked fallback. */
export function createBrowserDictionaryCreationJournal(ports: {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  withLock: <T>(name: string, action: () => Promise<T>) => Promise<T>
}): DictionaryCreationJournal {
  const readRows = (userId: string) => {
    const raw = ports.storage.getItem(`${PREFIX}${userId}`)
    if (raw === null) return []
    if (raw.length > CREATION_JOURNAL_TEXT_LIMIT)
      throw new Error('Creation journal exceeds its limit')
    const envelope: unknown = JSON.parse(raw)
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope))
      throw new Error('Invalid creation journal envelope')
    const e = envelope as Record<string, unknown>
    if (
      Object.keys(e).length !== 2 ||
      e.protocol_version !== 1 ||
      !Object.hasOwn(e, 'rows')
    )
      throw new Error('Invalid creation journal envelope')
    return parseCreationJournalRows(e.rows, userId)
  }
  const access = async <T>(
    userId: string,
    owner: DictionaryCreationJournalOwner,
    change: Change<T>
  ): Promise<T> => {
    assertCreationJournalOwner(userId, owner)
    await owner.check()
    return ports.withLock(`${PREFIX}${userId}`, async () => {
      await owner.check()
      assertCreationJournalOwner(userId, owner)
      const before = readRows(userId)
      const next = change(before)
      const raw = JSON.stringify({ protocol_version: 1, rows: next.rows })
      if (raw.length > CREATION_JOURNAL_TEXT_LIMIT)
        throw new Error('Creation journal exceeds its limit')
      assertCreationJournalOwner(userId, owner)
      if (JSON.stringify(before) !== JSON.stringify(next.rows))
        ports.storage.setItem(`${PREFIX}${userId}`, raw)
      assertCreationJournalOwner(userId, owner)
      return next.result
    })
  }
  const savedRow = (rows: DictionaryCreationJournalRow[], id: string) => {
    const row = rows.find(value => value.session.request.resolution_id === id)
    if (!row) throw new Error('Creation journal request is unavailable')
    return row
  }
  return {
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
        const { rows: next, ...result } = claimCreationJournalRows(
          rows,
          expected
        )
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
}
export function createBrowserCreationJournal(): DictionaryCreationJournal {
  if (typeof window === 'undefined' || !navigator.locks)
    throw new Error('Durable creation storage is unavailable')
  return createBrowserDictionaryCreationJournal({
    storage: window.localStorage,
    withLock: async (name, action) =>
      await navigator.locks.request(name, { mode: 'exclusive' }, action),
  })
}
