import { useApplicationStore } from '@/stores/useApplicationStore'
import { reviewCorrectionRepository as corrections } from '@/db/reviewCorrectionRepository'
import { reviewCorrectionRecoveryRepository as recovery } from '@/db/reviewCorrectionRecoveryRepository'
import { wordRepository } from '@/db/wordRepository'
import { learningOperationQueue } from '@/services/learningOperationQueue'
import { syncManager } from '@/services/syncManager'
import {
  ensureCorrectionIdentity,
  reviewCorrectionSync,
} from '@/services/reviewCorrectionSync'
import {
  readCanonicalCorrectionProgress,
  resolveReviewCorrectionConflict,
} from '@/services/reviewCorrectionResolution'
import type { NativeCorrectionTransport } from './correctionController'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'

export function createNativeCorrectionTransport(
  userId: string
): NativeCorrectionTransport {
  const ownsSession = () =>
    useApplicationStore.getState().currentUserId === userId
  const requireOwner = () => {
    if (!ownsSession()) throw new Error('Review account changed')
  }
  const refresh = async (command: ReviewCorrectionCommand) => {
    requireOwner()
    const progress = await readCanonicalCorrectionProgress(command)
    requireOwner()
    await recovery.finish(command, progress)
    const effective = await recovery.effective(command)
    const word = await wordRepository.getWordByIdAndUserId(
      command.word_id,
      userId
    )
    requireOwner()
    useApplicationStore.setState(state => ({
      words: state.words.flatMap(existing =>
        existing.word_id === command.word_id ? (word ? [word] : []) : [existing]
      ),
    }))
    return effective
  }
  return {
    ownsSession,
    cancelUnqueued: command =>
      learningOperationQueue.run(async () => {
        requireOwner()
        if (command.user_id !== userId)
          throw new Error('Foreign correction command')
        const local = await corrections.getById(userId, command.correction_id)
        requireOwner()
        return local === null
      }),
    loadPending: () =>
      learningOperationQueue.run(async () => {
        requireOwner()
        const pending = await recovery.pending(userId)
        requireOwner()
        return pending[0] ?? null
      }),
    apply: async command => {
      if (command.user_id !== userId)
        throw new Error('Foreign correction command')
      await learningOperationQueue.run(async () => {
        requireOwner()
        await ensureCorrectionIdentity(userId)
        if (!(await reviewCorrectionSync.isAvailable()))
          throw new Error('Review corrections require an updated backend')
        requireOwner()
        await corrections.enqueue(command)
      })
      await syncManager.performSync(userId)
      return learningOperationQueue.run(async () => {
        requireOwner()
        const local = await corrections.getById(userId, command.correction_id)
        if (local?.status === 'conflict') return { kind: 'conflict' as const }
        if (local?.status !== 'synced')
          throw new Error('Correction not confirmed')
        const result = await refresh(command)
        return result
          ? { kind: 'confirmed' as const, result }
          : { kind: 'conflict' as const }
      })
    },
    keepServer: async command => {
      requireOwner()
      await resolveReviewCorrectionConflict(userId, command)
      return learningOperationQueue.run(() => refresh(command))
    },
  }
}
