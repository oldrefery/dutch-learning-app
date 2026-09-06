import { reviewCorrectionRecoveryRepository as recovery } from '@/db/reviewCorrectionRecoveryRepository'
import { readCanonicalCorrectionProgress } from './reviewCorrectionResolution'

/** Already inside the learning FIFO. Recovery also runs when no new events were pushed. */
export async function recoverConfirmedReviewCorrections(
  userId: string
): Promise<void> {
  for (const command of await recovery.pending(userId)) {
    if (command.status !== 'synced' && !command.resolved_at) continue
    const progress = await readCanonicalCorrectionProgress(command)
    await recovery.finish(command, progress)
  }
}
