import {
  createDictionaryAnalysisClient,
  type DictionaryAnalysisClientOperation,
  type DictionaryAnalysisReceiptV2,
} from '@woordenaar/domain'
import {
  createBrowserAnalysisJournal,
  createBrowserDictionaryAnalysisJournal,
} from './analysis-journal'

const OWNER_A = '11111111-1111-4111-8111-111111111111'
const OWNER_B = '22222222-2222-4222-8222-222222222222'
const WORD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WORD = 'abababab-abab-4bab-8bab-abababababab'
const OP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const NEXT_OP = 'dededede-dede-4ede-8ede-dededededede'
const intent = (): DictionaryAnalysisClientOperation => ({
  user_id: OWNER_A,
  word_id: WORD,
  submitted: false,
  response: null,
  command: {
    protocol_version: 2,
    operation_id: OP,
    entry_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    expected_revision_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    expected_head_sequence: '9007199254740993',
  },
})
const receipt = (): DictionaryAnalysisReceiptV2 => ({
  ...intent().command,
  fence: '9007199254740997',
  status: 'published',
  quota_charged: true,
  result_sha256: 'a'.repeat(64),
  error_code: null,
  published_revision_id: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
  published_head_sequence: '9007199254740994',
})
const AUTH_CHANGED = 'Authentication changed'
const owner = { assert: jest.fn(), check: jest.fn(async () => {}) }
const noop = () => {}

