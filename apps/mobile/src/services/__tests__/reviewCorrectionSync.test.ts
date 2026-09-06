import { reviewCorrectionSync } from '../reviewCorrectionSync'
import { supabase } from '@/lib/supabase'
import { reviewCorrectionRepository } from '@/db/reviewCorrectionRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import type {
  PendingReviewCorrection,
  ReviewCorrectionReceipt,
} from '@/types/ReviewCorrection'

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn() },
}))
jest.mock('@/db/reviewCorrectionRepository', () => ({
  reviewCorrectionRepository: {
    getMissingEventIds: jest.fn(),
    getTombstonedWordIds: jest.fn(),
    saveRemote: jest.fn(),
    markConflict: jest.fn(),
  },
}))
jest.mock('@/db/reviewEventRepository', () => ({
  reviewEventRepository: { saveRemoteEvents: jest.fn() },
}))

const userId = '00000000-0000-4000-8000-000000000001'
const command: PendingReviewCorrection = {
  correction_id: '00000000-0000-4000-8000-000000000002',
  event_id: '00000000-0000-4000-8000-000000000003',
  word_id: '00000000-0000-4000-8000-000000000004',
  user_id: userId,
  expected_revision: 0,
  assessment: 'hard',
  sequence: 2,
  status: 'pending',
  error: null,
}
const receipt: ReviewCorrectionReceipt = {
  ...command,
  revision: 1,
  next_interval_days: 1,
  next_repetition_count: 1,
  next_easiness_factor: 2.36,
  created_at: '2026-09-06T12:00:00.000Z',
}
const acknowledgement = {
  ...command,
  accepted_revision: 1,
  effective_revision: 9,
}
const query = {
  select: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  range: jest.fn(),
  single: jest.fn(),
  in: jest.fn(),
}
const ok = (data: unknown) => ({ data, error: null })

beforeEach(() => {
  jest.resetAllMocks()
  jest
    .mocked(supabase.auth.getUser)
    .mockResolvedValue(ok({ user: { id: userId } }) as never)
  jest.mocked(supabase.rpc).mockResolvedValue(ok([acknowledgement]) as never)
  jest.mocked(supabase.from).mockReturnValue(query as never)
  for (const method of [query.select, query.eq, query.order])
    method.mockReturnValue(query)
  query.single.mockResolvedValue(ok(receipt))
  query.range.mockResolvedValue(ok([]))
  jest
    .mocked(reviewCorrectionRepository.getMissingEventIds)
    .mockResolvedValue([])
  jest
    .mocked(reviewCorrectionRepository.getTombstonedWordIds)
    .mockResolvedValue([])
  jest
    .mocked(reviewCorrectionRepository.saveRemote)
    .mockResolvedValue(undefined)
})

