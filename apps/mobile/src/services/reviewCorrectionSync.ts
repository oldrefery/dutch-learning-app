import { supabase } from '@/lib/supabase'
import { reviewCorrectionRepository } from '@/db/reviewCorrectionRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import type {
  PendingReviewCorrection,
  ReviewCorrectionReceipt,
} from '@/types/ReviewCorrection'
import type { ReviewEvent } from '@/types/ReviewTypes'

const PAGE_SIZE = 250
const CONFLICT_MESSAGE =
  'Review correction needs attention. Refresh the word and resolve the conflicting edit.'
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const assessment = (value: unknown) =>
  typeof value === 'string' && ['again', 'hard', 'good', 'easy'].includes(value)

function parseReceipt(value: unknown, userId: string): ReviewCorrectionReceipt {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid correction receipt')
  const row = value as Record<string, unknown>
  if (
    !uuid(row.correction_id) ||
    !uuid(row.event_id) ||
    !uuid(row.word_id) ||
    row.user_id !== userId ||
    !integer(row.expected_revision) ||
    row.revision !== row.expected_revision + 1 ||
    !assessment(row.assessment) ||
    !integer(row.next_interval_days) ||
    !integer(row.next_repetition_count) ||
    typeof row.next_easiness_factor !== 'number' ||
    !Number.isFinite(row.next_easiness_factor) ||
    row.next_easiness_factor < 1.3 ||
    row.next_easiness_factor > 2.5 ||
    typeof row.created_at !== 'string' ||
    !Number.isFinite(Date.parse(row.created_at))
  ) {
    throw new Error('Invalid correction receipt')
  }
  return row as unknown as ReviewCorrectionReceipt
}

async function ensureIdentity(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (data.user?.id !== userId)
    throw new Error('Authentication changed during correction synchronization')
}

async function persistReceipts(
  userId: string,
  receipts: ReviewCorrectionReceipt[]
): Promise<void> {
  const tombstones = new Set(
    await reviewCorrectionRepository.getTombstonedWordIds(
      userId,
      receipts.map(row => row.word_id)
    )
  )
  const activeReceipts = receipts.filter(row => !tombstones.has(row.word_id))
  const missing = await reviewCorrectionRepository.getMissingEventIds(
    userId,
    activeReceipts.map(row => row.event_id)
  )
  if (missing.length) {
    const { data, error } = await supabase
      .from('review_events')
      .select('*')
      .eq('user_id', userId)
      .in('event_id', missing)
    if (error) throw error
    if (
      !Array.isArray(data) ||
      new Set(data.map(row => row.event_id)).size !== missing.length ||
      data.some(
        row => row.user_id !== userId || !missing.includes(row.event_id)
      )
    ) {
      throw new Error('Correction history could not be reconciled')
    }
    await reviewEventRepository.saveRemoteEvents(data as ReviewEvent[])
  }
  await reviewCorrectionRepository.saveRemote(userId, activeReceipts)
}

export const reviewCorrectionSync = {
  async isAvailable(): Promise<boolean> {
    const { data, error } = await supabase.rpc('review_correction_protocol')
    if (error?.code === 'PGRST202' || error?.code === '42883') return false
    if (error) throw error
    return data === 1
  },

  async pull(userId: string): Promise<number> {
    await ensureIdentity(userId)
    let count = 0
    // Reconcile the complete correction ledger on every pass. No timestamp
    // cursor can hide a transaction committed later with an earlier timestamp.
    while (true) {
      const { data, error } = await supabase
        .from('review_assessment_corrections')
        .select('*')
        .eq('user_id', userId)
        .order('correction_id')
        .range(count, count + PAGE_SIZE - 1)
      if (error) throw error
      if (!Array.isArray(data))
        throw new Error('Missing correction history response')
      const receipts = data.map(row => parseReceipt(row, userId))
      await persistReceipts(userId, receipts)
      count += receipts.length
      if (receipts.length < PAGE_SIZE) return count
    }
  },

  async push(userId: string, command: PendingReviewCorrection): Promise<void> {
    if (command.user_id !== userId)
      throw new Error('Foreign correction command')
    if (command.status === 'conflict') throw new Error(CONFLICT_MESSAGE)
    await ensureIdentity(userId)
    const { data, error } = await supabase.rpc('correct_review_assessment', {
      p_word_id: command.word_id,
      p_event_id: command.event_id,
      p_correction_id: command.correction_id,
      p_expected_revision: command.expected_revision,
      p_assessment: command.assessment,
    })
    if (error) {
      if (['40001', '22023', '42501'].includes(error.code)) {
        await reviewCorrectionRepository.markConflict(
          userId,
          command.correction_id,
          CONFLICT_MESSAGE
        )
      }
      throw error
    }
    if (
      !Array.isArray(data) ||
      data.length !== 1 ||
      data[0]?.correction_id !== command.correction_id ||
      data[0]?.event_id !== command.event_id ||
      data[0]?.word_id !== command.word_id ||
      data[0]?.accepted_revision !== command.expected_revision + 1
    ) {
      throw new Error('Missing correction acknowledgement')
    }
    // Fetch the immutable receipt for this operation, not the possibly newer
    // effective revision returned by an idempotent retry of the RPC.
    const result = await supabase
      .from('review_assessment_corrections')
      .select('*')
      .eq('user_id', userId)
      .eq('correction_id', command.correction_id)
      .single()
    if (result.error) throw result.error
    const receipt = parseReceipt(result.data, userId)
    if (receipt.correction_id !== command.correction_id)
      throw new Error('Wrong correction receipt')
    await persistReceipts(userId, [receipt])
  },
}
