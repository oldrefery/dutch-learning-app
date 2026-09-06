import { createLearningWordActions } from '../learningWordActions'
import { reviewCorrectionRecoveryRepository as recovery } from '@/db/reviewCorrectionRecoveryRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { wordRepository } from '@/db/wordRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import { learningOperationQueue } from '@/services/learningOperationQueue'
import { createMockWord } from '@/__tests__/helpers/factories'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'
import { calculateNextReview } from '@/utils/srs'

jest.mock('@/db/wordRepository')
jest.mock('@/db/reviewEventRepository')
jest.mock('@/utils/logger')

const userId = 'learning-qa'
const word = createMockWord({ user_id: userId, word_id: 'learning-word' })
const localWord = {
  ...word,
  sync_status: 'synced' as const,
  deleted_at: null,
  synced_at: null,
  last_sync_attempt_at: null,
}
const answer: ReviewAssessment = {
  wordId: word.word_id,
  assessment: 'good',
  timestamp: new Date('2026-09-06T12:00:00Z'),
  reviewMode: 'recognition',
}
const store = useApplicationStore
const actions = () => createLearningWordActions(store.setState, store.getState)

it('blocks Audio Review and reset before preparing stale progress during recovery', async () => {
  jest
    .mocked(recovery.assertReady)
    .mockRejectedValue(new Error('pending correction'))
  expect(await actions().updateWordAfterReview(word.word_id, answer)).toBe(
    false
  )
  await actions().resetWordProgress(word.word_id)
  expect(wordRepository.getWordByIdAndUserId).not.toHaveBeenCalled()
  expect(reviewEventRepository.recordAssessment).not.toHaveBeenCalled()
  expect(wordRepository.resetWordProgress).not.toHaveBeenCalled()
})
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  jest.resetAllMocks()
  store.setState({
    currentUserId: userId,
    words: [word],
    error: null,
    reviewSession: null,
  })
  jest.mocked(wordRepository.getWordByIdAndUserId).mockResolvedValue(localWord)
  jest
    .mocked(reviewEventRepository.recordAssessment)
    .mockResolvedValue(undefined)
  jest.mocked(wordRepository.resetWordProgress).mockResolvedValue(undefined)
})

it('reads SQLite after sync and freezes the original rating and timestamp', async () => {
  const gate = deferred()
  const sync = learningOperationQueue.run(() => gate.promise)
  const command = { ...answer, timestamp: new Date(answer.timestamp) }
  const result = actions().updateWordAfterReview(word.word_id, command)
  command.assessment = 'again'
  command.timestamp.setFullYear(2000)
  const updated = { ...localWord, interval_days: 30, repetition_count: 5 }
  jest.mocked(wordRepository.getWordByIdAndUserId).mockResolvedValue(updated)
  await Promise.resolve()
  const reads = jest.mocked(wordRepository.getWordByIdAndUserId).mock.calls
    .length
  gate.resolve()
  await sync
  await expect(result).resolves.toBe(true)
  expect(reads).toBe(0)
  expect(reviewEventRepository.recordAssessment).toHaveBeenCalledWith(
    expect.objectContaining({
      progress: calculateNextReview(
        { ...updated, assessment: 'good' },
        answer.timestamp
      ),
      event: expect.objectContaining({
        assessment: 'good',
        reviewed_at: answer.timestamp.toISOString(),
        previous_interval_days: 30,
      }),
    })
  )
})

it('claims a review before queueing so double taps cannot record or advance twice', async () => {
  const gate = deferred()
  const sync = learningOperationQueue.run(() => gate.promise)
  const action = actions()
  const first = action.updateWordAfterReview(word.word_id, answer)
  const duplicate = action.updateWordAfterReview(word.word_id, answer)
  gate.resolve()
  await sync
  await expect(first).resolves.toBe(true)
  await expect(duplicate).resolves.toBe(false)
  expect(reviewEventRepository.recordAssessment).toHaveBeenCalledTimes(1)
})

