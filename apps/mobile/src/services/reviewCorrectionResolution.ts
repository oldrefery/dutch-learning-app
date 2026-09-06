import { supabase } from '@/lib/supabase'
import { learningOperationQueue } from './learningOperationQueue'
import {
  reviewCorrectionRepository,
  sameReviewCorrectionCommand,
} from '@/db/reviewCorrectionRepository'
import { keepServerReviewCorrection } from '@/db/reviewCorrectionResolutionRepository'
import {
  reviewCorrectionSync,
  ensureCorrectionIdentity,
} from './reviewCorrectionSync'
import type {
  ReviewCorrectionCommand,
  ReviewCorrectionProgress,
} from '@/types/ReviewCorrection'

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
const nonnegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function parseProgress(
  value: unknown,
  command: ReviewCorrectionCommand
): ReviewCorrectionProgress | null {
  if (value === null) return null
  const row =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  if (
    row.user_id !== command.user_id ||
    row.word_id !== command.word_id ||
    !nonnegativeInteger(row.interval_days) ||
    !nonnegativeInteger(row.repetition_count) ||
    typeof row.easiness_factor !== 'number' ||
    !Number.isFinite(row.easiness_factor) ||
    row.easiness_factor < 1.3 ||
    row.easiness_factor > 2.5 ||
    !validDate(row.next_review_date) ||
    !(row.last_reviewed_at === null || validDate(row.last_reviewed_at))
  ) {
    throw new Error('Invalid canonical review progress')
  }
  return row as unknown as ReviewCorrectionProgress
}

/** Explicit Keep server version action. Never called by automatic synchronization. */
export function resolveReviewCorrectionConflict(
  userId: string,
  input: ReviewCorrectionCommand
): Promise<void> {
  // Freeze identity and intent across awaits and repeated UI interactions.
  const command = { ...input }
  return learningOperationQueue.run(() => resolveConflict(userId, command))
}

async function resolveConflict(
  userId: string,
  command: ReviewCorrectionCommand
): Promise<void> {
  if (command.user_id !== userId) throw new Error('Foreign correction command')
  const local = await reviewCorrectionRepository.getById(
    userId,
    command.correction_id
  )
  if (!local || !sameReviewCorrectionCommand(local, command)) {
    throw new Error('Correction changed before resolution')
  }
  if (local.resolved_at) return
  if (local.status === 'pending') {
    throw new Error('Only a confirmed conflict can be resolved')
  }
  await ensureCorrectionIdentity(userId)
  if (!(await reviewCorrectionSync.isAvailable())) {
    throw new Error('Review corrections require an updated backend')
  }
  // Reconcile receipts before releasing a rejected intent. A previously accepted
  // operation may have lost its acknowledgement before a later terminal response.
  await reviewCorrectionSync.pull(userId)
  const { data, error } = await supabase
    .from('words')
    .select(
      'word_id, user_id, interval_days, repetition_count, easiness_factor, next_review_date, last_reviewed_at'
    )
    .eq('user_id', userId)
    .eq('word_id', command.word_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  const progress = parseProgress(data, command)
  await ensureCorrectionIdentity(userId)
  await keepServerReviewCorrection(command, progress)
}
