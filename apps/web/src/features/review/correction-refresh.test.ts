/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { requireAuthContext } from '@/lib/auth/session'
import {
  createCorrectionClient,
  readCorrectionCapability,
} from './correction-client'
import { loadReviewCorrectionState } from './correction-refresh'
import type { ReviewCorrectionRefreshInput } from './correction-contract'

jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('./correction-client', () => ({
  createCorrectionClient: jest.fn(),
  readCorrectionCapability: jest.fn(),
}))

const input: ReviewCorrectionRefreshInput = {
  userId: '00000000-0000-4000-8000-000000000001',
  wordId: '00000000-0000-4000-8000-000000000002',
  eventId: '00000000-0000-4000-8000-000000000003',
}
const query = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
})
const word = query()
const event = query()
const from = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: input.userId,
    email: 'synthetic@example.test',
    accessLevel: 'full_access',
  })
  jest.mocked(readCorrectionCapability).mockResolvedValue(true)
  from.mockImplementation(table => (table === 'words' ? word : event))
  jest
    .mocked(createCorrectionClient)
    .mockResolvedValue({ from } as unknown as Awaited<
      ReturnType<typeof createCorrectionClient>
    >)
  word.maybeSingle.mockResolvedValue({
    data: {
      word_id: input.wordId,
      interval_days: 0,
      repetition_count: 0,
      easiness_factor: 2.5,
      next_review_date: '2026-09-06',
      last_reviewed_at: null,
    },
    error: null,
  })
  event.maybeSingle.mockResolvedValue({
    data: { assessment: 'easy', revision: 2 },
    error: null,
  })
})

test('reads only the owned word and its bound effective event, including reset progress', async () => {
  expect(await loadReviewCorrectionState(input)).toEqual({
    status: 'success',
    ...input,
    correctionsAvailable: true,
    progress: {
      wordId: input.wordId,
      intervalDays: 0,
      repetitionCount: 0,
      easinessFactor: 2.5,
      nextReviewDate: '2026-09-06',
      lastReviewedAt: null,
    },
    event: { assessment: 'easy', revision: 2 },
  })
  expect(from.mock.calls).toEqual([['words'], ['effective_review_events']])
  expect(word.select).toHaveBeenCalledWith(
    'word_id, interval_days, repetition_count, easiness_factor, next_review_date, last_reviewed_at'
  )
  expect(event.select).toHaveBeenCalledWith('assessment, revision')
  expect(word.eq.mock.calls).toEqual([
    ['user_id', input.userId],
    ['word_id', input.wordId],
  ])
  expect(word.is).toHaveBeenCalledWith('deleted_at', null)
  expect(event.eq.mock.calls).toEqual([
    ['user_id', input.userId],
    ['word_id', input.wordId],
    ['event_id', input.eventId],
  ])
})

test.each([
  null,
  {},
  { ...input, userId: 'other-user' },
  { ...input, wordId: '../word' },
  { ...input, eventId: 7 },
  { ...input, eventId: 'not-a-uuid' },
  { ...input, wordId: [input.wordId] },
  { ...input, eventId: [input.eventId] },
])(
  'invalid ownership or identity never reaches the database: %j',
  async value => {
    expect(
      await loadReviewCorrectionState(value as ReviewCorrectionRefreshInput)
    ).toEqual({
      status: 'error',
      message: 'This review is not available for the signed-in account.',
    })
    expect(createCorrectionClient).not.toHaveBeenCalled()
  }
)

test('auth redirect escapes the error boundary', async () => {
  const redirect = new Error('NEXT_REDIRECT')
  jest.mocked(requireAuthContext).mockRejectedValueOnce(redirect)
  await expect(loadReviewCorrectionState(input)).rejects.toBe(redirect)
  expect(createCorrectionClient).not.toHaveBeenCalled()
})

test('a deleted or inaccessible word is not resurrected', async () => {
  word.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect(await loadReviewCorrectionState(input)).toMatchObject({
    status: 'success',
    progress: null,
    event: null,
  })
  expect(event.maybeSingle).not.toHaveBeenCalled()
})

test('unsupported capability disables corrections without falling back to original ratings', async () => {
  jest.mocked(readCorrectionCapability).mockResolvedValueOnce(false)
  expect(await loadReviewCorrectionState(input)).toMatchObject({
    status: 'success',
    correctionsAvailable: false,
    event: null,
  })
  expect(from.mock.calls).toEqual([['words']])
})

test.each(['word', 'event', 'capability'] as const)(
  '%s read errors do not leak provider details',
  async source => {
    if (source === 'capability')
      jest
        .mocked(readCorrectionCapability)
        .mockRejectedValueOnce(new Error('private provider response'))
    else
      (source === 'word' ? word : event).maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'private provider response' },
      })
    const result = await loadReviewCorrectionState(input)
    expect(result).toEqual({
      status: 'error',
      message:
        'Could not refresh server progress. Try again before continuing.',
    })
  }
)

test.each([
  { assessment: 'unknown', revision: 1 },
  { assessment: 'good', revision: -1 },
  { assessment: 'good', revision: 1.5 },
])('malformed effective event fails closed: %j', async data => {
  event.maybeSingle.mockResolvedValueOnce({ data, error: null })
  expect(await loadReviewCorrectionState(input)).toMatchObject({
    status: 'error',
  })
})

test('a missing effective event preserves readable progress without inventing a rating', async () => {
  event.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect(await loadReviewCorrectionState(input)).toMatchObject({
    status: 'success',
    progress: { wordId: input.wordId },
    event: null,
  })
})

test('an uncorrected event at revision zero is valid', async () => {
  event.maybeSingle.mockResolvedValueOnce({
    data: { assessment: 'good', revision: 0 },
    error: null,
  })
  expect(await loadReviewCorrectionState(input)).toMatchObject({
    status: 'success',
    event: { assessment: 'good', revision: 0 },
  })
})
