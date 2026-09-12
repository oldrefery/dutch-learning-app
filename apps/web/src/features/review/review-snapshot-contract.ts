import type { Json } from '@woordenaar/supabase-contracts'
import type { ReviewCorrectionDatabase } from './correction-contract'

/** Planned additive schema, scoped to callers that support snapshot rollout. */
export type ReviewSnapshotDatabase = Omit<
  ReviewCorrectionDatabase,
  'public'
> & {
  public: Omit<ReviewCorrectionDatabase['public'], 'Functions'> & {
    Functions: ReviewCorrectionDatabase['public']['Functions'] & {
      get_web_review_snapshot_v1: {
        Args: Record<string, never>
        Returns: Json
      }
    }
  }
}