it.each(['review', 'reset'] as const)(
  'discards queued %s after an account change',
  async kind => {
    const gate = deferred()
    const sync = learningOperationQueue.run(() => gate.promise)
    const action = actions()
    const result =
      kind === 'review'
        ? action.updateWordAfterReview(word.word_id, answer)
        : action.resetWordProgress(word.word_id)
    store.setState({ currentUserId: 'next-account', words: [], error: null })
    gate.resolve()
    await Promise.all([sync, result])
    expect(wordRepository.getWordByIdAndUserId).not.toHaveBeenCalled()
    expect(wordRepository.resetWordProgress).not.toHaveBeenCalled()
    expect(reviewEventRepository.recordAssessment).not.toHaveBeenCalled()
    expect(store.getState().words).toEqual([])
    expect(store.getState().error).toBeNull()
  }
)

it.each(['review', 'reset'] as const)(
  'does not restore the old cache when %s commits after logout',
  async kind => {
    const commit = async () => {
      store.setState({ currentUserId: null, words: [] })
    }
    jest
      .mocked(reviewEventRepository.recordAssessment)
      .mockImplementation(commit)
    jest.mocked(wordRepository.resetWordProgress).mockImplementation(commit)
    const action = actions()
    if (kind === 'review')
      await expect(
        action.updateWordAfterReview(word.word_id, answer)
      ).resolves.toBe(false)
    else await action.resetWordProgress(word.word_id)
    expect(store.getState().words).toEqual([])
    expect(store.getState().error).toBeNull()
  }
)

it('merges progress into the latest cache without reverting metadata or other words', async () => {
  const another = createMockWord({ user_id: userId, word_id: 'another-word' })
  jest
    .mocked(reviewEventRepository.recordAssessment)
    .mockImplementation(async () => {
      store.setState({ words: [{ ...word, image_url: 'new-image' }, another] })
    })
  await actions().updateWordAfterReview(word.word_id, answer)
  expect(store.getState().words[0].image_url).toBe('new-image')
  expect(store.getState().words[1]).toBe(another)
})

it('suppresses a duplicate reset and releases the claim after failure', async () => {
  const gate = deferred()
  const sync = learningOperationQueue.run(() => gate.promise)
  const action = actions()
  jest
    .mocked(wordRepository.resetWordProgress)
    .mockRejectedValueOnce(new Error('Reset failed'))
  const first = action.resetWordProgress(word.word_id)
  const duplicate = action.resetWordProgress(word.word_id)
  gate.resolve()
  await Promise.all([sync, first, duplicate])
  expect(wordRepository.resetWordProgress).toHaveBeenCalledTimes(1)
  await action.resetWordProgress(word.word_id)
  expect(wordRepository.resetWordProgress).toHaveBeenCalledTimes(2)
})

it('uses the committed reset state when a review is queued immediately after reset', async () => {
  let databaseWord = { ...localWord, interval_days: 30, repetition_count: 5 }
  const order: string[] = []
  jest.mocked(wordRepository.resetWordProgress).mockImplementation(async () => {
    order.push('reset')
    databaseWord = { ...databaseWord, interval_days: 1, repetition_count: 0 }
  })
  jest
    .mocked(wordRepository.getWordByIdAndUserId)
    .mockImplementation(async () => databaseWord)
  jest
    .mocked(reviewEventRepository.recordAssessment)
    .mockImplementation(async () => {
      order.push('review')
    })
  const action = actions()
  await Promise.all([
    action.resetWordProgress(word.word_id),
    action.updateWordAfterReview(word.word_id, answer),
  ])
  expect(order).toEqual(['reset', 'review'])
  expect(reviewEventRepository.recordAssessment).toHaveBeenCalledWith(
    expect.objectContaining({
      event: expect.objectContaining({ previous_interval_days: 1 }),
      progress: calculateNextReview(
        { ...databaseWord, assessment: 'good' },
        answer.timestamp
      ),
    })
  )
})
jest.mock('@/db/reviewCorrectionRecoveryRepository')
