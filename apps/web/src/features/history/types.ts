export interface ReviewHistoryEvent {
  answeredCorrectly: boolean | null
  assessment: string
  collectionId: string | null
  collectionName: string | null
  dutchLemma: string | null
  eventId: string
  nextEasinessFactor: number
  nextIntervalDays: number
  previousEasinessFactor: number
  previousIntervalDays: number
  responseTimeMs: number | null
  reviewMode: string
  reviewedAt: string
  wordId: string
}
