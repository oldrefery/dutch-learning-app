import type { SRSAssessmentType } from './srs'

export type ReviewFlowMode =
  'recognition' | 'meaning-recall' | 'dutch-production'

export interface ReviewFlowOption {
  readonly id: string
  readonly label: string
  readonly isCorrect: boolean
}

/** Prepared once by the platform; payloads must be immutable word snapshots. */
export interface ReviewFlowQuestion<T> {
  readonly id: string
  readonly wordId: string
  readonly mode: ReviewFlowMode
  readonly options: readonly ReviewFlowOption[]
  readonly payload: T
}

export interface ReviewFlowSubmission {
  readonly eventId: string
  readonly assessment: SRSAssessmentType
  readonly status: 'saving' | 'failed' | 'saved'
  readonly error: string | null
}

export interface ReviewFlowActive<T> {
  readonly question: ReviewFlowQuestion<T>
  readonly manualRecognition: boolean
  readonly startedAt: number
  readonly answeredAt: number | null
  readonly selectedOptionId: string | null
  readonly answeredCorrectly: boolean | null
  readonly revealed: boolean
  readonly assisted: boolean
  readonly autoPaused: boolean
  readonly submission: ReviewFlowSubmission | null
}

export type ReviewFlowResult =
  | { readonly kind: 'skipped' }
  | {
      readonly kind: 'assessed'
      readonly eventId: string
      readonly originalAssessment: SRSAssessmentType
      readonly assessment: SRSAssessmentType
      readonly revision: number
    }

export interface ReviewFlowHistoryEntry<T> {
  readonly question: ReviewFlowActive<T>
  readonly result: ReviewFlowResult
}

export type ReviewFlowView =
  | { readonly kind: 'current' }
  | { readonly kind: 'details' }
  | {
      readonly kind: 'history'
      readonly index: number
      readonly details: boolean
    }

export interface ReviewFlowState<T> {
  readonly sessionId: string
  readonly userId: string
  readonly active: ReviewFlowActive<T> | null
  readonly remaining: readonly ReviewFlowQuestion<T>[]
  readonly history: readonly ReviewFlowHistoryEntry<T>[]
  readonly view: ReviewFlowView
  readonly manualRecognition: boolean
  readonly foreground: boolean
  readonly closed: boolean
  readonly timerRevision: number
}

export interface ReviewAutoAdvanceTicket {
  readonly sessionId: string
  readonly questionId: string
  readonly timerRevision: number
  readonly notBefore: number
}
