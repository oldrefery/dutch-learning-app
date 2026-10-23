import {
  parseFollowingImportRows,
  prepareFollowingImportRows,
  saveFollowingImportRows,
  requireFollowingImportOwner,
  FOLLOWING_IMPORT_JOURNAL_TEXT_LIMIT,
  type FollowingImportJournal,
  type FollowingImportOperation,
} from '@woordenaar/domain'

const PREFIX = 'dictionary-following-import-v2:'
type ExclusiveLock = <T>(name: string, action: () => Promise<T>) => Promise<T>

export function createBrowserFollowingImportJournal(ports: {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  withLock: ExclusiveLock
}): FollowingImportJournal {
  const key = (userId: string) =>
    `${PREFIX}${requireFollowingImportOwner(userId)}`
  const read = (userId: string) => {
    const raw = ports.storage.getItem(key(userId))
    if (raw === null) return []
    if (raw.length > FOLLOWING_IMPORT_JOURNAL_TEXT_LIMIT)
      throw new Error('Following import journal exceeds its limit')
    return parseFollowingImportRows(JSON.parse(raw) as unknown, userId)
  }
  const mutate = async (
    userId: string,
    operationId: string,
    assertOwner: () => void,
    change: (rows: FollowingImportOperation[]) => FollowingImportOperation[]
  ) =>
    ports.withLock(key(userId), async () => {
      assertOwner()
      const rows = change(read(userId))
      const raw = JSON.stringify(rows)
      if (raw.length > FOLLOWING_IMPORT_JOURNAL_TEXT_LIMIT)
        throw new Error('Following import journal exceeds its limit')
      assertOwner()
      ports.storage.setItem(key(userId), raw)
      assertOwner()
      const saved = rows.find(row => row.request.operation_id === operationId)
      if (!saved) throw new Error('Following import operation is unavailable')
      return saved
    })
  return {
    async list(userId) {
      return read(userId)
    },
    async prepare(value, assertOwner) {
      return mutate(
        value.user_id,
        value.request.operation_id,
        assertOwner,
        rows => prepareFollowingImportRows(rows, value)
      )
    },
    async save(expected, value, assertOwner) {
      return mutate(
        expected.user_id,
        expected.request.operation_id,
        assertOwner,
        rows => saveFollowingImportRows(rows, expected, value)
      )
    },
  }
}

export function createFollowingImportBrowserJournal(): FollowingImportJournal {
  if (typeof window === 'undefined' || !navigator.locks)
    throw new Error('Durable following import storage is unavailable')
  return createBrowserFollowingImportJournal({
    storage: window.localStorage,
    withLock: async (name, action) =>
      navigator.locks.request(name, { mode: 'exclusive' }, action),
  })
}
