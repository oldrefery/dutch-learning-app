export const BATCH_CAPTURE_MAX_ITEMS = 30
export const BATCH_CAPTURE_MAX_DUTCH_LENGTH = 120
export const BATCH_CAPTURE_MAX_HINT_LENGTH = 240

export type BatchCaptureItemStatus =
  | 'queued'
  | 'checking_duplicate'
  | 'possible_duplicate'
  | 'analyzing'
  | 'awaiting_review'
  | 'failed'
  | 'completed'
  | 'skipped'
  | 'cancelled'

export interface BatchCaptureDraftItem {
  dutchText: string
  translationHint: string | null
  sourceLine: number
}

export type BatchCaptureParseIssueCode =
  | 'missing_word'
  | 'word_too_long'
  | 'hint_too_long'
  | 'duplicate'
  | 'limit_exceeded'

export interface BatchCaptureParseIssue {
  line: number
  code: BatchCaptureParseIssueCode
  message: string
  blocking: boolean
}

export interface BatchCaptureParseResult {
  items: BatchCaptureDraftItem[]
  issues: BatchCaptureParseIssue[]
  hasBlockingIssues: boolean
}

export interface BatchCaptureDuplicate {
  wordId: string
  collectionId: string | null
  collectionName: string | null
}

export interface BatchCaptureItem extends BatchCaptureDraftItem {
  id: string
  status: BatchCaptureItemStatus
  error: string | null
  duplicate: BatchCaptureDuplicate | null
  createdAt: string
  updatedAt: string
}
