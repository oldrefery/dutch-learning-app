import type { Word } from './database'

export type ReviewMode = 'recognition' | 'meaning-recall' | 'dutch-production'

export type ReviewScope = 'all-due' | 'collection-due' | 'difficult-due'

interface BaseReviewSessionConfig {
  mode: ReviewMode
}

export type ReviewSessionConfig =
  | (BaseReviewSessionConfig & {
      scope: 'all-due'
      collectionId?: never
    })
  | (BaseReviewSessionConfig & {
      scope: 'collection-due'
      collectionId: string
    })
  | (BaseReviewSessionConfig & {
      scope: 'difficult-due'
      collectionId?: never
    })

export interface ReviewSession {
  words: Word[]
  currentIndex: number
  completedCount: number
  config: ReviewSessionConfig
}
