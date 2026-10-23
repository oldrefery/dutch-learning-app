import {
  createDictionaryFollowingImportClient,
  parseDictionaryImportIntentV2,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { createBrowserFollowingImportJournal } from './following-import-journal'

const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const WORD = '33333333-3333-4333-8333-333333333333'
const OPERATION = '44444444-4444-4444-8444-444444444444'
const ENTRY = '55555555-5555-4555-8555-555555555555'
const REVISION = '66666666-6666-4666-8666-666666666666'
const COLLECTION = '77777777-7777-4777-8777-777777777777'
const ROOT = parseDictionaryImportIntentV2({
  protocol_version: 2,
  operation_id: OPERATION,
  word_id: WORD,
  collection_id: COLLECTION,
  source: {
    kind: 'published-reference',
    reference: { entry_id: ENTRY, revision_id: REVISION },
    content_sha256: 'a'.repeat(64),
  },
})
const operation = (): FollowingImportOperation => ({
  user_id: OWNER,
  kind: 'import',
  request: ROOT,
  result: null,
})
const receipt = () => ({
  protocol_version: 2,
  operation_id: OPERATION,
  word_id: WORD,
  outcome: 'inserted',
  idempotent: false,
  existing_word_id: null,
  reference: ROOT.source.reference,
  applied_reference: ROOT.source.reference,
  applied_head_sequence: '9007199254740993',
})
const owner = { assert: jest.fn(), check: jest.fn(async () => {}) }
const assertOwner = () => {}

describe('following import browser journal without protocol1 storage mutation', () => {
  let values: Map<string, string>
  let storage: { getItem: jest.Mock; setItem: jest.Mock }
  let tail: Promise<unknown>
  const journal = () =>
    createBrowserFollowingImportJournal({
      storage,
      withLock: (name, action) => {
        expect(name).toContain(OWNER)
        const next = tail.then(action)
        tail = next.catch(() => {})
        return next
      },
    })
  beforeEach(() => {
    values = new Map([
      ['legacy-transfer', 'preserved original private content'],
    ])
    tail = Promise.resolve()
    storage = {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        values.set(key, value)
      }),
    }
    jest.clearAllMocks()
    owner.assert.mockImplementation(assertOwner)
    owner.check.mockImplementation(async () => {})
  })

  it('restores exactly the same nonce after a lost response and never stores personal learning', async () => {
    await journal().prepare(operation(), assertOwner)
    const rpc = jest.fn(async (name: string) => {
      if (name === 'dictionary_content_capability_v2')
        return {
          data: {
            dictionary_content_protocol: 2,
            read_protocol_versions: [1, 2],
            command_protocol_versions: [1, 2],
            following_enabled: true,
            shared_analysis_enabled: false,
          },
          error: null,
        }
      return { data: receipt(), error: null }
    })
    const client = () =>
      createDictionaryFollowingImportClient({
        userId: OWNER,
        journal: journal(),
        remote: { rpc },
        enabled: () => true,
      })
    rpc.mockImplementationOnce(async () => ({
      data: {
        dictionary_content_protocol: 2,
        read_protocol_versions: [1, 2],
        command_protocol_versions: [1, 2],
        following_enabled: true,
        shared_analysis_enabled: false,
      },
      error: null,
    }))
    rpc.mockImplementationOnce(async () => {
      throw new Error('Lost reply')
    })
    await expect(client().deliver(operation(), owner)).rejects.toThrow(
      'Lost reply'
    )
    expect((await journal().list(OWNER))[0].result).toBeNull()
    const done = await client().deliver((await journal().list(OWNER))[0], owner)
    expect(done.result).toEqual(receipt())
    expect(values.get('legacy-transfer')).toBe(
      'preserved original private content'
    )
    expect([...values.values()].join('')).not.toContain('repetition_count')
  })

  it('serializes same-ID prepare across two tabs and rejects a changed intent', async () => {
    await Promise.all([
      journal().prepare(operation(), assertOwner),
      journal().prepare(operation(), assertOwner),
    ])
    expect(await journal().list(OWNER)).toHaveLength(1)
    await expect(
      journal().prepare(
        {
          ...operation(),
          request: { ...ROOT, collection_id: WORD },
        } as FollowingImportOperation,
        assertOwner
      )
    ).rejects.toThrow('already reserved')
  })

  it('rejects two root nonces for the same personal word instead of replacing the winner', async () => {
    const results = await Promise.allSettled([
      journal().prepare(operation(), assertOwner),
      journal().prepare(
        {
          ...operation(),
          request: { ...ROOT, operation_id: ENTRY },
        } as FollowingImportOperation,
        assertOwner
      ),
    ])
    expect(results.map(row => row.status)).toEqual(['fulfilled', 'rejected'])
    expect((await journal().list(OWNER))[0].request.operation_id).toBe(
      OPERATION
    )
  })

  it('keeps a pending intent when storage fails while saving its receipt', async () => {
    await journal().prepare(operation(), assertOwner)
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    await expect(
      journal().save(operation(), receipt(), assertOwner)
    ).rejects.toThrow('Quota exceeded')
    expect((await journal().list(OWNER))[0].result).toBeNull()
  })

  it('does not write on an owner change while waiting for the lock', async () => {
    await expect(
      journal().prepare(operation(), () => {
        throw new Error('Account changed')
      })
    ).rejects.toThrow('Account changed')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('retains immutable receipts while allowing an idempotent replay bit', async () => {
    await journal().prepare(operation(), assertOwner)
    const done = await journal().save(operation(), receipt(), assertOwner)
    expect(
      await journal().save(
        operation(),
        { ...receipt(), idempotent: true },
        assertOwner
      )
    ).toEqual(done)
    await expect(
      journal().save(
        operation(),
        { ...receipt(), applied_head_sequence: '9007199254740994' },
        assertOwner
      )
    ).rejects.toThrow('immutable')
  })

  it('fails closed on unknown versions, foreign owners and duplicate nonces', async () => {
    for (const value of [
      { protocol_version: 3, rows: [] },
      [{ ...operation(), user_id: OTHER }],
      [operation(), operation()],
    ]) {
      storage.getItem.mockReturnValueOnce(JSON.stringify(value))
      await expect(journal().list(OWNER)).rejects.toThrow()
    }
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('bounds retained commands without evicting previous operations or legacy storage', async () => {
    for (let index = 1; index <= 100; index++) {
      const suffix = index.toString(16).padStart(12, '0')
      const request = {
        ...ROOT,
        operation_id: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`,
        word_id: `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`,
      }
      await journal().prepare(
        { user_id: OWNER, kind: 'import', request, result: null },
        assertOwner
      )
    }
    const before = [...values]
    await expect(journal().prepare(operation(), assertOwner)).rejects.toThrow(
      'limit'
    )
    expect([...values]).toEqual(before)
  })
})
