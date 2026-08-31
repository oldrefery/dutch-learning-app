import type { Json } from '@woordenaar/supabase-contracts'

export type ReviewMode = 'recognition' | 'meaning-recall' | 'dutch-production'

export type ReviewSessionMode = ReviewMode | 'adaptive'
export type ReviewScope = 'all-due' | 'collection-due' | 'difficult-due'
export type ReviewAssessment = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewWord {
  article: string | null
  collectionId: string | null
  dutchLemma: string
  dutchOriginal: string | null
  easinessFactor: number
  id: string
  imageUrl: string | null
  intervalDays: number
  lastReviewedAt: string | null
  nextReviewDate: string
  partOfSpeech: string | null
  repetitionCount: number
  translations: Json
  ttsUrl: string | null
}

export interface ReviewCollection {
  id: string
  name: string
}

export interface ReviewEventEvidence {
  answeredCorrectly: boolean | null
  assessment: ReviewAssessment
  eventId: string
  reviewMode: ReviewMode
  reviewedAt: string
  wordId: string
}

export interface ReviewWorkspaceData {
  collections: ReviewCollection[]
  events: ReviewEventEvidence[]
  words: ReviewWord[]
}

export interface AdaptiveReviewModeDecision {
  mode: ReviewMode
  previousMode: ReviewMode | null
  reason: 'default' | 'promotion' | 'demotion'
}

export interface RecognitionOption {
  id: string
  isCorrect: boolean
  label: string
}

export interface ReviewProgressUpdate {
  easinessFactor: number
  intervalDays: number
  lastReviewedAt: string
  nextReviewDate: string
  repetitionCount: number
  wordId: string
}

export interface ReviewSubmissionInput {
  answeredCorrectly: boolean | null
  assessment: ReviewAssessment
  eventId: string
  responseTimeMs: number
  reviewDate: string
  reviewedAt: string
  reviewMode: ReviewMode
  wordId: string
}

export type ReviewSubmissionResult =
  | { status: 'success'; update: ReviewProgressUpdate }
  | { status: 'error'; message: string }
