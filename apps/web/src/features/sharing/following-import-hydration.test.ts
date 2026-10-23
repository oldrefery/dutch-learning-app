import {
  parseDictionaryImportIntentV2,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { followingBatch } from '@/features/dictionary/__fixtures__/following'
import { createFollowingImportBrowserJournal } from './following-import-journal'
import {
  loadWebFollowingImport,
  loadWebFollowingExistingCard,
} from './following-import-hydration'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  TRANSFER_OPERATION,
  TRANSFER_WORD,
  transferReceipt,
  transferCapability,
  transferRevision,
} from './__fixtures__/following-transfer'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const rpc = jest.fn()
const personal = jest.fn()
const from = jest.fn()
const refresh = jest.fn()
const CAPABILITY = 'dictionary_content_capability_v2'
const EFFECTIVE = 'get_dictionary_effective_content_v2'
const OFFLINE = 'Offline'
const EXISTING = 'abababab-abab-4bab-8bab-abababababab'
const RECOVERY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const response = (data: unknown) => ({ data, error: null })
const original = (): FollowingImportOperation => ({
  user_id: TRANSFER_OWNER,
  kind: 'import',
  result: null,
  request: parseDictionaryImportIntentV2({
    protocol_version: 2,
    operation_id: TRANSFER_OPERATION,
    word_id: TRANSFER_WORD,
    collection_id: TRANSFER_OTHER,
    source: {
      kind: 'published-reference',
      reference: {
        entry_id: transferRevision.entry_id,
        revision_id: transferRevision.revision_id,
      },
      content_sha256: transferRevision.content_sha256,
    },
  }),
})
const state = () => ({
  protocol_version: 2,
  original_operation_id: TRANSFER_OPERATION,
  word_id: TRANSFER_WORD,
  recovery_version: 0,
  inserted_once: true,
  state: 'active',
  collection_id: TRANSFER_OTHER,
})
let account: string
let callback: (event: string, session: { user: { id: string } }) => void
const unsubscribe = jest.fn()
const assertCurrent = jest.fn()
const run = (value: FollowingImportOperation, enabled = true) =>
  loadWebFollowingImport(value, enabled, assertCurrent, refresh)

