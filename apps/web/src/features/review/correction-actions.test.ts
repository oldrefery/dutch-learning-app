/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { submitReviewCorrection } from './correction-actions'
import { loadReviewWordDetails } from './details-action'
import { buildWordDetail } from '@/features/words/word-detail'
import type { ReviewCorrectionInput } from './correction-contract'

jest.mock('server-only', () => ({}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/features/words/word-detail', () => ({
  ...jest.requireActual('@/features/words/word-detail'),
  buildWordDetail: jest.fn(),
}))

const input: ReviewCorrectionInput = {
  userId: '00000000-0000-4000-8000-000000000001',
  wordId: '00000000-0000-4000-8000-000000000002',
  eventId: '00000000-0000-4000-8000-000000000003',
  correctionId: '00000000-0000-4000-8000-000000000004',
  expectedRevision: 0,
  assessment: 'hard',
}
const acknowledgement = {
  word_id: input.wordId,
  event_id: input.eventId,
  correction_id: input.correctionId,
  accepted_revision: 1,
  effective_revision: 1,
  effective_assessment: 'hard',
  interval_days: 1,
  repetition_count: 1,
  easiness_factor: 2.35,
  next_review_date: '2026-09-07',
  last_reviewed_at: '2026-09-06T12:00:00.000Z',
}
const rpc = jest.fn()
const from = jest.fn()
const query = {
  select: jest.fn(),
  eq: jest.fn(),
  is: jest.fn(),
  maybeSingle: jest.fn(),
}
const ok = (data: unknown) => ({ data, error: null })

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: input.userId,
    email: null,
    accessLevel: 'full_access',
  })
  jest
    .mocked(createClient)
    .mockResolvedValue({ rpc, from } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
  rpc.mockImplementation((name: string) =>
    Promise.resolve(
      ok(name === 'review_correction_protocol' ? 1 : [acknowledgement])
    )
  )
  from.mockReturnValue(query)
  for (const method of [query.select, query.eq, query.is])
    method.mockReturnValue(query)
})

it('sends one replacement RPC with the original operation ID and returns canonical progress', async () => {
  expect(await submitReviewCorrection(input)).toEqual({
    status: 'success',
    correctionId: input.correctionId,
    eventId: input.eventId,
    acceptedRevision: 1,
    effectiveRevision: 1,
    assessment: 'hard',
    update: {
      wordId: input.wordId,
      intervalDays: 1,
      repetitionCount: 1,
      easinessFactor: 2.35,
      nextReviewDate: acknowledgement.next_review_date,
      lastReviewedAt: acknowledgement.last_reviewed_at,
    },
  })
  expect(rpc.mock.calls).toEqual([
    ['review_correction_protocol'],
    [
      'correct_review_assessment',
      {
        p_word_id: input.wordId,
        p_event_id: input.eventId,
        p_correction_id: input.correctionId,
        p_expected_revision: 0,
        p_assessment: 'hard',
      },
    ],
  ])
  expect(from).not.toHaveBeenCalled()
  expect(jest.mocked(revalidatePath).mock.calls).toEqual(
    ['/app/review', '/app/history', '/app/insights', '/app/collections'].map(
      path => [path]
    )
  )
  expect(Sentry.captureException).not.toHaveBeenCalled()
})

it('returns a newer effective rating on a retry without presenting the old accepted rating as current', async () => {
  rpc.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(
    ok([
      {
        ...acknowledgement,
        effective_revision: 3,
        effective_assessment: 'easy',
        interval_days: 10,
      },
    ])
  )
  expect(await submitReviewCorrection(input)).toMatchObject({
    status: 'success',
    acceptedRevision: 1,
    effectiveRevision: 3,
    assessment: 'easy',
    update: { intervalDays: 10 },
  })
})

it('does not access the database when authentication redirects', async () => {
  const redirect = new Error('NEXT_REDIRECT')
  jest.mocked(requireAuthContext).mockRejectedValue(redirect)
  await expect(submitReviewCorrection(input)).rejects.toBe(redirect)
  await expect(loadReviewWordDetails(input)).rejects.toBe(redirect)
  expect(createClient).not.toHaveBeenCalled()
})

it('accepts canonical reset progress on a retry of an already accepted correction', async () => {
  rpc.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(
    ok([
      {
        ...acknowledgement,
        last_reviewed_at: null,
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
      },
    ])
  )
  expect(await submitReviewCorrection(input)).toMatchObject({
    status: 'success',
    acceptedRevision: 1,
    update: { lastReviewedAt: null, intervalDays: 0, repetitionCount: 0 },
  })
})

it.each([
  null,
  {},
  { ...input, userId: '00000000-0000-4000-8000-000000000099' },
  { ...input, correctionId: 'not-a-uuid' },
  { ...input, expectedRevision: -1 },
  { ...input, expectedRevision: 0.5 },
  { ...input, expectedRevision: 2147483647 },
  { ...input, assessment: 'known' },
  { ...input, eventId: null },
])(
  'rejects invalid or cross-account corrections before database access %#',
  async value => {
    expect(
      await submitReviewCorrection(value as ReviewCorrectionInput)
    ).toMatchObject({
      status: 'invalid',
      message: expect.stringContaining('signed-in account'),
    })
    expect(createClient).not.toHaveBeenCalled()
  }
)

