import { createNativeReviewPersistence } from '../persistence'
import { wordRepository } from '@/db/wordRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { vocabulary, userId, deferred } from './fixtures'
import { learningOperationQueue } from '@/services/learningOperationQueue'
import type { NativeReviewSubmission } from '../controller'

jest.mock('@/db/wordRepository')
jest.mock('@/db/reviewEventRepository')
const ACCOUNT_CHANGED = 'account changed'
const input: NativeReviewSubmission = {
  eventId: 'event',
  userId,
  wordId: vocabulary[0].word_id,
  assessment: 'good',
  reviewMode: 'recognition',
  answeredCorrectly: true,
  reviewedAt: '2026-09-06T12:00:00Z',
  responseTimeMs: 500,
}
const word = {
  ...vocabulary[0],
  sync_status: 'synced' as const,
  deleted_at: null,
  last_sync_attempt_at: null,
  synced_at: null,
}

it('waits for sync before reading SRS and freezes input while waiting', async () => {
  const gate = deferred()
  const sync = learningOperationQueue.run(() => gate.promise)
  const command = { ...input }
  const result = createNativeReviewPersistence(userId)(command)
  command.assessment = 'again'
  await Promise.resolve()
  const readsBeforeRelease = jest.mocked(wordRepository.getWordByIdAndUserId)
    .mock.calls.length
  gate.resolve()
  await Promise.all([sync, result])
  expect(readsBeforeRelease).toBe(0)
  expect(reviewEventRepository.recordAssessment).toHaveBeenCalledWith(
    expect.objectContaining({
      event: expect.objectContaining({ assessment: 'good' }),
    })
  )
})

it('rechecks the account after waiting and does not touch the next account data', async () => {
  const gate = deferred()
  const sync = learningOperationQueue.run(() => gate.promise)
  const result = createNativeReviewPersistence(userId)(input)
  useApplicationStore.setState({ currentUserId: 'other', words: [] })
  gate.resolve()
  await sync
  await expect(result).rejects.toThrow(ACCOUNT_CHANGED)
  expect(wordRepository.getWordByIdAndUserId).not.toHaveBeenCalled()
  expect(reviewEventRepository.recordAssessment).not.toHaveBeenCalled()
})
beforeEach(() => {
  jest.clearAllMocks()
  useApplicationStore.setState({ currentUserId: userId, words: vocabulary })
  jest.mocked(wordRepository.getWordByIdAndUserId).mockResolvedValue(word)
  jest
    .mocked(reviewEventRepository.recordAssessment)
    .mockResolvedValue(undefined)
})

it('records an account-scoped durable command and refreshes local progress instead of replaying guessed SRS', async () => {
  const canonical = { ...word, repetition_count: 9 }
  jest
    .mocked(wordRepository.getWordByIdAndUserId)
    .mockResolvedValueOnce(word)
    .mockResolvedValueOnce(canonical)
  await createNativeReviewPersistence(userId)(input)
  expect(reviewEventRepository.recordAssessment).toHaveBeenCalledWith(
    expect.objectContaining({
      idempotent: true,
      event: expect.objectContaining({
        event_id: 'event',
        user_id: userId,
        assessment: 'good',
      }),
    })
  )
  expect(useApplicationStore.getState().words[0].repetition_count).toBe(9)
})

it('retries the exact persistence payload after a committed write followed by a read failure', async () => {
  jest
    .mocked(wordRepository.getWordByIdAndUserId)
    .mockResolvedValueOnce(word)
    .mockRejectedValueOnce(new Error('read failure'))
    .mockResolvedValueOnce(word)
  const persist = createNativeReviewPersistence(userId)
  await expect(persist(input)).rejects.toThrow('read failure')
  await expect(persist({ ...input, eventId: 'new' })).rejects.toThrow(
    'pending answer'
  )
  await persist(input)
  const calls = jest.mocked(reviewEventRepository.recordAssessment).mock.calls
  expect(calls[0][0]).toBe(calls[1][0])
})

it('retains the payload after a failed transaction', async () => {
  jest
    .mocked(reviewEventRepository.recordAssessment)
    .mockRejectedValueOnce(new Error('busy'))
  const persist = createNativeReviewPersistence(userId)
  await expect(persist(input)).rejects.toThrow('busy')
  await persist(input)
  expect(
    jest.mocked(reviewEventRepository.recordAssessment).mock.calls[0][0]
  ).toBe(jest.mocked(reviewEventRepository.recordAssessment).mock.calls[1][0])
})

it('does not write for a foreign account or an unavailable word', async () => {
  const persist = createNativeReviewPersistence(userId)
  await expect(persist({ ...input, userId: 'other' })).rejects.toThrow(
    ACCOUNT_CHANGED
  )
  jest.mocked(wordRepository.getWordByIdAndUserId).mockResolvedValueOnce(null)
  await expect(persist(input)).rejects.toThrow('unavailable')
  expect(reviewEventRepository.recordAssessment).not.toHaveBeenCalled()
})

it('rejects an account switch during preparation and never overwrites the next account cache', async () => {
  jest
    .mocked(wordRepository.getWordByIdAndUserId)
    .mockImplementationOnce(async () => {
      useApplicationStore.setState({ currentUserId: 'other', words: [] })
      return word
    })
  await expect(createNativeReviewPersistence(userId)(input)).rejects.toThrow(
    ACCOUNT_CHANGED
  )
  expect(reviewEventRepository.recordAssessment).not.toHaveBeenCalled()
  expect(useApplicationStore.getState().words).toEqual([])
})

it('does not restore old-account words after a save completes during logout', async () => {
  jest
    .mocked(reviewEventRepository.recordAssessment)
    .mockImplementationOnce(async () => {
      useApplicationStore.setState({ currentUserId: 'other', words: [] })
    })
  await createNativeReviewPersistence(userId)(input)
  expect(useApplicationStore.getState().words).toEqual([])
})
