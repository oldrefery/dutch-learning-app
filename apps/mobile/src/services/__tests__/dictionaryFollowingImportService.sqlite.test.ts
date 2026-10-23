import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { DatabaseSync } from 'node:sqlite'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { supabase } from '@/lib/supabase'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { OWNER_A, OWNER_B } from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  importOperation,
  importReceipt,
  importCapability,
  importState,
  recoveryOperation,
  cancellationOperation,
  recoveryReceipt,
  cancellationReceipt,
} from '@/db/__tests__/dictionaryFollowingImport.fixture'
import { dictionaryFollowingImportRepository as journal } from '@/db/dictionaryFollowingImportRepository'
import { dictionaryFollowingImportService as service } from '../dictionaryFollowingImportService'

jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))
jest.mock('@/db/initDB')
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() },
  },
}))
const rpc = supabase.rpc as unknown as jest.Mock
const VIEW_CLOSED = 'View closed'
const unsubscribe = jest.fn()
let callback: (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>
const accountEvent = (id: string) =>
  callback('SIGNED_IN', { user: { id } } as Session)

describe('native authenticated following import adapter', () => {
  let db: DatabaseSync
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValue({ currentUserId: OWNER_A } as never)
    db = createTestDatabase()
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: OWNER_A } },
      error: null,
    } as never)
    jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(fn => {
      callback = fn
      return { data: { subscription: { unsubscribe } } } as never
    })
    rpc.mockImplementation(async (name: string) => ({
      data:
        name === 'dictionary_content_capability_v2'
          ? importCapability()
          : name === 'read_dictionary_import_recovery_v2'
            ? importState(true)
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
  it('queues offline without getUser or RPC and reserves the exact intent', async () => {
    jest.mocked(supabase.auth.getUser).mockRejectedValue(new Error('Offline'))
    const queued = await service.queue(importOperation())
    expect(queued).toEqual(importOperation())
    expect(await journal.list(OWNER_A)).toEqual([queued])
    expect(rpc).not.toHaveBeenCalled()
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('prepares and delivers exact v2 input and leaves all personal content/learning tables untouched', async () => {
    const saved = await service.prepare(importOperation())
    const done = await service.deliver(saved)
    expect(done.result).toEqual(importReceipt())
    expect(rpc).toHaveBeenCalledWith('apply_dictionary_import_intent_v2', {
      p_intent: saved.request,
    })
    expect(await service.list(OWNER_A)).toEqual([done])
    for (const table of [
      'words',
      'dictionary_content_commands',
      'learning_commands',
      'dictionary_import_intents',
    ])
      expect(
        db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()
      ).toEqual({ count: 0 })
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })
  it('keeps same-ID state reads available after flags withdraw', async () => {
    const saved = await journal.prepare(importOperation(), () => {})
    delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    expect(await service.readState(saved)).toEqual(importState(true))
    await expect(service.deliver(saved)).rejects.toThrow('unavailable')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects a different active account before any journal or RPC write', async () => {
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: OWNER_B } },
      error: null,
    } as never)
    await expect(service.prepare(importOperation())).rejects.toThrow(
      'Authentication changed'
    )
    expect(rpc).not.toHaveBeenCalled()
    expect(await journal.list(OWNER_A)).toEqual([])
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('latches A-to-B-to-A during a lost reply and preserves the root for explicit recovery', async () => {
    const saved = await service.prepare(importOperation())
    rpc.mockImplementation(async (name: string) => {
      if (name === 'dictionary_content_capability_v2')
        return { data: importCapability(), error: null }
      await accountEvent(OWNER_B)
      await accountEvent(OWNER_A)
      return { data: importReceipt(), error: null }
    })
    await expect(service.deliver(saved)).rejects.toThrow(
      'Authentication changed'
    )
    expect((await journal.list(OWNER_A))[0]).toEqual(saved)
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })
  it('does not dispatch when capability command2 is unavailable or permission fails', async () => {
    rpc.mockResolvedValueOnce({
      data: { ...importCapability(), command_protocol_versions: [1] },
      error: null,
    })
    await expect(service.prepare(importOperation())).rejects.toThrow(
      'unavailable'
    )
    expect(await journal.list(OWNER_A)).toEqual([])
    const saved = await service.prepare(importOperation())
    rpc
      .mockResolvedValueOnce({ data: importCapability(), error: null })
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Permission revoked'),
      })
    await expect(service.deliver(saved)).rejects.toThrow('Permission revoked')
    expect((await journal.list(OWNER_A))[0].result).toBeNull()
  })
  it.each(['recover', 'cancel'] as const)(
    'preserves the saved %s nonce after a lost reply and permits existing recovery/cancellation with creation off',
    async kind => {
      await journal.prepare(importOperation(), () => {})
      delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
      const draft =
        kind === 'recover' ? recoveryOperation(true) : cancellationOperation()
      const saved = await service.prepare(draft)
      rpc.mockImplementation(async (name: string) => {
        if (name === 'read_dictionary_import_recovery_v2')
          return { data: importState(true), error: null }
        return { data: null, error: new Error('Lost reply') }
      })
      await expect(service.deliver(saved)).rejects.toThrow('Lost reply')
      expect((await journal.list(OWNER_A)).at(-1)).toEqual(saved)
      const result =
        kind === 'recover' ? recoveryReceipt() : cancellationReceipt()
      rpc.mockImplementation(async (name: string) => ({
        data:
          name === 'read_dictionary_import_recovery_v2'
            ? importState(true)
            : result,
        error: null,
      }))
      const resumed = (await service.list(OWNER_A)).at(-1)!
      expect((await service.deliver(resumed)).result).toEqual(result)
      expect(rpc).toHaveBeenCalledWith(
        kind === 'recover'
          ? 'recover_dictionary_import_v2'
          : 'cancel_dictionary_import_v2',
        { p_request: saved.request }
      )
      expect(
        rpc.mock.calls.some(
          ([name]) =>
            name === 'apply_dictionary_import_intent_v2' ||
            name === 'dictionary_content_capability_v2'
        )
      ).toBe(false)
      expect(db.prepare('SELECT COUNT(*) AS count FROM words').get()).toEqual({
        count: 0,
      })
    }
  )
  it('checks fresh placement before reserving and never journals a stale recovery request', async () => {
    await journal.prepare(importOperation(), () => {})
    rpc.mockResolvedValueOnce({
      data: { ...importState(true), collection_id: OWNER_B },
      error: null,
    })
    await expect(service.prepare(recoveryOperation(true))).rejects.toThrow(
      'placement changed'
    )
    expect(await journal.list(OWNER_A)).toEqual([importOperation()])
  })
  it.each(['recover', 'cancel'] as const)(
    'fences %s receipt persistence after mounted lifetime changes during RPC',
    async kind => {
      await journal.prepare(importOperation(), () => {})
      const saved = await service.prepare(
        kind === 'recover' ? recoveryOperation(true) : cancellationOperation()
      )
      let active = true
      const guard = () => {
        if (!active) throw new Error(VIEW_CLOSED)
      }
      rpc.mockImplementation(async (name: string) => {
        if (name === 'read_dictionary_import_recovery_v2')
          return { data: importState(true), error: null }
        active = false
        return {
          data: kind === 'recover' ? recoveryReceipt() : cancellationReceipt(),
          error: null,
        }
      })
      await expect(service.deliver(saved, guard)).rejects.toThrow(VIEW_CLOSED)
      expect((await journal.list(OWNER_A)).at(-1)).toEqual(saved)
      await expect(service.readState(saved, guard)).rejects.toThrow(VIEW_CLOSED)
      expect(unsubscribe).toHaveBeenCalledTimes(3)
    }
  )
})
