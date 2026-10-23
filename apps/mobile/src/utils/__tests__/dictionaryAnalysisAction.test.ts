import {
  createDictionaryAnalysisAction,
  dictionaryAnalysisActionMessage,
  isDictionaryAnalysisContentCurrent,
  type DictionaryAnalysisClientOperation,
  DICTIONARY_ANALYSIS_STATUSES,
} from '@woordenaar/domain'
import {
  analysisIntent,
  analysisReceipt,
  NEXT_ANALYSIS_ID,
} from '@/db/__tests__/dictionaryAnalysis.fixture'
import { OWNER_A, WORD_A } from '@/db/__tests__/dictionaryFollowing.fixture'

const LOST_REPLY = 'synthetic reply lost'
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
const saved = (): DictionaryAnalysisClientOperation => ({
  ...analysisIntent(),
  submitted: true,
  response: analysisReceipt(),
})
function ports() {
  return {
    userId: OWNER_A,
    wordId: WORD_A,
    readSaved: jest.fn(
      async (): Promise<DictionaryAnalysisClientOperation | null> => null
    ),
    isAvailable: jest.fn(async () => true),
    createIntent: jest.fn(analysisIntent),
    submit: jest.fn(async () => saved()),
    recover: jest.fn(
      async (): Promise<DictionaryAnalysisClientOperation | null> => saved()
    ),
  }
}
describe('shared analysis action lifetime and explicit dispatch', () => {
  it('gates a distinct explicit next attempt and reloads local history without automatic submission', async () => {
    const previous = saved()
    const candidate = {
      ...analysisIntent(),
      command: { ...analysisIntent().command, operation_id: NEXT_ANALYSIS_ID },
    }
    const p = {
      ...ports(),
      nextAttempt: jest.fn(async () => ({
        ...candidate,
        submitted: true,
        response: {
          ...analysisReceipt('accepted'),
          operation_id: NEXT_ANALYSIS_ID,
        },
      })),
      readHistory: jest.fn(async () => [previous]),
    }
    p.readSaved.mockResolvedValue(previous)
    p.createIntent.mockReturnValue(candidate)
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    expect(action.getSnapshot().nextAllowed).toBe(true)
    expect(p.nextAttempt).not.toHaveBeenCalled()
    expect(p.readHistory).not.toHaveBeenCalled()
    await action.loadHistory()
    const next = action.nextAttempt()
    await action.nextAttempt()
    await next
    expect(p.nextAttempt).toHaveBeenCalledTimes(1)
    expect(p.nextAttempt).toHaveBeenCalledWith(previous, candidate)
    expect(p.submit).not.toHaveBeenCalled()
    expect(action.getSnapshot().history).toEqual([previous])
    expect(action.getSnapshot().nextAllowed).toBe(false)
    close()
  })
  it('retains read-only checking and history when fresh attempts lose permission', async () => {
    const p = {
      ...ports(),
      nextAttempt: jest.fn(async () => saved()),
      readHistory: jest.fn(async () => [saved()]),
    }
    p.readSaved.mockResolvedValue(saved())
    p.isAvailable.mockResolvedValue(false)
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    await action.nextAttempt()
    await action.loadHistory()
    await action.recover()
    expect(p.nextAttempt).not.toHaveBeenCalled()
    expect(p.recover).toHaveBeenCalledTimes(1)
    expect(action.getSnapshot().history).toEqual([saved()])
    close()
  })
  it('ignores a history read completed after account change', async () => {
    let finish = (_rows: DictionaryAnalysisClientOperation[]) => {}
    const p = {
      ...ports(),
      readHistory: jest.fn(
        () =>
          new Promise<DictionaryAnalysisClientOperation[]>(resolve => {
            finish = resolve
          })
      ),
    }
    let invalidate = () => {}
    const action = createDictionaryAnalysisAction(p),
      close = action.start(callback => {
        invalidate = callback
        return () => {}
      })
    await settle()
    const pending = action.loadHistory()
    invalidate()
    finish([saved()])
    await pending
    expect(action.getSnapshot().history).toBeNull()
    expect(action.getSnapshot().operation).toBeNull()
    close()
  })
  it('preserves a newly archived/unsubmitted intent when the subsequent dispatch fails', async () => {
    const candidate = {
      ...analysisIntent(),
      command: { ...analysisIntent().command, operation_id: NEXT_ANALYSIS_ID },
    }
    const p = {
      ...ports(),
      nextAttempt: jest.fn(async () => {
        throw new Error(LOST_REPLY)
      }),
    }
    p.readSaved.mockResolvedValueOnce(saved()).mockResolvedValue(candidate)
    p.createIntent.mockReturnValue(candidate)
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    await action.nextAttempt()
    expect(action.getSnapshot().operation).toEqual(candidate)
    await action.nextAttempt()
    expect(p.nextAttempt).toHaveBeenCalledTimes(1)
    close()
  })
  it('mount reads local metadata and eligibility, never endpoint or receipt RPC', async () => {
    const p = ports(),
      action = createDictionaryAnalysisAction(p)
    const close = action.start(() => () => {})
    await settle()
    expect(action.getSnapshot().allowed).toBe(true)
    expect(p.submit).not.toHaveBeenCalled()
    expect(p.recover).not.toHaveBeenCalled()
    expect(p.createIntent).not.toHaveBeenCalled()
    close()
  })
  it('serializes rapid explicit presses before rendering a disabled button', async () => {
    const p = ports()
    let finish = (_value: DictionaryAnalysisClientOperation) => {}
    p.submit.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const action = createDictionaryAnalysisAction(p)
    const close = action.start(() => () => {})
    await settle()
    const first = action.submit()
    await action.submit()
    expect(action.getSnapshot().busy).toBe(true)
    expect(p.submit).toHaveBeenCalledTimes(1)
    expect(p.createIntent).toHaveBeenCalledTimes(1)
    finish(saved())
    await first
    await action.submit()
    expect(p.submit).toHaveBeenCalledTimes(1)
    close()
  })
  it.each(DICTIONARY_ANALYSIS_STATUSES)(
    'submitted %s permits only explicit reads after revocation',
    async status => {
      const p = ports(),
        operation = { ...saved(), response: analysisReceipt(status) }
      p.readSaved.mockResolvedValue(operation)
      p.isAvailable.mockResolvedValue(false)
      p.recover.mockResolvedValue(operation)
      const action = createDictionaryAnalysisAction(p),
        close = action.start(() => () => {})
      await settle()
      await action.submit()
      expect(p.isAvailable).not.toHaveBeenCalled()
      expect(p.submit).not.toHaveBeenCalled()
      await action.recover()
      expect(p.recover).toHaveBeenCalledTimes(1)
      expect(
        dictionaryAnalysisActionMessage(action.getSnapshot().operation)
      ).toBeTruthy()
      close()
    }
  )
  it('retains unknown reply and never generates another nonce or automatically retries', async () => {
    const p = ports(),
      action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    const unknown = { ...analysisIntent(), submitted: true }
    p.readSaved.mockResolvedValue(unknown)
    p.submit.mockRejectedValue(new Error(LOST_REPLY))
    await action.submit()
    expect(action.getSnapshot().operation).toEqual(unknown)
    expect(action.getSnapshot().error).not.toContain(LOST_REPLY)
    await action.submit()
    await action.recover()
    expect(p.submit).toHaveBeenCalledTimes(1)
    expect(p.createIntent).toHaveBeenCalledTimes(1)
    close()
  })
  it('resumes only an explicit unsubmitted original intent', async () => {
    const p = ports(),
      original = analysisIntent()
    p.readSaved.mockResolvedValue(original)
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    await action.recover()
    await action.submit()
    expect(p.createIntent).not.toHaveBeenCalled()
    expect(p.submit).toHaveBeenCalledWith(original)
    expect(p.recover).not.toHaveBeenCalled()
    close()
  })
  it.each(['unmount', 'account-change'])(
    'ignores late reply after %s and clears private metadata on account change',
    async event => {
      const p = ports()
      let finish = (_value: DictionaryAnalysisClientOperation) => {}
      p.submit.mockImplementation(
        () =>
          new Promise(resolve => {
            finish = resolve
          })
      )
      const action = createDictionaryAnalysisAction(p)
      let invalidate = () => {}
      const unsubscribe = jest.fn()
      const close = action.start(callback => {
        invalidate = callback
        return unsubscribe
      })
      await settle()
      const first = action.submit()
      if (event === 'unmount') close()
      else invalidate()
      finish(saved())
      await first
      expect(action.getSnapshot().operation).toBeNull()
      expect(() => action.assertCurrent()).toThrow()
      if (event === 'account-change') {
        expect(action.getSnapshot().blocked).toBe(true)
        await action.recover()
        await action.submit()
        expect(p.recover).not.toHaveBeenCalled()
        close()
      }
      expect(unsubscribe).toHaveBeenCalledTimes(1)
    }
  )
  it('ignores initial stale metadata and supports effect cleanup/restart', async () => {
    const p = ports()
    let finish = (_value: DictionaryAnalysisClientOperation | null) => {}
    p.readSaved.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    close()
    const again = action.start(() => () => {})
    await settle()
    finish(saved())
    await settle()
    expect(action.getSnapshot().operation).toBeNull()
    expect(action.getSnapshot().allowed).toBe(true)
    again()
  })
  it.each(['foreign-owner', 'foreign-word', 'corrupt', 'storage-failure'])(
    'blocks %s saved metadata without any submit or receipt read',
    async kind => {
      const p = ports()
      if (kind === 'storage-failure')
        p.readSaved.mockRejectedValue(new Error('synthetic storage'))
      else {
        const operation = analysisIntent()
        if (kind === 'foreign-owner')
          operation.user_id = operation.command.operation_id
        else if (kind === 'foreign-word')
          operation.word_id = operation.command.operation_id
        else operation.command.expected_head_sequence = '1.5'
        p.readSaved.mockResolvedValue(operation)
      }
      const action = createDictionaryAnalysisAction(p),
        close = action.start(() => () => {})
      await settle()
      await action.submit()
      await action.recover()
      expect(action.getSnapshot().error).toBeTruthy()
      expect(p.submit).not.toHaveBeenCalled()
      expect(p.recover).not.toHaveBeenCalled()
      close()
    }
  )
  it('reports unavailable fresh action without enabling or constructing a new intent', async () => {
    const p = ports()
    p.isAvailable.mockResolvedValue(false)
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    await action.submit()
    await action.recover()
    expect(action.getSnapshot().allowed).toBe(false)
    expect(p.submit).not.toHaveBeenCalled()
    expect(p.createIntent).not.toHaveBeenCalled()
    close()
  })
  it('notifies stable snapshots and unsubscribes listeners', async () => {
    const action = createDictionaryAnalysisAction(ports()),
      listener = jest.fn()
    const unsubscribe = action.subscribe(listener),
      close = action.start(() => () => {})
    const initial = action.getServerSnapshot()
    await settle()
    expect(action.getServerSnapshot()).toBe(initial)
    expect(action.getSnapshot()).not.toBe(initial)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    await action.submit()
    expect(listener).not.toHaveBeenCalled()
    close()
  })
  it('loads a saved publication explicitly without creating an intent, recovering status or submitting', async () => {
    const p = { ...ports(), loadPublished: jest.fn(async () => saved()) }
    p.readSaved.mockResolvedValue(saved())
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    expect(action.getSnapshot().contentLoaded).toBe(false)
    expect(p.loadPublished).not.toHaveBeenCalled()
    await action.loadPublished()
    expect(action.getSnapshot().contentLoaded).toBe(true)
    expect(p.createIntent).not.toHaveBeenCalled()
    expect(p.submit).not.toHaveBeenCalled()
    expect(p.recover).not.toHaveBeenCalled()
    close()
  })
  it('retains publication after a failed content load and retries without a new paid attempt', async () => {
    const p = { ...ports(), loadPublished: jest.fn(async () => saved()) }
    p.readSaved.mockResolvedValue(saved())
    p.loadPublished.mockRejectedValueOnce(new Error('Offline'))
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    await action.loadPublished()
    expect(action.getSnapshot().operation).toEqual(saved())
    expect(action.getSnapshot().contentLoaded).toBe(false)
    await action.loadPublished()
    expect(action.getSnapshot().contentLoaded).toBe(true)
    expect(p.loadPublished).toHaveBeenCalledTimes(2)
    expect(p.createIntent).not.toHaveBeenCalled()
    close()
  })
  it('captures the view generation so restart cannot authorize a previous request', async () => {
    const action = createDictionaryAnalysisAction(ports()),
      close = action.start(() => () => {})
    const assertPrevious = action.assertCurrent
    assertPrevious()
    close()
    const again = action.start(() => () => {})
    expect(assertPrevious).toThrow('session changed')
    expect(action.assertCurrent).not.toThrow()
    again()
  })
  it.each(['accepted', 'rejected', 'provider-outcome-unknown'] as const)(
    'does not load unpublished %s receipts',
    async status => {
      const p = { ...ports(), loadPublished: jest.fn(async () => saved()) }
      p.readSaved.mockResolvedValue({
        ...saved(),
        response: analysisReceipt(status),
      })
      const action = createDictionaryAnalysisAction(p),
        close = action.start(() => () => {})
      await settle()
      await action.loadPublished()
      expect(p.loadPublished).not.toHaveBeenCalled()
      close()
    }
  )
  it('recognizes actual common content by receipt-bound entry and monotonic head, including later rollback', () => {
    const operation = saved(),
      receipt = analysisReceipt()
    const context = {
      wordId: WORD_A,
      mode: 'follow',
      entryId: operation.command.entry_id,
      revisionId: receipt.published_revision_id,
      headSequence: receipt.published_head_sequence,
    }
    expect(isDictionaryAnalysisContentCurrent(operation, context)).toBe(true)
    expect(
      isDictionaryAnalysisContentCurrent(operation, {
        ...context,
        headSequence: operation.command.expected_head_sequence,
      })
    ).toBe(false)
    expect(
      isDictionaryAnalysisContentCurrent(operation, {
        ...context,
        revisionId: operation.command.expected_revision_id,
      })
    ).toBe(false)
    expect(
      isDictionaryAnalysisContentCurrent(operation, {
        ...context,
        mode: 'legacy',
      })
    ).toBe(false)
    expect(
      isDictionaryAnalysisContentCurrent(operation, {
        ...context,
        headSequence: '9007199254740995',
        revisionId: operation.command.expected_revision_id,
      })
    ).toBe(true)
  })
  it('restarts without retaining a previous busy load or applying its late result', async () => {
    let finish!: (value: DictionaryAnalysisClientOperation) => void
    const p = {
      ...ports(),
      loadPublished: jest.fn(
        () =>
          new Promise<DictionaryAnalysisClientOperation>(resolve => {
            finish = resolve
          })
      ),
    }
    p.readSaved.mockResolvedValue(saved())
    const action = createDictionaryAnalysisAction(p),
      close = action.start(() => () => {})
    await settle()
    const pending = action.loadPublished()
    expect(action.getSnapshot().busy).toBe(true)
    close()
    const again = action.start(() => () => {})
    await settle()
    expect(action.getSnapshot().busy).toBe(false)
    finish(saved())
    await pending
    expect(action.getSnapshot().contentLoaded).toBe(false)
    again()
  })
})
