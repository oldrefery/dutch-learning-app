import {
  parseFollowingTransferRows,
  prepareFollowingTransferRows,
  decideFollowingTransferRows,
  requireFollowingImportOwner,
  FOLLOWING_TRANSFER_TEXT_LIMIT,
  type FollowingTransferJournal,
  type FollowingTransferSession,
} from '@woordenaar/domain'

const PREFIX = 'dictionary-following-transfer-v2:'
type ExclusiveLock = <T>(name: string, action: () => Promise<T>) => Promise<T>
export function createBrowserFollowingTransferJournal(ports: {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  withLock: ExclusiveLock
}): FollowingTransferJournal {
  const key = (userId: string) =>
    `${PREFIX}${requireFollowingImportOwner(userId)}`
  const read = (userId: string) => {
    const raw = ports.storage.getItem(key(userId))
    if (raw === null) return []
    if (raw.length > FOLLOWING_TRANSFER_TEXT_LIMIT)
      throw new Error('Following transfer storage exceeds its limit')
    return parseFollowingTransferRows(JSON.parse(raw) as unknown, userId)
  }
  const mutate = async (
    userId: string,
    sessionId: string,
    assertOwner: () => void,
    change: (rows: FollowingTransferSession[]) => FollowingTransferSession[]
  ) =>
    ports.withLock(key(userId), async () => {
      assertOwner()
      const rows = change(read(userId))
      const saved = rows.find(row => row.session_id === sessionId)
      if (!saved) throw new Error('Following transfer session is unavailable')
      assertOwner()
      ports.storage.setItem(key(userId), JSON.stringify(rows))
      assertOwner()
      return saved
    })
  return {
    async list(userId) {
      return read(userId)
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
}
export function createFollowingTransferBrowserJournal(): FollowingTransferJournal {
  if (typeof window === 'undefined' || !navigator.locks)
    throw new Error('Durable following transfer storage is unavailable')
  return createBrowserFollowingTransferJournal({
    storage: window.localStorage,
    withLock: async (name, action) =>
      navigator.locks.request(name, { mode: 'exclusive' }, action),
  })
}
