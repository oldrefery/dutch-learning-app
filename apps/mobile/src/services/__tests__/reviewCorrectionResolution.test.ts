import { resolveReviewCorrectionConflict } from '../reviewCorrectionResolution'
import { learningOperationQueue } from '../learningOperationQueue'
import { supabase } from '@/lib/supabase'
import { reviewCorrectionRepository } from '@/db/reviewCorrectionRepository'
import { keepServerReviewCorrection } from '@/db/reviewCorrectionResolutionRepository'
import { reviewCorrectionSync } from '../reviewCorrectionSync'
import type {
  LocalReviewCorrection,
  ReviewCorrectionCommand,
} from '@/types/ReviewCorrection'

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn() },
}))
jest.mock('@/db/reviewCorrectionRepository', () => ({
  ...jest.requireActual('@/db/reviewCorrectionRepository'),
  reviewCorrectionRepository: { getById: jest.fn() },
}))
jest.mock('@/db/reviewCorrectionResolutionRepository', () => ({
  keepServerReviewCorrection: jest.fn(),
}))
jest.mock('../reviewCorrectionSync', () => ({
  ...jest.requireActual('../reviewCorrectionSync'),
  reviewCorrectionSync: { pull: jest.fn(), isAvailable: jest.fn() },
}))
jest.mock('@/db/initDB')
jest.mock('@/db/reviewEventRepository')

const userId = '00000000-0000-4000-8000-000000000001'
const command: ReviewCorrectionCommand = {
  user_id: userId,
  word_id: '00000000-0000-4000-8000-000000000002',
  event_id: '00000000-0000-4000-8000-000000000003',
  correction_id: '00000000-0000-4000-8000-000000000004',
  expected_revision: 0,
  assessment: 'hard',
}
const local: LocalReviewCorrection = {
  ...command,
  status: 'conflict',
  resolved_at: null,
  error: 'Conflict',
}
const progress = {
  word_id: command.word_id,
  user_id: userId,
  interval_days: 6,
  repetition_count: 2,
  easiness_factor: 2.5,
  next_review_date: '2026-09-12',
  last_reviewed_at: null,
}
const query = {
  select: jest.fn(),
  eq: jest.fn(),
  is: jest.fn(),
  maybeSingle: jest.fn(),
}
const ok = (data: unknown) => ({ data, error: null })
const resolve = () => resolveReviewCorrectionConflict(userId, command)

beforeEach(() => {
  jest.resetAllMocks()
  jest
    .mocked(supabase.auth.getUser)
    .mockResolvedValue(ok({ user: { id: userId } }) as never)
  jest.mocked(supabase.from).mockReturnValue(query as never)
  for (const method of [query.select, query.eq, query.is])
    method.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue(ok(progress))
  jest.mocked(reviewCorrectionRepository.getById).mockResolvedValue(local)
  jest.mocked(reviewCorrectionSync.isAvailable).mockResolvedValue(true)
  jest.mocked(reviewCorrectionSync.pull).mockResolvedValue(0)
})

