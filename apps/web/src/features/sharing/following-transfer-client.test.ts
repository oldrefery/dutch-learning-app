import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { DICTIONARY_TRANSFER_REVISION_COLUMNS } from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createWebFollowingTransferService } from './following-transfer-client'
import { createFollowingTransferBrowserJournal } from './following-transfer-journal'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  TRANSFER_ID,
  TRANSFER_WORD,
  TRANSFER_OPERATION,
  transferSession,
  transferRevision,
  transferReceipt,
  transferCapability,
} from './__fixtures__/following-transfer'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const query = { select: jest.fn(), in: jest.fn(), eq: jest.fn() }
const from = jest.fn()
const rpc = jest.fn()
const getUser = jest.fn()
const getSession = jest.fn()
const unsubscribe = jest.fn()
const OFFLINE = 'Offline'
const originalUUID = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
let callback: (event: AuthChangeEvent, session: Session | null) => void
const onAuthStateChange = jest.fn(fn => {
  callback = fn
  return { data: { subscription: { unsubscribe } } }
})
const locks = {
  request: jest.fn(
    async (_name: string, _options: unknown, action: () => Promise<unknown>) =>
      action()
  ),
}
describe('web explicit transfer workflow using fresh Auth and published revisions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    })
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest
        .fn()
        .mockReturnValueOnce(TRANSFER_OPERATION)
        .mockReturnValueOnce(TRANSFER_WORD),
    })
    jest.mocked(createClient).mockReturnValue({
      from,
      rpc,
      auth: { getUser, getSession, onAuthStateChange },
    } as never)
    getSession.mockResolvedValue({
      data: { session: { user: { id: TRANSFER_OWNER } } },
      error: null,
    })
    getUser.mockResolvedValue({
      data: { user: { id: TRANSFER_OWNER } },
      error: null,
    })
    from.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [transferRevision], error: null })
    rpc.mockImplementation(async (name: string) => ({
      data:
        name === 'dictionary_content_capability_v2'
          ? transferCapability()
          : transferReceipt(),
      error: null,
    }))
  })
  afterEach(() => {
    if (originalUUID) Object.defineProperty(crypto, 'randomUUID', originalUUID)
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    Reflect.deleteProperty(navigator, 'locks')
  })
  it('is inert until invoked and saves a full draft from a cached session while offline', async () => {
    const service = createWebFollowingTransferService(TRANSFER_OWNER, true)
    expect(createClient).not.toHaveBeenCalled()
    getUser.mockRejectedValue(new Error(OFFLINE))
    await service.prepare(transferSession())
    expect(await service.list()).toEqual([transferSession()])
    expect(getUser).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('reads published revisions, reserves the saved index/nonce and resumes a lost reply after recreation', async () => {
    const service = createWebFollowingTransferService(TRANSFER_OWNER, true)
    await service.prepare(transferSession())
    const planned = await service.resolve(TRANSFER_ID)
    expect(from).toHaveBeenCalledWith('dictionary_revisions')
    expect(query.select).toHaveBeenCalledWith(
      DICTIONARY_TRANSFER_REVISION_COLUMNS
    )
    expect(query.in).toHaveBeenCalledWith('revision_id', [
      transferRevision.revision_id,
    ])
    expect(query.eq).toHaveBeenCalledWith('review_status', 'published')
    await service.queueEntry(TRANSFER_ID, 0)
    rpc
      .mockImplementationOnce(async () => ({
        data: transferCapability(),
        error: null,
      }))
      .mockImplementationOnce(async () => {
        throw new Error('Lost reply')
      })
    await expect(service.deliverEntry(TRANSFER_ID, 0)).rejects.toThrow(
      'Lost reply'
    )
    const recreated = createWebFollowingTransferService(TRANSFER_OWNER, true)
    await recreated.deliverEntry(TRANSFER_ID, 0)
    const calls = rpc.mock.calls.filter(
      ([name]) => name === 'apply_dictionary_import_intent_v2'
    )
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual(calls[1])
    expect(calls[0][1]).toEqual({ p_intent: planned.plan?.intents[0].intent })
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    await recreated.deliverEntry(TRANSFER_ID, 0)
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'apply_dictionary_import_intent_v2'
      )
    ).toHaveLength(2)
    expect((await recreated.list())[0].document).toEqual(
      transferSession().document
    )
  })
  it('retains the document on network failure and Auth A-to-B-to-A without allocating nonces', async () => {
    const service = createWebFollowingTransferService(TRANSFER_OWNER, true)
    await service.prepare(transferSession())
    query.eq.mockRejectedValueOnce(new Error(OFFLINE))
    await expect(service.resolve(TRANSFER_ID)).rejects.toThrow(OFFLINE)
    query.eq.mockImplementationOnce(async () => {
      callback('SIGNED_IN', { user: { id: TRANSFER_OTHER } } as Session)
      callback('SIGNED_IN', { user: { id: TRANSFER_OWNER } } as Session)
      return { data: [transferRevision], error: null }
    })
    await expect(service.resolve(TRANSFER_ID)).rejects.toThrow(
      'Authentication changed'
    )
    expect(
      await createFollowingTransferBrowserJournal().list(TRANSFER_OWNER)
    ).toEqual([transferSession()])
    expect(crypto.randomUUID).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects unavailable storage, foreign session and flags before document writes or queries', async () => {
    const service = createWebFollowingTransferService(TRANSFER_OWNER, true)
    getSession.mockResolvedValueOnce({
      data: { session: { user: { id: TRANSFER_OTHER } } },
      error: null,
    })
    await expect(service.prepare(transferSession())).rejects.toThrow(
      'Authentication changed'
    )
    Reflect.deleteProperty(navigator, 'locks')
    await expect(service.prepare(transferSession())).rejects.toThrow(
      'storage is unavailable'
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    })
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    await expect(service.prepare(transferSession())).rejects.toThrow(
      'unavailable'
    )
    expect(localStorage.length).toBe(0)
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('keeps private differences/unresolved entries out of dispatch and requires prior explicit reservation', async () => {
    const service = createWebFollowingTransferService(TRANSFER_OWNER, true)
    await service.prepare(transferSession())
    await service.resolve(TRANSFER_ID)
    await expect(service.queueEntry(TRANSFER_ID, 1)).rejects.toThrow(
      'requires review'
    )
    await expect(service.queueEntry(TRANSFER_ID, 2)).rejects.toThrow(
      'requires review'
    )
    await expect(service.deliverEntry(TRANSFER_ID, 0)).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
    expect((await service.list())[0].document.entries).toHaveLength(4)
  })
})
