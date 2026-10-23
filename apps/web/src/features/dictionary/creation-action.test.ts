import {
  createDictionaryCreationAction,
  dictionaryCreationMessage,
  parseCreationJournalRow,
  type DictionaryCreationService,
  type DictionaryCreationJournalRow,
} from '@woordenaar/domain'
import {
  CREATION_OWNER as OWNER,
  CREATION_OTHER as OTHER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationReceiptFixture as receipt,
  creationPublishedFixture as published,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'

const EXACT_HINT = '  A financial institution.  '
const ORIGINAL_HINT = 'Original hint'
const FAILED = /Saved requests are retained/
const make = (query = 'bank') => {
  let rows: DictionaryCreationJournalRow[] = []
  let invalid!: () => void
  let next = 100
  let enabled = true
  const saved = (row: DictionaryCreationJournalRow) => {
    rows = [
      ...rows.filter(
        r =>
          r.session.request.resolution_id !== row.session.request.resolution_id
      ),
      row,
    ]
    return row
  }
  const sdk = {
    list: jest.fn(async () => rows),
    readSaved: jest.fn(
      async (nonce: string) =>
        rows.find(row => row.session.request.resolution_id === nonce) ?? null
    ),
    isAvailable: jest.fn(async () => true),
    resolve: jest.fn(async (row: DictionaryCreationJournalRow) => saved(row)),
    recoverResolution: jest.fn(
      async (nonce: string) =>
        rows.find(row => row.session.request.resolution_id === nonce) ?? null
    ),
    prepareCommand: jest.fn(
      async (row: DictionaryCreationJournalRow, nonce: string) =>
        saved({
          ...row,
          session: {
            ...row.session,
            command: {
              protocol_version: 2 as const,
              resolution_id: row.session.request.resolution_id,
              operation_id: nonce,
            },
          },
        })
    ),
    submit: jest.fn(async (row: DictionaryCreationJournalRow) =>
      saved({ ...row, session: { ...row.session, submitted: true } })
    ),
    recover: jest.fn(
      async (nonce: string) =>
        rows.find(row => row.session.request.resolution_id === nonce) ?? null
    ),
  } satisfies DictionaryCreationService
  const guards: Array<{ assert: () => void; signal: AbortSignal }> = []
  const createId = jest.fn(() => id(++next))
  const unsubscribe = jest.fn()
  const action = createDictionaryCreationAction({
    userId: OWNER,
    originalQuery: query,
    createId,
    enabled: () => enabled,
    connect: (assert, signal) => {
      guards.push({ assert, signal })
      assert()
      return sdk
    },
  })
  const start = () =>
    action.start(fn => {
      invalid = fn
      return unsubscribe
    })
  return {
    action,
    sdk,
    saved,
    guards,
    createId,
    start,
    unsubscribe,
    invalidate: () => invalid(),
    setEnabled: (value: boolean) => {
      enabled = value
    },
  }
}
const settle = async () => {
  for (let n = 0; n < 12; n += 1) await Promise.resolve()
}
const submitted = () => {
  const row = prepared(initial())
  return { ...row, session: { ...row.session, submitted: true } }
}

it('has no I/O or nonce on construction and restores only local intent on mount', async () => {
  const h = make()
  expect(h.sdk.list).not.toHaveBeenCalled()
  await h.action.resolveNew('hint')
  expect(h.createId).not.toHaveBeenCalled()
  const stop = h.start()
  await settle()
  expect(h.action.getSnapshot().loaded).toBe(true)
  expect(h.sdk.list).toHaveBeenCalledTimes(1)
  expect(h.sdk.resolve).not.toHaveBeenCalled()
  expect(h.sdk.recover).not.toHaveBeenCalled()
  expect(h.createId).not.toHaveBeenCalled()
  stop()
})
it('restores original bytes, separate tags, then resolves only on an explicit action', async () => {
  const h = make('  BANK  ')
  h.start()
  await settle()
  await h.action.resolveNew(EXACT_HINT)
  const row = h.action.getSnapshot().rows[0]
  expect(parseCreationJournalRow(row)).toEqual(row)
  expect(row.session.request.original_query).toBe('  BANK  ')
  expect(row.session.request.meaning_hint).toBe(EXACT_HINT)
  expect(
    new Set([
      row.owner_epoch,
      row.session_epoch,
      row.session.request.resolution_id,
    ]).size
  ).toBe(3)
  expect(row.session.command).toBeNull()
  expect(row.adoption).toBeNull()
  expect(h.sdk.submit).not.toHaveBeenCalled()
})
it.each(['bank', ' BANK ', 'BaNk'])(
  'prevents a changed hint/new nonce for retained query variant %s',
  async query => {
    const h = make(query)
    h.saved(submitted())
    h.start()
    await settle()
    await h.action.resolveNew('A seat instead.')
    expect(h.createId).not.toHaveBeenCalled()
    expect(h.sdk.resolve).not.toHaveBeenCalled()
    expect(h.action.getSnapshot().rows[0].session.request.meaning_hint).toBe(
      'A financial institution.'
    )
  }
)
it('re-reads durable intent before creating a request to catch another tab/device-local view', async () => {
  const h = make()
  h.start()
  await settle()
  h.saved(submitted())
  await h.action.resolveNew('Different hint')
  expect(h.createId).not.toHaveBeenCalled()
  expect(h.action.getSnapshot().selectedId).toBe(
    initial().session.request.resolution_id
  )
})
it('fails closed on initial storage failure, allowing only explicit local restore', async () => {
  const h = make()
  h.sdk.list.mockRejectedValue(new Error('Storage unavailable'))
  h.start()
  await settle()
  expect(h.action.getSnapshot().loaded).toBe(false)
  await h.action.resolveNew('hint')
  expect(h.createId).not.toHaveBeenCalled()
  h.sdk.list.mockResolvedValue([])
  await h.action.restore()
  expect(h.action.getSnapshot().loaded).toBe(true)
})
it('retains a request committed before a lost resolution response', async () => {
  const h = make()
  h.start()
  await settle()
  h.sdk.resolve.mockImplementation(async row => {
    h.saved(row)
    throw new Error('Lost')
  })
  await h.action.resolveNew(ORIGINAL_HINT)
  const row = h.action.getSnapshot().rows[0]
  expect(h.action.getSnapshot().error).toMatch(FAILED)
  await h.action.resolveNew('Replacement hint')
  expect(h.sdk.resolve).toHaveBeenCalledTimes(1)
  await h.action.resolveSaved()
  expect(h.sdk.resolve.mock.calls[1][0]).toEqual(row)
  expect(h.createId).toHaveBeenCalledTimes(3)
})
it('retains the in-memory original when both lost-response recovery and storage fail', async () => {
  const h = make()
  h.start()
  await settle()
  h.sdk.resolve.mockImplementation(async row => {
    h.saved(row)
    h.sdk.list.mockRejectedValue(new Error('Storage'))
    throw new Error('Lost')
  })
  await h.action.resolveNew(ORIGINAL_HINT)
  expect(h.action.getSnapshot().rows[0].session.request.meaning_hint).toBe(
    ORIGINAL_HINT
  )
  expect(h.action.getSnapshot().loaded).toBe(false)
  await h.action.resolveNew('Replacement')
  expect(h.createId).toHaveBeenCalledTimes(3)
  expect(h.sdk.submit).not.toHaveBeenCalled()
})
it('checks pending resolution without another request and continues the same saved request explicitly', async () => {
  const h = make()
  h.saved(initial())
  h.start()
  await settle()
  await h.action.checkStatus()
  expect(h.sdk.recoverResolution).toHaveBeenCalledWith(
    initial().session.request.resolution_id
  )
  expect(h.sdk.resolve).not.toHaveBeenCalled()
  await h.action.resolveSaved()
  expect(h.sdk.resolve).toHaveBeenCalledWith(initial())
  expect(h.createId).not.toHaveBeenCalled()
})
it('uses a new operation nonce only after resolved identity, preserving publication/adoption separation', async () => {
  const h = make()
  const row = prepared(initial())
  row.session.command = null
  h.saved(row)
  h.start()
  await settle()
  await h.action.create()
  expect(h.sdk.prepareCommand).toHaveBeenCalledWith(row, id(101))
  expect(h.sdk.submit).toHaveBeenCalledTimes(1)
  expect(h.action.getSnapshot().rows[0].session.submitted).toBe(true)
  expect(h.action.getSnapshot().rows[0].adoption).toBeNull()
  await h.action.create()
  expect(h.sdk.submit).toHaveBeenCalledTimes(1)
  expect(h.createId).toHaveBeenCalledTimes(1)
})
it('uses a retained prepared command without minting another operation', async () => {
  const h = make()
  h.saved(prepared(initial()))
  h.start()
  await settle()
  await h.action.create()
  expect(h.sdk.submit).toHaveBeenCalledWith(prepared(initial()))
  expect(h.sdk.prepareCommand).not.toHaveBeenCalled()
  expect(h.createId).not.toHaveBeenCalled()
})
it('restores a submitted claim after a lost invoke reply and uses only status', async () => {
  const h = make()
  h.saved(prepared(initial()))
  h.start()
  await settle()
  h.sdk.submit.mockImplementation(async row => {
    h.saved({ ...row, session: { ...row.session, submitted: true } })
    throw new Error('Lost invoke')
  })
  await h.action.create()
  expect(h.action.getSnapshot().rows[0].session.submitted).toBe(true)
  await h.action.create()
  await h.action.resolveNew('Other')
  await h.action.checkStatus()
  expect(h.sdk.submit).toHaveBeenCalledTimes(1)
  expect(h.sdk.recover).toHaveBeenCalledWith(
    initial().session.request.resolution_id
  )
  expect(h.createId).not.toHaveBeenCalled()
})
it.each([
  'provider-outcome-unknown',
  'provider-failed',
  'review-required',
  'rejected',
  'identity-conflict',
  'authorization-revoked',
] as const)(
  'restores %s without automatic retry or a new command',
  async status => {
    const h = make()
    const row = submitted()
    row.session.response = receipt(row, {
      status,
      error_code: status,
      result_sha256: status === 'review-required' ? 'a'.repeat(64) : null,
    })
    h.saved(row)
    h.setEnabled(false)
    h.start()
    await settle()
    expect(h.sdk.recover).not.toHaveBeenCalled()
    await h.action.checkStatus()
    await h.action.create()
    await h.action.resolveNew('Replacement')
    expect(h.sdk.recover).toHaveBeenCalledTimes(1)
    expect(h.sdk.submit).not.toHaveBeenCalled()
    expect(h.createId).not.toHaveBeenCalled()
    expect(dictionaryCreationMessage(row)).not.toMatch(/Try again|Retry/i)
  }
)
it('disables new work but keeps explicit resolution/status reads when gates are OFF', async () => {
  const h = make()
  h.saved(initial())
  h.setEnabled(false)
  h.start()
  await settle()
  await h.action.resolveSaved()
  await h.action.create()
  await h.action.checkStatus()
  expect(h.sdk.resolve).not.toHaveBeenCalled()
  expect(h.sdk.recoverResolution).toHaveBeenCalledTimes(1)
})
it('coalesces double clicks while a request is unresolved', async () => {
  const h = make()
  h.start()
  await settle()
  let finish!: (row: DictionaryCreationJournalRow) => void
  h.sdk.resolve.mockImplementation(
    row =>
      new Promise(resolve => {
        h.saved(row)
        finish = resolve
      })
  )
  const pending = h.action.resolveNew('hint')
  await settle()
  await h.action.resolveNew('another')
  expect(h.sdk.resolve).toHaveBeenCalledTimes(1)
  finish(h.action.getSnapshot().rows[0])
  await pending
})
it('aborts a pending dispatch and cannot continue after an A-B-A invalidation', async () => {
  const h = make()
  h.saved(prepared(initial()))
  h.start()
  await settle()
  let finish!: (row: DictionaryCreationJournalRow) => void
  h.sdk.submit.mockImplementation(
    row =>
      new Promise(resolve => {
        finish = resolve
        h.saved({ ...row, session: { ...row.session, submitted: true } })
      })
  )
  const pending = h.action.create()
  await settle()
  const guard = h.guards.at(-1)!
  h.invalidate()
  h.invalidate()
  expect(guard.signal.aborted).toBe(true)
  expect(guard.assert).toThrow()
  finish(submitted())
  await pending
  expect(h.action.getSnapshot()).toMatchObject({
    blocked: true,
    rows: [],
    busy: false,
  })
  await h.action.create()
  await h.action.checkStatus()
  expect(h.sdk.submit).toHaveBeenCalledTimes(1)
  expect(h.sdk.recover).not.toHaveBeenCalled()
})
it('drops stale list replies and provides fresh non-aborted lifecycle in Strict Mode setup-cleanup-setup', async () => {
  const h = make()
  let finish!: (rows: DictionaryCreationJournalRow[]) => void
  h.sdk.list.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  const stop = h.start()
  const old = h.guards[0]
  stop()
  h.start()
  await settle()
  const latest = h.guards.at(-1)!
  expect(old.signal.aborted).toBe(true)
  expect(latest.signal.aborted).toBe(false)
  finish([submitted()])
  await settle()
  expect(h.action.getSnapshot().rows).toEqual([])
  expect(h.action.getSnapshot().loaded).toBe(true)
  expect(h.unsubscribe).toHaveBeenCalledTimes(1)
})
it('cancels between command preparation and invocation without deleting the prepared command', async () => {
  const h = make()
  const row = prepared(initial())
  row.session.command = null
  h.saved(row)
  const stop = h.start()
  await settle()
  h.sdk.prepareCommand.mockImplementation(async (value, nonce) => {
    const next = {
      ...value,
      session: {
        ...value.session,
        command: {
          protocol_version: 2 as const,
          resolution_id: value.session.request.resolution_id,
          operation_id: nonce,
        },
      },
    }
    h.saved(next)
    stop()
    return next
  })
  await h.action.create()
  expect(h.sdk.submit).not.toHaveBeenCalled()
  h.start()
  await settle()
  expect(h.action.getSnapshot().rows[0].session.command).not.toBeNull()
})
it('refuses foreign/corrupt owner rows and never invokes a creation from them', async () => {
  const h = make()
  const row = initial()
  row.session.user_id = OTHER
  h.saved(row)
  h.start()
  await settle()
  expect(h.action.getSnapshot().loaded).toBe(false)
  await h.action.create()
  expect(h.sdk.submit).not.toHaveBeenCalled()
})
it('fails closed on a malformed mutation reply, recovering only trusted local bytes', async () => {
  const h = make()
  h.start()
  await settle()
  h.sdk.resolve.mockImplementation(async row => {
    h.saved(row)
    return {
      ...row,
      protocol_version: 3,
    } as unknown as DictionaryCreationJournalRow
  })
  await h.action.resolveNew('hint')
  expect(h.action.getSnapshot().rows[0].protocol_version).toBe(1)
  expect(h.action.getSnapshot().error).toMatch(FAILED)
})
it('publication message does not claim personal adoption, and no refresh invokes a new dispatch', async () => {
  const h = make()
  const row = published(submitted())
  h.saved(row)
  h.start()
  await settle()
  expect(dictionaryCreationMessage(row)).toMatch(/separate action/)
  await h.action.checkStatus()
  expect(h.action.getSnapshot().rows[0].adoption).toBeNull()
  expect(h.sdk.submit).not.toHaveBeenCalled()
})
it('keeps requests for other words available for explicit selection', async () => {
  const h = make('huis')
  h.saved(submitted())
  h.start()
  await settle()
  expect(h.action.getSnapshot().selectedId).toBeNull()
  h.action.select(initial().session.request.resolution_id)
  await h.action.checkStatus()
  expect(h.sdk.recover).toHaveBeenCalledTimes(1)
})