describe('explicit mobile correction conflict resolution', () => {
  it('waits for sync and freezes the command before joining the queue', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const sync = learningOperationQueue.run(() => gate)
    const input = { ...command }
    const result = resolveReviewCorrectionConflict(userId, input)
    input.assessment = 'easy'
    await Promise.resolve()
    const readsBeforeRelease = jest.mocked(reviewCorrectionRepository.getById)
      .mock.calls.length
    release()
    await Promise.all([sync, result])
    expect(readsBeforeRelease).toBe(0)
    expect(keepServerReviewCorrection).toHaveBeenCalledWith(command, progress)
  })

  it('refreshes receipts and canonical SRS with account-scoped reads before releasing local intent', async () => {
    await resolve()
    expect(reviewCorrectionSync.pull).toHaveBeenCalledWith(userId)
    expect(supabase.from).toHaveBeenCalledWith('words')
    expect(query.eq.mock.calls).toEqual([
      ['user_id', userId],
      ['word_id', command.word_id],
    ])
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
    expect(keepServerReviewCorrection).toHaveBeenCalledWith(command, progress)
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(3)
    expect(
      jest.mocked(reviewCorrectionSync.pull).mock.invocationCallOrder[0]
    ).toBeLessThan(query.maybeSingle.mock.invocationCallOrder[0])
    expect(query.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(keepServerReviewCorrection).mock.invocationCallOrder[0]
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { ...local, assessment: 'easy' },
    { ...local, status: 'pending' },
  ])(
    'rejects missing, changed, or uncertain commands before network access %#',
    async row => {
      jest
        .mocked(reviewCorrectionRepository.getById)
        .mockResolvedValue(row as LocalReviewCorrection | null)
      await expect(resolve()).rejects.toThrow()
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(reviewCorrectionSync.pull).not.toHaveBeenCalled()
      expect(keepServerReviewCorrection).not.toHaveBeenCalled()
    }
  )

  it('rejects a foreign command before reading local storage', async () => {
    await expect(
      resolveReviewCorrectionConflict('other', command)
    ).rejects.toThrow('Foreign')
    expect(reviewCorrectionRepository.getById).not.toHaveBeenCalled()
  })

  it('does not repeat an already durable resolution', async () => {
    jest
      .mocked(reviewCorrectionRepository.getById)
      .mockResolvedValue({ ...local, resolved_at: '2026-09-06T12:00:00Z' })
    await resolve()
    expect(reviewCorrectionSync.pull).not.toHaveBeenCalled()
    expect(keepServerReviewCorrection).not.toHaveBeenCalled()
  })

  it('can retry after a receipt was saved but the subsequent word read failed', async () => {
    query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('offline'),
    })
    await expect(resolve()).rejects.toThrow('offline')
    expect(keepServerReviewCorrection).not.toHaveBeenCalled()
    jest
      .mocked(reviewCorrectionRepository.getById)
      .mockResolvedValue({ ...local, status: 'synced' })
    await resolve()
    expect(keepServerReviewCorrection).toHaveBeenCalledWith(command, progress)
  })

  it.each(['capability', 'ledger', 'word', 'storage'])(
    'retains the operation when %s fails',
    async stage => {
      const error = new Error('unavailable')
      if (stage === 'capability')
        jest
          .mocked(reviewCorrectionSync.isAvailable)
          .mockRejectedValueOnce(error)
      if (stage === 'ledger')
        jest.mocked(reviewCorrectionSync.pull).mockRejectedValueOnce(error)
      if (stage === 'word')
        query.maybeSingle.mockResolvedValueOnce({ data: null, error })
      if (stage === 'storage')
        jest.mocked(keepServerReviewCorrection).mockRejectedValueOnce(error)
      await expect(resolve()).rejects.toThrow('unavailable')
      if (stage !== 'storage')
        expect(keepServerReviewCorrection).not.toHaveBeenCalled()
    }
  )

  it('retains the command on an unsupported backend', async () => {
    jest.mocked(reviewCorrectionSync.isAvailable).mockResolvedValueOnce(false)
    await expect(resolve()).rejects.toThrow('updated backend')
    expect(reviewCorrectionSync.pull).not.toHaveBeenCalled()
    expect(keepServerReviewCorrection).not.toHaveBeenCalled()
  })

  it.each([0, 1])(
    'rejects an account change at identity check %s',
    async check => {
      if (check === 1)
        jest
          .mocked(supabase.auth.getUser)
          .mockResolvedValueOnce(ok({ user: { id: userId } }) as never)
      jest
        .mocked(supabase.auth.getUser)
        .mockResolvedValueOnce(ok({ user: { id: 'other' } }) as never)
      await expect(resolve()).rejects.toThrow('Authentication changed')
      expect(keepServerReviewCorrection).not.toHaveBeenCalled()
    }
  )

  it('keeps the operation when validating authentication fails', async () => {
    jest.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: new Error('expired'),
    } as never)
    await expect(resolve()).rejects.toThrow('expired')
    expect(reviewCorrectionSync.isAvailable).not.toHaveBeenCalled()
    expect(keepServerReviewCorrection).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    {},
    [],
    { ...progress, user_id: 'other' },
    { ...progress, word_id: 'other' },
    { ...progress, interval_days: -1 },
    { ...progress, repetition_count: 0.5 },
    { ...progress, easiness_factor: NaN },
    { ...progress, easiness_factor: 2.6 },
    { ...progress, easiness_factor: 1.2 },
    { ...progress, next_review_date: 'invalid' },
    { ...progress, last_reviewed_at: undefined },
  ])(
    'rejects invalid canonical progress %# before local changes',
    async data => {
      query.maybeSingle.mockResolvedValueOnce(ok(data))
      await expect(resolve()).rejects.toThrow('Invalid canonical')
      expect(keepServerReviewCorrection).not.toHaveBeenCalled()
    }
  )

  it.each([null, { ...progress, last_reviewed_at: '2026-09-06T12:00:00Z' }])(
    'accepts an inaccessible word or a valid reviewed timestamp %#',
    async data => {
      query.maybeSingle.mockResolvedValueOnce(ok(data))
      await resolve()
      expect(keepServerReviewCorrection).toHaveBeenCalledWith(command, data)
    }
  )

  it('freezes the original command while asynchronous reads are pending', async () => {
    const mutable = { ...command }
    const pending = resolveReviewCorrectionConflict(userId, mutable)
    mutable.assessment = 'easy'
    await pending
    expect(keepServerReviewCorrection).toHaveBeenCalledWith(command, progress)
  })
})