describe('web explicit following import loading', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    account = TRANSFER_OWNER
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: async (
          _key: string,
          _options: unknown,
          action: () => Promise<unknown>
        ) => action(),
      },
    })
    const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: personal }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    from.mockReturnValue(query)
    personal.mockResolvedValue(
      response({
        word_id: TRANSFER_WORD,
        user_id: TRANSFER_OWNER,
        collection_id: TRANSFER_OTHER,
        deleted_at: null,
      })
    )
    jest.mocked(createClient).mockReturnValue({
      from,
      rpc,
      auth: {
        getUser: async () => ({ data: { user: { id: account } }, error: null }),
        onAuthStateChange: (fn: typeof callback) => {
          callback = fn
          return { data: { subscription: { unsubscribe } } }
        },
      },
    } as never)
    rpc.mockImplementation(async name =>
      response(
        name === CAPABILITY
          ? transferCapability()
          : name === EFFECTIVE
            ? followingBatch([TRANSFER_WORD])
            : state()
      )
    )
    assertCurrent.mockImplementation(() => {})
  })
  const save = async () => {
    const journal = createFollowingImportBrowserJournal()
    const value = await journal.prepare(original(), () => {})
    return journal.save(value, transferReceipt(), () => {})
  }
  it('verifies personal ownership and complete shared dependencies before refreshing', async () => {
    const value = await save()
    const before = localStorage.getItem(localStorage.key(0)!)
    await run(value)
    expect(from).toHaveBeenCalledWith('words')
    expect(personal).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(EFFECTIVE, { p_word_ids: [TRANSFER_WORD] })
    expect(localStorage.getItem(localStorage.key(0)!)).toBe(before)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it.each([
    'capability',
    'source',
    'missing-personal',
    'deleted',
    'wrong-owner',
    'partial-content',
    'private-fallback',
  ])('does not refresh on %s', async failure => {
    const value = await save()
    const normal = rpc.getMockImplementation()!
    rpc.mockImplementation(async name => {
      if (failure === 'capability' && name === CAPABILITY)
        return response({ ...transferCapability(), following_enabled: false })
      if (failure === 'source' && name === EFFECTIVE)
        return { data: null, error: new Error('Source withdrawn') }
      if (failure === 'partial-content' && name === EFFECTIVE)
        return response({ ...followingBatch([TRANSFER_WORD]), revisions: [] })
      if (failure === 'private-fallback' && name === EFFECTIVE) {
        const batch = followingBatch([TRANSFER_WORD])
        return response({
          ...batch,
          cards: [
            {
              ...batch.cards[0],
              mode: 'legacy',
              reference: null,
              adopted_revision_id: null,
              head_sequence: null,
              legacy_content: transferRevision.content,
            },
          ],
        })
      }
      return normal(name)
    })
    if (failure === 'missing-personal')
      personal.mockResolvedValue(response(null))
    if (failure === 'deleted' || failure === 'wrong-owner')
      personal.mockResolvedValue(
        response({
          word_id: TRANSFER_WORD,
          user_id: failure === 'wrong-owner' ? TRANSFER_OTHER : TRANSFER_OWNER,
          deleted_at: failure === 'deleted' ? '2026-10-10' : null,
        })
      )
    await expect(run(value)).rejects.toThrow()
    expect(refresh).not.toHaveBeenCalled()
    expect(
      await createFollowingImportBrowserJournal().list(TRANSFER_OWNER)
    ).toEqual([value])
  })
  it('retries an offline read using the same journal after reconstruction', async () => {
    const value = await save()
    personal.mockRejectedValueOnce(new Error(OFFLINE))
    await expect(run(value)).rejects.toThrow(OFFLINE)
    await run(
      (await createFollowingImportBrowserJournal().list(TRANSFER_OWNER))[0]
    )
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls.some(([name]) => name.startsWith('apply_'))).toBe(
      false
    )
  })
  it('fences account ABA during personal fetch', async () => {
    const value = await save()
    personal.mockImplementationOnce(async () => {
      callback('SIGNED_IN', { user: { id: TRANSFER_OTHER } })
      callback('SIGNED_IN', { user: { id: TRANSFER_OWNER } })
      return response({
        word_id: TRANSFER_WORD,
        user_id: TRANSFER_OWNER,
        deleted_at: null,
      })
    })
    await expect(run(value)).rejects.toThrow('Authentication changed')
    expect(refresh).not.toHaveBeenCalled()
  })
  it('requires a confirmed receipt and current owner/gate before network loading', async () => {
    await createFollowingImportBrowserJournal().prepare(original(), () => {})
    await expect(run(original())).rejects.toThrow('confirmed')
    const value = await save()
    await expect(run(value, false)).rejects.toThrow('unavailable')
    account = TRANSFER_OTHER
    await expect(run(value)).rejects.toThrow('Authentication changed')
    expect(rpc).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('ignores completion after unmount', async () => {
    const value = await save()
    const normal = rpc.getMockImplementation()!
    rpc.mockImplementation(async name => {
      const result = await normal(name)
      if (name === EFFECTIVE)
        assertCurrent.mockImplementation(() => {
          throw new Error('Unmounted')
        })
      return result
    })
    await expect(run(value)).rejects.toThrow('Unmounted')
    expect(refresh).not.toHaveBeenCalled()
  })
  const runExisting = (value: FollowingImportOperation, enabled = true) =>
    loadWebFollowingExistingCard(value, enabled, assertCurrent, refresh)
  const saveConflict = async (recovered = false) => {
    const journal = createFollowingImportBrowserJournal()
    const pending = await journal.prepare(original(), () => {})
    const root = await journal.save(
      pending,
      {
        ...transferReceipt(),
        outcome: 'identity-conflict',
        existing_word_id: EXISTING,
        reference: null,
        applied_reference: null,
        applied_head_sequence: null,
      },
      () => {}
    )
    if (recovered) {
      const request = await journal.prepare(
        {
          user_id: TRANSFER_OWNER,
          kind: 'recover',
          result: null,
          request: {
            protocol_version: 2,
            operation_id: RECOVERY,
            original_intent: original().request as ReturnType<
              typeof parseDictionaryImportIntentV2
            >,
            expected_recovery_version: 0,
            expected_collection_id: null,
            target_collection_id: TRANSFER_OTHER,
          },
        },
        () => {}
      )
      await journal.save(
        request,
        {
          protocol_version: 2,
          operation_id: RECOVERY,
          original_operation_id: TRANSFER_OPERATION,
          word_id: TRANSFER_WORD,
          target_collection_id: TRANSFER_OTHER,
          recovery_version: 1,
          idempotent: false,
          outcome: 'identity-conflict',
          existing_word_id: EXISTING,
        },
        () => {}
      )
    }
    personal.mockResolvedValue(
      response({
        word_id: EXISTING,
        user_id: TRANSFER_OWNER,
        collection_id: TRANSFER_OTHER,
        deleted_at: null,
      })
    )
    rpc.mockImplementation(async name =>
      response(
        name === CAPABILITY
          ? transferCapability()
          : name === EFFECTIVE
            ? followingBatch([EXISTING])
            : {
                ...state(),
                inserted_once: false,
                state: 'uncreated',
                collection_id: null,
                recovery_version: recovered ? 1 : 0,
              }
      )
    )
    return root
  }
  it.each([false, true])(
    'loads the exact existing card from the saved conflict without changing browser storage (recovery=%s)',
    async recovered => {
      const root = await saveConflict(recovered)
      const before =
        await createFollowingImportBrowserJournal().list(TRANSFER_OWNER)
      await expect(run(root)).rejects.toThrow('confirmed')
      await runExisting(root)
      expect(rpc).toHaveBeenCalledWith(EFFECTIVE, { p_word_ids: [EXISTING] })
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(
        await createFollowingImportBrowserJournal().list(TRANSFER_OWNER)
      ).toEqual(before)
      expect(
        rpc.mock.calls.some(([name]) => /^(apply|recover|cancel)_/.test(name))
      ).toBe(false)
    }
  )
  it.each([
    'missing',
    'deleted',
    'unknown-deletion',
    'wrong-owner',
    'wrong-id',
    'private',
    'wrong-meaning',
  ])('does not refresh an unavailable existing card: %s', async failure => {
    const root = await saveConflict()
    if (failure === 'missing') personal.mockResolvedValue(response(null))
    if (
      ['deleted', 'unknown-deletion', 'wrong-owner', 'wrong-id'].includes(
        failure
      )
    )
      personal.mockResolvedValue(
        response({
          word_id: failure === 'wrong-id' ? TRANSFER_WORD : EXISTING,
          user_id: failure === 'wrong-owner' ? TRANSFER_OTHER : TRANSFER_OWNER,
          deleted_at:
            failure === 'unknown-deletion'
              ? undefined
              : failure === 'deleted'
                ? '2026-10-10'
                : null,
        })
      )
    if (failure === 'private' || failure === 'wrong-meaning') {
      const normal = rpc.getMockImplementation()!
      rpc.mockImplementation(async name => {
        if (name !== EFFECTIVE) return normal(name)
        const batch = followingBatch([EXISTING])
        if (failure === 'private')
          return response({
            ...batch,
            cards: [
              {
                ...batch.cards[0],
                mode: 'legacy',
                reference: null,
                adopted_revision_id: null,
                head_sequence: null,
                legacy_content: transferRevision.content,
              },
            ],
          })
        return response({
          ...batch,
          cards: batch.cards.map(card => ({
            ...card,
            reference: { ...card.reference!, entry_id: RECOVERY },
          })),
          revisions: batch.revisions.map(row => ({
            ...row,
            entry_id: RECOVERY,
          })),
        })
      })
    }
    await expect(runExisting(root)).rejects.toThrow()
    expect(refresh).not.toHaveBeenCalled()
    expect(
      await createFollowingImportBrowserJournal().list(TRANSFER_OWNER)
    ).toEqual([root])
  })
  it('reconstructs a conflict after offline loading and refreshes only on an explicit retry', async () => {
    const root = await saveConflict()
    personal.mockRejectedValueOnce(new Error(OFFLINE))
    await expect(runExisting(root)).rejects.toThrow(OFFLINE)
    await runExisting(
      (await createFollowingImportBrowserJournal().list(TRANSFER_OWNER))[0]
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('fences existing-card loading after account ABA and when following reads are disabled', async () => {
    const root = await saveConflict()
    await expect(runExisting(root, false)).rejects.toThrow('unavailable')
    expect(rpc).not.toHaveBeenCalled()
    personal.mockImplementationOnce(async () => {
      callback('SIGNED_IN', { user: { id: TRANSFER_OTHER } })
      callback('SIGNED_IN', { user: { id: TRANSFER_OWNER } })
      return response({
        word_id: EXISTING,
        user_id: TRANSFER_OWNER,
        deleted_at: null,
      })
    })
    await expect(runExisting(root)).rejects.toThrow('Authentication changed')
    expect(refresh).not.toHaveBeenCalled()
  })
  it.each(['cancelled', 'active', 'new-version'] as const)(
    'rejects changed server import state before loading existing cards: %s',
    async change => {
      const root = await saveConflict()
      const normal = rpc.getMockImplementation()!
      rpc.mockImplementation(async name =>
        name !== 'read_dictionary_import_recovery_v2'
          ? normal(name)
          : response(
              change === 'active'
                ? state()
                : {
                    ...state(),
                    inserted_once: false,
                    collection_id: null,
                    state: change === 'cancelled' ? 'cancelled' : 'uncreated',
                    recovery_version: 1,
                  }
            )
      )
      await expect(runExisting(root)).rejects.toThrow('recovery changed')
      expect(personal).not.toHaveBeenCalled()
      expect(refresh).not.toHaveBeenCalled()
    }
  )
  it('does not refresh if server cancellation occurs after shared fetch', async () => {
    const root = await saveConflict()
    let changed = false
    const normal = rpc.getMockImplementation()!
    rpc.mockImplementation(async name => {
      if (name === EFFECTIVE) changed = true
      if (changed && name === 'read_dictionary_import_recovery_v2')
        return response({
          ...state(),
          inserted_once: false,
          collection_id: null,
          state: 'cancelled',
          recovery_version: 1,
        })
      return normal(name)
    })
    await expect(runExisting(root)).rejects.toThrow('recovery changed')
    expect(refresh).not.toHaveBeenCalled()
  })
  it('holds a local cancellation reserved during the existing personal fetch', async () => {
    const root = await saveConflict()
    personal.mockImplementationOnce(async () => {
      await createFollowingImportBrowserJournal().prepare(
        {
          user_id: TRANSFER_OWNER,
          kind: 'cancel',
          result: null,
          request: {
            protocol_version: 2,
            operation_id: RECOVERY,
            original_intent: original().request as ReturnType<
              typeof parseDictionaryImportIntentV2
            >,
          },
        },
        () => {}
      )
      return response({
        word_id: EXISTING,
        user_id: TRANSFER_OWNER,
        deleted_at: null,
      })
    })
    await expect(runExisting(root)).rejects.toThrow('confirmed')
    expect(refresh).not.toHaveBeenCalled()
  })
})