describe('review correction transport', () => {
  it.each(['PGRST202', '42883'])(
    'detects missing capability (%s) without hiding transport errors',
    async code => {
      jest
        .mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: null, error: { code } } as never)
      await expect(reviewCorrectionSync.isAvailable()).resolves.toBe(false)
      const error = { code: 'NETWORK' }
      jest
        .mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: null, error } as never)
      await expect(reviewCorrectionSync.isAvailable()).rejects.toEqual(error)
    }
  )

  it.each([1, 2, null])(
    'requires the supported capability version: %s',
    async version => {
      jest.mocked(supabase.rpc).mockResolvedValueOnce(ok(version) as never)
      await expect(reviewCorrectionSync.isAvailable()).resolves.toBe(
        version === 1
      )
    }
  )

  it('rejects an account switch before sending any command or reading history', async () => {
    jest
      .mocked(supabase.auth.getUser)
      .mockResolvedValue(ok({ user: { id: 'other' } }) as never)
    await expect(reviewCorrectionSync.push(userId, command)).rejects.toThrow(
      'Authentication changed'
    )
    await expect(reviewCorrectionSync.pull(userId)).rejects.toThrow(
      'Authentication changed'
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('retries an uncertain response with the same command and stores its original receipt', async () => {
    const error = { code: 'NETWORK' }
    jest
      .mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: null, error } as never)
    await expect(reviewCorrectionSync.push(userId, command)).rejects.toEqual(
      error
    )
    expect(reviewCorrectionRepository.saveRemote).not.toHaveBeenCalled()
    expect(reviewCorrectionRepository.markConflict).not.toHaveBeenCalled()
    await reviewCorrectionSync.push(userId, command)
    const calls = jest.mocked(supabase.rpc).mock.calls
    expect(calls[0]).toEqual(calls[1])
    expect(calls[0]).toEqual([
      'correct_review_assessment',
      {
        p_word_id: command.word_id,
        p_event_id: command.event_id,
        p_correction_id: command.correction_id,
        p_expected_revision: 0,
        p_assessment: 'hard',
      },
    ])
    expect(query.eq).toHaveBeenCalledWith('user_id', userId)
    expect(query.eq).toHaveBeenCalledWith(
      'correction_id',
      command.correction_id
    )
    expect(reviewCorrectionRepository.saveRemote).toHaveBeenCalledWith(userId, [
      receipt,
    ])
  })

  it('does not acknowledge a successful RPC when fetching its receipt fails', async () => {
    query.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'NETWORK' },
    })
    await expect(reviewCorrectionSync.push(userId, command)).rejects.toEqual({
      code: 'NETWORK',
    })
    expect(reviewCorrectionRepository.saveRemote).not.toHaveBeenCalled()
    await reviewCorrectionSync.push(userId, command)
    expect(reviewCorrectionRepository.saveRemote).toHaveBeenCalledTimes(1)
  })

  it.each(['PT409', '40001', '22023', '42501'])(
    'persists a terminal %s conflict without acknowledging it',
    async code => {
      jest
        .mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: null, error: { code } } as never)
      await expect(reviewCorrectionSync.push(userId, command)).rejects.toEqual({
        code,
      })
      expect(reviewCorrectionRepository.markConflict).toHaveBeenCalledWith(
        userId,
        command.correction_id,
        expect.any(String)
      )
      await expect(
        reviewCorrectionSync.push(userId, { ...command, status: 'conflict' })
      ).rejects.toThrow('needs attention')
      expect(supabase.rpc).toHaveBeenCalledTimes(1)
      expect(reviewCorrectionRepository.saveRemote).not.toHaveBeenCalled()
    }
  )

  it('refuses foreign commands', async () => {
    await expect(reviewCorrectionSync.push('other', command)).rejects.toThrow(
      'Foreign'
    )
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
  })

  it.each([
    null,
    [],
    [{ ...acknowledgement, accepted_revision: 2 }],
    [{ ...acknowledgement, word_id: 'other' }],
  ])('rejects an invalid acknowledgement %#', async data => {
    jest.mocked(supabase.rpc).mockResolvedValueOnce(ok(data) as never)
    await expect(reviewCorrectionSync.push(userId, command)).rejects.toThrow(
      'acknowledgement'
    )
    expect(reviewCorrectionRepository.saveRemote).not.toHaveBeenCalled()
  })

  it.each([
    { user_id: 'other' },
    { correction_id: 'invalid' },
    { revision: 2 },
    { assessment: 'unknown' },
    { next_interval_days: -1 },
    { next_repetition_count: 1.5 },
    { next_easiness_factor: NaN },
    { next_easiness_factor: 2.6 },
    { created_at: 'yesterday' },
  ])(
    'rejects malformed receipts %# before acknowledging local intent',
    async fields => {
      query.single.mockResolvedValueOnce(ok({ ...receipt, ...fields }))
      await expect(reviewCorrectionSync.push(userId, command)).rejects.toThrow(
        'Invalid correction receipt'
      )
      expect(reviewCorrectionRepository.saveRemote).not.toHaveBeenCalled()
    }
  )

  it('scans all pages and restarts at zero to recover a late committed receipt', async () => {
    const page = Array.from({ length: 250 }, (_, index) => ({
      ...receipt,
      correction_id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    }))
    query.range.mockResolvedValueOnce(ok(page)).mockResolvedValueOnce(ok([]))
    await expect(reviewCorrectionSync.pull(userId)).resolves.toBe(250)
    query.range.mockResolvedValueOnce(ok([receipt]))
    await expect(reviewCorrectionSync.pull(userId)).resolves.toBe(1)
    expect(query.range.mock.calls).toEqual([
      [0, 249],
      [250, 499],
      [0, 249],
    ])
    expect(reviewCorrectionRepository.saveRemote).toHaveBeenLastCalledWith(
      userId,
      [receipt]
    )
  })

  it('hydrates an original event missed by an earlier event cursor before saving its correction', async () => {
    jest
      .mocked(reviewCorrectionRepository.getMissingEventIds)
      .mockResolvedValueOnce([command.event_id])
    const event = { event_id: command.event_id, user_id: userId }
    query.in.mockResolvedValueOnce(ok([event]))
    query.range.mockResolvedValueOnce(ok([receipt]))
    await reviewCorrectionSync.pull(userId)
    expect(supabase.from).toHaveBeenCalledWith('review_events')
    expect(query.in).toHaveBeenCalledWith('event_id', [command.event_id])
    expect(reviewEventRepository.saveRemoteEvents).toHaveBeenCalledWith([event])
    expect(
      jest.mocked(reviewEventRepository.saveRemoteEvents).mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      jest.mocked(reviewCorrectionRepository.saveRemote).mock
        .invocationCallOrder[0]
    )
  })

  it('retains the queue when the original event cannot be reconciled', async () => {
    jest
      .mocked(reviewCorrectionRepository.getMissingEventIds)
      .mockResolvedValueOnce([command.event_id])
    query.in.mockResolvedValueOnce(ok([]))
    await expect(reviewCorrectionSync.push(userId, command)).rejects.toThrow(
      'could not be reconciled'
    )
    expect(reviewCorrectionRepository.saveRemote).not.toHaveBeenCalled()
  })

  it('does not resurrect reviews or block an offline word deletion', async () => {
    jest
      .mocked(reviewCorrectionRepository.getTombstonedWordIds)
      .mockResolvedValueOnce([command.word_id])
    query.range.mockResolvedValueOnce(ok([receipt]))
    await expect(reviewCorrectionSync.pull(userId)).resolves.toBe(1)
    expect(reviewCorrectionRepository.getMissingEventIds).toHaveBeenCalledWith(
      userId,
      []
    )
    expect(reviewCorrectionRepository.saveRemote).toHaveBeenCalledWith(
      userId,
      []
    )
    expect(reviewEventRepository.saveRemoteEvents).not.toHaveBeenCalled()
  })
})
