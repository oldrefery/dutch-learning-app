import type { SRSAssessmentType } from '@woordenaar/domain'
import type { NativeReviewFlow } from './controller'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'

export interface CorrectionResult {
  eventId: string
  wordId: string
  revision: number
  assessment: SRSAssessmentType
}

/** Success means durable intent AND canonical SRS reconciliation, not just receipt. */
export interface NativeCorrectionTransport {
  ownsSession: () => boolean
  loadPending?: () => Promise<
    | (ReviewCorrectionCommand & { status: 'pending' | 'synced' | 'conflict' })
    | null
  >
  cancelUnqueued?: (
    command: Readonly<ReviewCorrectionCommand>
  ) => Promise<boolean>
  apply: (
    command: Readonly<ReviewCorrectionCommand>
  ) => Promise<
    { kind: 'confirmed'; result: CorrectionResult } | { kind: 'conflict' }
  >
  keepServer: (
    command: Readonly<ReviewCorrectionCommand>
  ) => Promise<CorrectionResult | null>
}

export interface NativeCorrectionState {
  status:
    | 'unavailable'
    | 'checking'
    | 'loadFailed'
    | 'idle'
    | 'saving'
    | 'retry'
    | 'conflict'
    | 'resolving'
  command: Readonly<ReviewCorrectionCommand> | null
  lockedEvents: readonly string[]
  notice: string | null
}

export interface CorrectionTarget {
  getSnapshot: () => NativeReviewFlow
  transition: (change: (state: NativeReviewFlow) => NativeReviewFlow) => void
  blockWrites: (blocked: boolean) => void
}
