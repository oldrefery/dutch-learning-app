import type { Database as DeployedDatabase } from './database.generated'

// Forward contract for the locally tested, not-yet-deployed protocol migration.
// Remove this overlay after regenerating contracts from the approved deployment.
export type Database = Omit<DeployedDatabase, 'public'> & {
  public: Omit<DeployedDatabase['public'], 'Functions'> & {
    Functions: DeployedDatabase['public']['Functions'] & {
      learning_sync_protocol: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reset_word_learning_progress: {
        Args: {
          p_word_id: string
          p_reset_id: string
          p_reset_at: string
          p_review_date: string
          p_collection_id?: string | null
        }
        Returns: { word_id: string }[]
      }
    }
  }
}