// Models the LockManager's exclusive scheduling across independent tab instances.
// Actual browser storage retention, Web Locks and device latency are separate gates.
describe('browser shared analysis durable operation journal', () => {
  let values: Map<string, string>
  let storage: { getItem: jest.Mock; setItem: jest.Mock }
  let queue: Promise<void>
  let assertHead: jest.Mock
  const withLock = async <T>(
    _name: string,
    action: () => Promise<T>
  ): Promise<T> => {
    const previous = queue
    let release = () => {}
    queue = new Promise<void>(resolve => {
      release = resolve
    })
    await previous
    try {
      return await action()
    } finally {
      release()
    }
  }
  const journal = () =>
    createBrowserDictionaryAnalysisJournal({ storage, withLock, assertHead })
  const ports = () => ({
    userId: OWNER_A,
    journal: journal(),
    requireAvailable: jest.fn(async () => {}),
    submit: jest.fn(async () => receipt()),
    readReceipt: jest.fn(async () => receipt()),
    refresh: jest.fn(async () => {}),
  })
  beforeEach(() => {
    jest.clearAllMocks()
    owner.assert.mockImplementation(noop)
    owner.check.mockImplementation(async () => {})
    values = new Map()
    storage = {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        values.set(key, value)
      }),
    }
    queue = Promise.resolve()
    assertHead = jest.fn(async () => {})
  })

  it('submits once across two tabs, with owner-scoped metadata saved before dispatch', async () => {
    const first = ports(),
      second = ports()
    first.submit.mockImplementation(async () => {
      expect((await journal().read(OWNER_A, WORD))?.submitted).toBe(true)
      return receipt()
    })
    const other = intent()
    other.command.operation_id = NEXT_OP
    const results = await Promise.all([
      createDictionaryAnalysisClient(first).submit(intent(), owner),
      createDictionaryAnalysisClient(second).submit(other, owner),
    ])
    expect(
      first.submit.mock.calls.length + second.submit.mock.calls.length
    ).toBe(1)
    expect(results.every(row => row.command.operation_id === OP)).toBe(true)
    expect((await journal().read(OWNER_A, WORD))?.response).toEqual(receipt())
    expect(await journal().read(OWNER_B, WORD)).toBeNull()
    expect([...values.values()].join('')).not.toContain('access_token')
  })

  it('atomically archives and replaces once across competing tabs, and preserves legacy array until archive', async () => {
    await journal().prepare(intent(), noop)
    await journal().claim(intent(), noop)
    const previous = await journal().save(intent(), receipt(), noop)
    const key = [...values.keys()][0]
    expect(Array.isArray(JSON.parse(values.get(key)!))).toBe(true)
    const next = intent()
    next.command.operation_id = NEXT_OP
    next.command.expected_revision_id = receipt().published_revision_id!
    next.command.expected_head_sequence = receipt().published_head_sequence!
    const results = await Promise.allSettled([
      journal().replace(previous, next, noop),
      journal().replace(previous, next, noop),
    ])
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    expect(await journal().read(OWNER_A, WORD)).toEqual(next)
    expect(await journal().history(OWNER_A, WORD)).toEqual([previous])
    expect(await journal().history(OWNER_B, WORD)).toEqual([])
    expect(JSON.parse(values.get(key)!)).toEqual({
      protocol_version: 3,
      active: [next],
      archived: [previous],
    })
    const before = values.get(key)
    await journal().history(OWNER_A, WORD)
    expect(values.get(key)).toBe(before)
    await expect(
      journal().prepare({ ...intent(), word_id: OTHER_WORD }, noop)
    ).rejects.toThrow('reserved')
  })

  it.each(['storage', 'head', 'owner'] as const)(
    'preserves both sides of archive on %s failure',
    async failure => {
      await journal().prepare(intent(), noop)
      await journal().claim(intent(), noop)
      const previous = await journal().save(intent(), receipt(), noop)
      const before = [...values.entries()]
      const next = intent()
      next.command.operation_id = NEXT_OP
      next.command.expected_revision_id = receipt().published_revision_id!
      next.command.expected_head_sequence = receipt().published_head_sequence!
      let assertOwner = noop
      if (failure === 'storage')
        storage.setItem.mockImplementation(() => {
          throw new Error('Synthetic storage failure')
        })
      if (failure === 'head')
        assertHead.mockRejectedValue(new Error('Synthetic head failure'))
      if (failure === 'owner')
        assertHead.mockImplementation(async () => {
          assertOwner = () => {
            throw new Error(AUTH_CHANGED)
          }
        })
      await expect(
        journal().replace(previous, next, () => assertOwner())
      ).rejects.toThrow()
      expect([...values.entries()]).toEqual(before)
      expect(await journal().history(OWNER_A, WORD)).toEqual([])
    }
  )

  it('checks an authoritative receipt before next dispatch and never clears lost/quarantined receipts', async () => {
    const current = ports()
    const client = createDictionaryAnalysisClient(current)
    const previous = await client.submit(intent(), owner)
    const next = intent()
    next.command.operation_id = NEXT_OP
    next.command.expected_revision_id = receipt().published_revision_id!
    next.command.expected_head_sequence = receipt().published_head_sequence!
    current.readReceipt.mockResolvedValue(
      null as unknown as DictionaryAnalysisReceiptV2
    )
    await expect(client.nextAttempt(previous, next, owner)).rejects.toThrow(
      'unresolved'
    )
    expect(current.submit).toHaveBeenCalledTimes(1)
    expect(await journal().history(OWNER_A, WORD)).toEqual([])
    current.readReceipt.mockResolvedValue(receipt())
    current.submit.mockResolvedValue({
      ...receipt(),
      ...next.command,
      status: 'accepted',
      result_sha256: null,
      published_revision_id: null,
      published_head_sequence: null,
    })
    const result = await client.nextAttempt(previous, next, owner)
    expect(result.command.operation_id).toBe(NEXT_OP)
    expect(current.submit).toHaveBeenCalledTimes(2)
    expect(await journal().history(OWNER_A, WORD)).toEqual([previous])
  })

  it('rejects a corrupt archive or archive capacity without evicting prior IDs', async () => {
    await journal().prepare(intent(), noop)
    await journal().claim(intent(), noop)
    const previous = await journal().save(intent(), receipt(), noop)
    const key = [...values.keys()][0]
    const valid = values.get(key)!
    values.set(
      key,
      JSON.stringify({
        protocol_version: 3,
        active: [previous],
        archived: [{ ...intent(), submitted: true }],
      })
    )
    await expect(journal().history(OWNER_A, WORD)).rejects.toThrow('identity')
    expect(values.get(key)).not.toBe(valid)
    const rows = Array.from({ length: 100 }, (_, index) => ({
      ...previous,
      word_id: `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, '0')}`,
      command: {
        ...previous.command,
        operation_id: `dddddddd-dddd-4ddd-8ddd-${index.toString(16).padStart(12, '0')}`,
      },
      response: {
        ...receipt(),
        operation_id: `dddddddd-dddd-4ddd-8ddd-${index.toString(16).padStart(12, '0')}`,
      },
    }))
    values.set(key, JSON.stringify(rows))
    const next = {
      ...intent(),
      word_id: rows[0].word_id,
      command: {
        ...intent().command,
        operation_id: NEXT_OP,
        expected_revision_id: receipt().published_revision_id!,
        expected_head_sequence: receipt().published_head_sequence!,
      },
    }
    const before = values.get(key)
    await expect(journal().replace(rows[0], next, noop)).rejects.toThrow(
      'limit'
    )
    expect(values.get(key)).toBe(before)
  })

  it('recovers a lost reply through a new journal instance without dispatch or availability checks', async () => {
    const original = ports()
    original.submit.mockRejectedValue(new Error('Reply lost'))
    await expect(
      createDictionaryAnalysisClient(original).submit(intent(), owner)
    ).rejects.toThrow('Reply lost')
    const restored = ports()
    restored.requireAvailable.mockRejectedValue(new Error('Permission revoked'))
    const saved = await createDictionaryAnalysisClient(restored).recover(
      OWNER_A,
      WORD,
      owner
    )
    expect(saved?.response).toEqual(receipt())
    expect(restored.submit).not.toHaveBeenCalled()
    expect(restored.requireAvailable).not.toHaveBeenCalled()
    expect(restored.readReceipt).toHaveBeenCalledWith(OP, owner)
  })

  it('keeps uncertain submitted intent on null receipt, with no new operation replacement', async () => {
    const original = ports()
    original.submit.mockRejectedValue(new Error('Reply lost'))
    await expect(
      createDictionaryAnalysisClient(original).submit(intent(), owner)
    ).rejects.toThrow()
    const restored = ports()
    restored.readReceipt.mockResolvedValue(
      null as unknown as DictionaryAnalysisReceiptV2
    )
    const other = intent()
    other.command.operation_id = NEXT_OP
    const saved = await createDictionaryAnalysisClient(restored).submit(
      other,
      owner
    )
    expect(saved.command.operation_id).toBe(OP)
    expect(saved.submitted).toBe(true)
    expect(saved.response).toBeNull()
    expect(restored.submit).not.toHaveBeenCalled()
  })

  it('retains published receipt before refresh failure and retries only reading/hydration', async () => {
    const original = ports()
    original.refresh.mockRejectedValueOnce(new Error('Offline'))
    const controller = createDictionaryAnalysisClient(original)
    await expect(controller.submit(intent(), owner)).rejects.toThrow('Offline')
    expect((await journal().read(OWNER_A, WORD))?.response).toEqual(receipt())
    await controller.recover(OWNER_A, WORD, owner)
    expect(original.submit).toHaveBeenCalledTimes(1)
    expect(original.refresh).toHaveBeenCalledTimes(2)
  })

  it.each([1, 2])(
    'fails before dispatch if durable storage fails on write %s',
    async writeNumber => {
      let writes = 0
      storage.setItem.mockImplementation((key: string, value: string) => {
        if (++writes === writeNumber) throw new Error('Storage unavailable')
        values.set(key, value)
      })
      const current = ports()
      await expect(
        createDictionaryAnalysisClient(current).submit(intent(), owner)
      ).rejects.toThrow('Storage unavailable')
      expect(current.submit).not.toHaveBeenCalled()
    }
  )

  it('rejects stale shared head at claim after preparation without setting submitted', async () => {
    await journal().prepare(intent(), noop)
    assertHead.mockRejectedValue(new Error('Head changed'))
    const current = ports()
    await expect(
      createDictionaryAnalysisClient(current).submit(intent(), owner)
    ).rejects.toThrow('Head changed')
    expect((await journal().read(OWNER_A, WORD))?.submitted).toBe(false)
    expect(current.submit).not.toHaveBeenCalled()
  })

  it('rejects an operation ID already reserved for another word', async () => {
    await journal().prepare(intent(), noop)
    await expect(
      journal().prepare({ ...intent(), word_id: OTHER_WORD }, noop)
    ).rejects.toThrow('already reserved')
    expect(await journal().read(OWNER_A, OTHER_WORD)).toBeNull()
  })

  it('rejects foreign owner and duplicate/corrupt journal identities before dispatch', async () => {
    await journal().prepare(intent(), noop)
    const key = [...values.keys()][0]
    for (const corrupt of [
      '{',
      JSON.stringify([{ ...intent(), user_id: OWNER_B }]),
      JSON.stringify([intent(), intent()]),
      JSON.stringify([{ ...intent(), role: 'admin' }]),
    ]) {
      values.set(key, corrupt)
      const current = ports()
      await expect(
        createDictionaryAnalysisClient(current).submit(intent(), owner)
      ).rejects.toThrow()
      expect(current.submit).not.toHaveBeenCalled()
    }
  })

  it('keeps prior terminal receipt when read recovery regresses or returns null', async () => {
    const current = ports()
    const controller = createDictionaryAnalysisClient(current)
    await controller.submit(intent(), owner)
    current.readReceipt.mockResolvedValue({
      ...receipt(),
      status: 'head-conflict',
      error_code: 'head-conflict',
      published_revision_id: null,
      published_head_sequence: null,
    })
    await expect(controller.recover(OWNER_A, WORD, owner)).rejects.toThrow(
      'Terminal'
    )
    current.readReceipt.mockResolvedValue(
      null as unknown as DictionaryAnalysisReceiptV2
    )
    await expect(controller.recover(OWNER_A, WORD, owner)).rejects.toThrow(
      'unavailable'
    )
    expect((await journal().read(OWNER_A, WORD))?.response).toEqual(receipt())
  })

  it('stops before dispatch when the captured owner changes during preparation', async () => {
    assertHead.mockImplementation(async () => {
      owner.assert.mockImplementation(() => {
        throw new Error(AUTH_CHANGED)
      })
    })
    const current = ports()
    await expect(
      createDictionaryAnalysisClient(current).submit(intent(), owner)
    ).rejects.toThrow(AUTH_CHANGED)
    expect(current.submit).not.toHaveBeenCalled()
    expect(values.size).toBe(0)
  })

  it('checks the owner again when an asynchronous read finds no local operation', async () => {
    const current = ports()
    current.journal.read = async () => {
      owner.assert.mockImplementation(() => {
        throw new Error(AUTH_CHANGED)
      })
      return null
    }
    await expect(
      createDictionaryAnalysisClient(current).recover(OWNER_A, WORD, owner)
    ).rejects.toThrow(AUTH_CHANGED)
    expect(current.readReceipt).not.toHaveBeenCalled()
  })

  it('never evicts old operation identities when journal size limits are reached', async () => {
    await journal().prepare(intent(), noop)
    const key = [...values.keys()][0]
    values.set(key, ' '.repeat(256001))
    await expect(journal().read(OWNER_A, WORD)).rejects.toThrow('limit')
    expect(values.get(key)).toHaveLength(256001)
  })

  it('binds the production journal to exclusive Web Locks and browser storage', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
    const request = jest.fn(
      async (
        _name: string,
        _options: unknown,
        action: () => Promise<unknown>
      ) => action()
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    })
    window.localStorage.clear()
    try {
      const production = createBrowserAnalysisJournal(async () => {})
      await production.prepare(intent(), noop)
      expect(await production.claim(intent(), noop)).toBe(true)
      expect(request).toHaveBeenCalledTimes(2)
      expect(
        request.mock.calls.every(
          ([name, options]) =>
            name === `dictionary-analysis-v2:${OWNER_A}` &&
            JSON.stringify(options) === JSON.stringify({ mode: 'exclusive' })
        )
      ).toBe(true)
      expect(
        (await createBrowserAnalysisJournal(async () => {}).read(OWNER_A, WORD))
          ?.submitted
      ).toBe(true)
    } finally {
      window.localStorage.clear()
      if (descriptor) Object.defineProperty(navigator, 'locks', descriptor)
      else Reflect.deleteProperty(navigator, 'locks')
    }
  })

  it('fails closed when Web Locks are unavailable', () => {
    expect(() => createBrowserAnalysisJournal(async () => {})).toThrow(
      'unavailable'
    )
  })
})
