/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { submitReviewAssessment } from './actions'
import type { ReviewSubmissionInput } from './types'

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const rpc = jest.fn()
const input: ReviewSubmissionInput = {
  wordId: '12345678-1234-4123-8123-123456789abc',
  eventId: '87654321-1234-4123-8123-123456789abc',
  assessment: 'good',
  reviewMode: 'meaning-recall',
  answeredCorrectly: true,
  responseTimeMs: 750,
  reviewDate: '2026-09-05',
  reviewedAt: '2026-09-05T12:00:00.000Z',
}
const update = {
  word_id: input.wordId,
  easiness_factor: 2.35,
  interval_days: 7,
  repetition_count: 3,
  last_reviewed_at: input.reviewedAt,
  next_review_date: '2026-09-12',
}

beforeEach(() => {
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: 'verified-user',
    email: null,
    accessLevel: 'full_access',
  })
  jest
    .mocked(createClient)
    .mockResolvedValue({ rpc } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
  rpc.mockResolvedValue({ data: [update], error: null })
})

it('blocks all database access when the authenticated session is unavailable', async () => {
  const redirect = new Error('NEXT_REDIRECT')
  jest.mocked(requireAuthContext).mockRejectedValueOnce(redirect)
  await expect(submitReviewAssessment(input)).rejects.toBe(redirect)
  expect(createClient).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
})

it('persists a single atomic assessment and returns authoritative server progress', async () => {
  expect(await submitReviewAssessment(input)).toEqual({
    status: 'success',
    update: {
      wordId: input.wordId,
      easinessFactor: 2.35,
      intervalDays: 7,
      repetitionCount: 3,
      lastReviewedAt: input.reviewedAt,
      nextReviewDate: '2026-09-12',
    },
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('record_review_assessment', {
    p_word_id: input.wordId,
    p_event_id: input.eventId,
    p_assessment: 'good',
    p_review_mode: 'meaning-recall',
    p_answered_correctly: true,
    p_response_time_ms: 750,
    p_review_date: '2026-09-05',
    p_reviewed_at: input.reviewedAt,
  })
  expect(revalidatePath).toHaveBeenCalledTimes(2)
  expect(revalidatePath).toHaveBeenCalledWith('/app/collections')
  expect(revalidatePath).toHaveBeenCalledWith('/app/review')
  expect(Sentry.captureException).not.toHaveBeenCalled()
})

it.each([
  { wordId: `prefix-${input.wordId}` },
  { eventId: `${input.eventId}-suffix` },
  { reviewDate: 'prefix-2026-09-05' },
  { reviewDate: '2026-09-05-suffix' },
  { wordId: 'another-users-invalid-id' },
  { eventId: '' },
  { assessment: 'known' },
  { reviewMode: 'unknown' },
  { reviewDate: '05-09-2026' },
  { reviewedAt: 'not-a-date' },
  { responseTimeMs: -1 },
  { responseTimeMs: 3_600_001 },
  { responseTimeMs: 0.5 },
  { responseTimeMs: NaN },
  { responseTimeMs: Infinity },
  { answeredCorrectly: 'true' },
])('rejects malformed input before writing: %j', invalid => {
  return expect(
    submitReviewAssessment({ ...input, ...invalid } as ReviewSubmissionInput)
  )
    .resolves.toEqual({
      status: 'error',
      message: 'The review result is invalid.',
    })
    .then(() => {
      expect(rpc).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })
})

it.each([
  {
    assessment: 'again',
    reviewMode: 'recognition',
    answeredCorrectly: false,
    responseTimeMs: 0,
  },
  {
    assessment: 'hard',
    reviewMode: 'dutch-production',
    answeredCorrectly: null,
    responseTimeMs: 3_600_000,
  },
  {
    assessment: 'easy',
    reviewMode: 'meaning-recall',
    answeredCorrectly: true,
    responseTimeMs: 1,
  },
] as const)(
  'accepts valid assessment variants and timing boundaries: %j',
  fields => {
    return expect(
      submitReviewAssessment({ ...input, ...fields })
    ).resolves.toMatchObject({ status: 'success' })
  }
)

it.each([
  {
    data: null,
    error: {
      message: 'RLS denied',
      code: '42501',
      details: 'Denied',
      hint: 'Check ownership',
    },
  },
  { data: [], error: null },
  { data: null, error: null },
])(
  'does not advance progress or revalidate after persistence failure: %j',
  result => {
    rpc.mockResolvedValue(result)
    return expect(submitReviewAssessment(input))
      .resolves.toEqual({
        status: 'error',
        message: 'Could not save this review. Please try again.',
      })
      .then(() => {
        expect(revalidatePath).not.toHaveBeenCalled()
        expect(Sentry.captureException).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'ReviewPersistenceError',
            message:
              result.error?.message ??
              'record_review_assessment returned no update',
          }),
          {
            tags: {
              operation: 'record_review_assessment',
              review_assessment: input.assessment,
              review_mode: input.reviewMode,
              supabase_error_code: result.error?.code ?? 'missing_result',
            },
            extra: {
              supabase_details: result.error?.details ?? null,
              supabase_hint: result.error?.hint ?? null,
            },
          }
        )
      })
  }
)

it('reuses the same event identity when retrying an unacknowledged write', async () => {
  rpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'Connection lost' },
  })
  expect((await submitReviewAssessment(input)).status).toBe('error')
  expect((await submitReviewAssessment(input)).status).toBe('success')
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
})
