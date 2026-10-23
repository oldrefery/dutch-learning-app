import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import * as Crypto from 'expo-crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  DICTIONARY_TRANSFER_REVISION_COLUMNS,
  readFollowingTransferRevisions,
} from '@woordenaar/domain'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { supabase } from '@/lib/supabase'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  IMPORT_ID,
  importCapability,
  importReceipt,
} from '@/db/__tests__/dictionaryFollowingImport.fixture'
import {
  TRANSFER_ID,
  transferSession,
  transferRevision,
} from '@/db/__tests__/dictionaryFollowingTransfer.fixture'
import { dictionaryFollowingTransferRepository as journal } from '@/db/dictionaryFollowingTransferRepository'
import { dictionaryFollowingTransferService as service } from '../dictionaryFollowingTransferService'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))
jest.mock('@/db/initDB')
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() },
  },
}))
const query = { select: jest.fn(), in: jest.fn(), eq: jest.fn() }
const rpc = supabase.rpc as unknown as jest.Mock
const unsubscribe = jest.fn()
const OFFLINE = 'Offline'
let callback: (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>
describe('native transfer SDK reads public dependencies and reserves exact roots', () => {
  let db: DatabaseSync
  beforeEach(() => {
    jest.clearAllMocks()
    db = createTestDatabase()
    process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValue({ currentUserId: OWNER_A } as never)
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: OWNER_A } },
      error: null,
    } as never)
    jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(fn => {
      callback = fn
      return { data: { subscription: { unsubscribe } } } as never
    })
    jest.mocked(supabase.from).mockReturnValue(query as never)
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [transferRevision], error: null })
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce(IMPORT_ID)
      .mockReturnValueOnce(WORD_A)
    rpc.mockImplementation(async (name: string) => ({
      data:
        name === 'dictionary_content_capability_v2'
          ? importCapability()
          : importReceipt(),
      error: null,
    }))
  })
  afterEach(() => {
    db.close()
    delete process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
    delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
    delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
  })
  it('persists the complete draft offline and lists it without getUser or RPC', async () => {
    jest.mocked(supabase.auth.getUser).mockRejectedValue(new Error(OFFLINE))
    expect(await service.prepare(transferSession())).toEqual(transferSession())
    expect(await service.list(OWNER_A)).toEqual([transferSession()])
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })
  it('reads only explicit immutable published IDs and queues/delivers the mapped root', async () => {
    await service.prepare(transferSession())
    const saved = await service.resolve(OWNER_A, TRANSFER_ID)
    expect(supabase.from).toHaveBeenCalledWith('dictionary_revisions')
    expect(query.select).toHaveBeenCalledWith(
      DICTIONARY_TRANSFER_REVISION_COLUMNS
    )
    expect(query.in).toHaveBeenCalledWith('revision_id', [
      transferRevision.revision_id,
    ])
    expect(query.eq).toHaveBeenCalledWith('review_status', 'published')
    await service.queueEntry(OWNER_A, TRANSFER_ID, 0)
    await service.deliverEntry(OWNER_A, TRANSFER_ID, 0)
    expect(rpc).toHaveBeenCalledWith('apply_dictionary_import_intent_v2', {
      p_intent: saved.plan?.intents[0].intent,
    })
    expect(db.prepare('SELECT * FROM words').all()).toEqual([])
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual([])
    expect((await journal.list(OWNER_A))[0].document).toEqual(
      transferSession().document
    )
  })
  it('retains a draft after Auth A-to-B-to-A during a revision read', async () => {
    await service.prepare(transferSession())
    query.eq.mockImplementationOnce(async () => {
      await callback('SIGNED_IN', { user: { id: OWNER_B } } as Session)
      await callback('SIGNED_IN', { user: { id: OWNER_A } } as Session)
      return { data: [transferRevision], error: null }
    })
    await expect(service.resolve(OWNER_A, TRANSFER_ID)).rejects.toThrow(
      'Authentication changed'
    )
    expect(await journal.list(OWNER_A)).toEqual([transferSession()])
    expect(Crypto.randomUUID).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects error/foreign/nonpublished/duplicate responses instead of treating a failed read as unresolved', async () => {
    await service.prepare(transferSession())
    for (const reply of [
      { data: null, error: new Error(OFFLINE) },
      { data: [{ ...transferRevision, revision_id: IMPORT_ID }], error: null },
      { data: [{ ...transferRevision, review_status: 'draft' }], error: null },
      { data: [transferRevision, transferRevision], error: null },
    ]) {
      query.eq.mockResolvedValueOnce(reply)
      await expect(service.resolve(OWNER_A, TRANSFER_ID)).rejects.toThrow()
      expect(await journal.list(OWNER_A)).toEqual([transferSession()])
    }
    expect(rpc).not.toHaveBeenCalled()
  })
  it('keeps genuine missing or withdrawn references for review without fabricating a match', async () => {
    await service.prepare(transferSession())
    query.eq.mockResolvedValueOnce({ data: [], error: null })
    const saved = await service.resolve(OWNER_A, TRANSFER_ID)
    expect(saved.plan?.intents).toEqual([])
    expect(saved.plan?.review).toHaveLength(3)
    await expect(service.queueEntry(OWNER_A, TRANSFER_ID, 0)).rejects.toThrow(
      'requires review'
    )
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects foreign owner and absent gates while retained local documents remain readable', async () => {
    await service.prepare(transferSession())
    delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    await expect(service.resolve(OWNER_A, TRANSFER_ID)).rejects.toThrow(
      'unavailable'
    )
    expect(await service.list(OWNER_A)).toEqual([transferSession()])
    await expect(service.list(OWNER_B)).rejects.toThrow(
      'Authentication changed'
    )
    expect(supabase.from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('bounds dependency reads and skips an empty reference set', async () => {
    const owner = { assert: jest.fn(), check: jest.fn(async () => {}) }
    const read = jest.fn()
    expect(await readFollowingTransferRevisions([], owner, read)).toEqual([])
    await expect(
      readFollowingTransferRevisions(
        Array.from(
          { length: 101 },
          (_, index) =>
            `14141414-1414-4141-8141-${String(index).padStart(12, '0')}`
        ),
        owner,
        read
      )
    ).rejects.toThrow('Too many')
    expect(read).not.toHaveBeenCalled()
  })
})
