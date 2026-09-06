import { createNativeCorrectionTransport } from '../correctionTransport'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { reviewCorrectionRepository as corrections } from '@/db/reviewCorrectionRepository'
import { reviewCorrectionRecoveryRepository as recovery } from '@/db/reviewCorrectionRecoveryRepository'
import { wordRepository } from '@/db/wordRepository'
import { syncManager } from '@/services/syncManager'
import {
  ensureCorrectionIdentity,
  reviewCorrectionSync,
} from '@/services/reviewCorrectionSync'
import {
  readCanonicalCorrectionProgress,
  resolveReviewCorrectionConflict,
} from '@/services/reviewCorrectionResolution'
import { learningOperationQueue } from '@/services/learningOperationQueue'
import { vocabulary, userId, deferred } from './fixtures'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'

jest.mock('@/db/reviewCorrectionRepository')
jest.mock('@/db/reviewCorrectionRecoveryRepository')
jest.mock('@/db/wordRepository')
jest.mock('@/services/syncManager', () => ({
  syncManager: { performSync: jest.fn() },
}))
jest.mock('@/services/reviewCorrectionSync')
jest.mock('@/services/reviewCorrectionResolution')
const command: ReviewCorrectionCommand = {
  correction_id: 'edit',
  event_id: 'event',
  word_id: 'word-0',
  user_id: userId,
  expected_revision: 0,
  assessment: 'hard',
}
const effective = {
  eventId: 'event',
  wordId: 'word-0',
  assessment: 'hard' as const,
  revision: 1,
}
const local = {
  ...command,
  status: 'synced' as const,
  resolved_at: null,
  error: null,
}
const word = {
  ...vocabulary[0],
  interval_days: 8,
  sync_status: 'synced' as const,
  deleted_at: null,
  synced_at: null,
  last_sync_attempt_at: null,
}
beforeEach(() => {
  jest.resetAllMocks()
  useApplicationStore.setState({ currentUserId: userId, words: vocabulary })
  jest.mocked(reviewCorrectionSync.isAvailable).mockResolvedValue(true)
  jest.mocked(corrections.getById).mockResolvedValue(local)
  jest.mocked(recovery.pending).mockResolvedValue([])
  jest.mocked(recovery.effective).mockResolvedValue(effective)
  jest.mocked(wordRepository.getWordByIdAndUserId).mockResolvedValue(word)
  jest.mocked(readCanonicalCorrectionProgress).mockResolvedValue(word)
})

it('persists intent before sync and only reports success after canonical reconciliation', async () => {
  const transport = createNativeCorrectionTransport(userId)
  const result = await transport.apply(command)
  expect(result).toEqual({ kind: 'confirmed', result: effective })
  expect(corrections.enqueue).toHaveBeenCalledWith(command)
  expect(syncManager.performSync).toHaveBeenCalledWith(userId)
  expect(recovery.finish).toHaveBeenCalledWith(command, word)
  expect(
    jest.mocked(corrections.enqueue).mock.invocationCallOrder[0]
  ).toBeLessThan(
    jest.mocked(syncManager.performSync).mock.invocationCallOrder[0]
  )
  expect(useApplicationStore.getState().words[0].interval_days).toBe(8)
})

it('does not enqueue when the backend lacks correction support', async () => {
  jest.mocked(reviewCorrectionSync.isAvailable).mockResolvedValue(false)
  await expect(
    createNativeCorrectionTransport(userId).apply(command)
  ).rejects.toThrow('updated backend')
  expect(corrections.enqueue).not.toHaveBeenCalled()
  expect(syncManager.performSync).not.toHaveBeenCalled()
})

it('retains the operation when refresh fails after the receipt arrived', async () => {
  jest
    .mocked(readCanonicalCorrectionProgress)
    .mockRejectedValue(new Error('offline'))
  await expect(
    createNativeCorrectionTransport(userId).apply(command)
  ).rejects.toThrow('offline')
  expect(recovery.finish).not.toHaveBeenCalled()
  expect(useApplicationStore.getState().words).toEqual(vocabulary)
})

it('does not confuse an unacknowledged local write with success', async () => {
  jest
    .mocked(corrections.getById)
    .mockResolvedValue({ ...local, status: 'pending' })
  await expect(
    createNativeCorrectionTransport(userId).apply(command)
  ).rejects.toThrow('not confirmed')
  expect(recovery.finish).not.toHaveBeenCalled()
})

it('offers conflict resolution without silently refreshing away the rejected rating', async () => {
  jest
    .mocked(corrections.getById)
    .mockResolvedValue({ ...local, status: 'conflict' })
  const transport = createNativeCorrectionTransport(userId)
  expect(await transport.apply(command)).toEqual({ kind: 'conflict' })
  expect(resolveReviewCorrectionConflict).not.toHaveBeenCalled()
  expect(await transport.keepServer(command)).toEqual(effective)
  expect(resolveReviewCorrectionConflict).toHaveBeenCalledWith(userId, command)
})

it('restores the original operation after restart without making a network request', async () => {
  jest.mocked(recovery.pending).mockResolvedValue([local])
  expect(await createNativeCorrectionTransport(userId).loadPending!()).toEqual(
    local
  )
  expect(ensureCorrectionIdentity).not.toHaveBeenCalled()
})

it('rechecks ownership after waiting for the shared learning queue', async () => {
  const gate = deferred()
  const waiting = learningOperationQueue.run(() => gate.promise)
  const work = createNativeCorrectionTransport(userId).apply(command)
  useApplicationStore.setState({ currentUserId: 'other', words: [] })
  gate.resolve()
  await waiting
  await expect(work).rejects.toThrow('account changed')
  expect(corrections.enqueue).not.toHaveBeenCalled()
})

it('does not apply late canonical progress to another account', async () => {
  jest.mocked(readCanonicalCorrectionProgress).mockImplementation(async () => {
    useApplicationStore.setState({ currentUserId: 'other', words: [] })
    return word
  })
  await expect(
    createNativeCorrectionTransport(userId).apply(command)
  ).rejects.toThrow('account changed')
  expect(recovery.finish).not.toHaveBeenCalled()
  expect(useApplicationStore.getState().words).toEqual([])
})

it('allows cancellation only if no durable intent was written', async () => {
  const transport = createNativeCorrectionTransport(userId)
  expect(await transport.cancelUnqueued!(command)).toBe(false)
  jest.mocked(corrections.getById).mockResolvedValue(null)
  expect(await transport.cancelUnqueued!(command)).toBe(true)
  expect(recovery.finish).not.toHaveBeenCalled()
})