it.each(['PGRST202', '42883'])(
  'disables corrections on an old backend (%s)',
  async code => {
    rpc.mockResolvedValueOnce({ data: null, error: { code } })
    expect(await submitReviewCorrection(input)).toMatchObject({
      status: 'unavailable',
      message: expect.stringContaining('not available'),
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(revalidatePath).not.toHaveBeenCalled()
  }
)

it.each([null, 0, 2])(
  'does not write with unsupported protocol version %s',
  async version => {
    rpc.mockResolvedValueOnce(ok(version))
    expect(await submitReviewCorrection(input)).toMatchObject({
      status: 'unavailable',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  }
)

it.each([
  ['40001', 'conflict'],
  ['22023', 'invalid'],
  ['42501', 'invalid'],
  ['23505', 'retry'],
  ['NETWORK', 'retry'],
])(
  'classifies %s as %s without a fallback ordinary review',
  async (code, status) => {
    rpc.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce({
      data: null,
      error: { code, message: 'private provider payload' },
    })
    expect(await submitReviewCorrection(input)).toMatchObject({
      status,
      message: expect.stringMatching(/\S/),
    })
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'review_correction_protocol',
      'correct_review_assessment',
    ])
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(
      JSON.stringify(jest.mocked(Sentry.captureException).mock.calls)
    ).not.toContain('private provider payload')
    if (status === 'retry') {
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException).toHaveBeenCalledWith(
        new Error('Review correction could not be confirmed'),
        { tags: { operation: 'correct_review_assessment' } }
      )
    } else expect(Sentry.captureException).not.toHaveBeenCalled()
  }
)

it('rejects an error response even when it also contains a valid-looking receipt', async () => {
  rpc.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce({
    data: [acknowledgement],
    error: { code: 'NETWORK', message: 'private provider payload' },
  })
  expect(await submitReviewCorrection(input)).toMatchObject({ status: 'retry' })
  expect(revalidatePath).not.toHaveBeenCalled()
})

it('retries identical arguments after a transport failure instead of allocating another command', async () => {
  rpc
    .mockResolvedValueOnce(ok(1))
    .mockRejectedValueOnce(new Error('Disconnected'))
  expect(await submitReviewCorrection(input)).toMatchObject({ status: 'retry' })
  expect(await submitReviewCorrection(input)).toMatchObject({
    status: 'success',
  })
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[3])
})

it.each([
  null,
  [],
  [acknowledgement, acknowledgement],
  [{ ...acknowledgement, event_id: input.wordId }],
  [{ ...acknowledgement, effective_revision: 0 }],
  [{ ...acknowledgement, accepted_revision: 2 }],
  [{ ...acknowledgement, effective_assessment: 'good' }],
  [{ ...acknowledgement, easiness_factor: NaN }],
  [{ ...acknowledgement, easiness_factor: 2.6 }],
  [{ ...acknowledgement, interval_days: -1 }],
  [{ ...acknowledgement, repetition_count: 1.5 }],
  [{ ...acknowledgement, next_review_date: 'tomorrow' }],
  [{ ...acknowledgement, next_review_date: '2026-02-30' }],
  [{ ...acknowledgement, last_reviewed_at: 'invalid' }],
])('does not confirm a malformed response %#', async data => {
  rpc.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(ok(data))
  expect(await submitReviewCorrection(input)).toMatchObject({ status: 'retry' })
  expect(revalidatePath).not.toHaveBeenCalled()
})

it('treats a capability network failure as retryable, not unsupported', async () => {
  rpc.mockRejectedValueOnce(new Error('Network'))
  expect(await submitReviewCorrection(input)).toMatchObject({ status: 'retry' })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('keeps client initialization failures retryable without exposing credentials', async () => {
  jest.mocked(createClient).mockRejectedValue(new Error('private credentials'))
  const correction = await submitReviewCorrection(input)
  const details = await loadReviewWordDetails(input)
  expect(correction.status).toBe('retry')
  expect(details.status).toBe('error')
  expect(
    JSON.stringify([
      correction,
      details,
      jest.mocked(Sentry.captureException).mock.calls,
    ])
  ).not.toContain('private credentials')
})

it('loads full details only for an owned, active word without mutating review state', async () => {
  const row = { word_id: input.wordId, user_id: input.userId }
  query.maybeSingle.mockResolvedValueOnce(ok(row))
  jest
    .mocked(buildWordDetail)
    .mockReturnValueOnce({ id: input.wordId } as ReturnType<
      typeof buildWordDetail
    >)
  expect(await loadReviewWordDetails(input)).toEqual({
    status: 'success',
    word: { id: input.wordId },
  })
  expect(from).toHaveBeenCalledWith('words')
  expect(query.eq.mock.calls).toEqual([
    ['user_id', input.userId],
    ['word_id', input.wordId],
  ])
  expect(query.is).toHaveBeenCalledWith('deleted_at', null)
  expect(buildWordDetail).toHaveBeenCalledWith(row)
  expect(rpc).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
})

it.each([
  null,
  { ...input, userId: 'another-user' },
  { ...input, wordId: 'invalid' },
])('rejects a foreign or malformed detail request %#', async value => {
  expect(await loadReviewWordDetails(value as typeof input)).toMatchObject({
    status: 'error',
  })
  expect(from).not.toHaveBeenCalled()
})

it.each([ok(null), { data: null, error: { message: 'private data' } }])(
  'reports missing or unavailable detail data without leaking provider errors %#',
  async response => {
    query.maybeSingle.mockResolvedValueOnce(response)
    const result = await loadReviewWordDetails(input)
    expect(result.status).toBe('error')
    expect(JSON.stringify(result)).not.toContain('private data')
    expect(buildWordDetail).not.toHaveBeenCalled()
  }
)
