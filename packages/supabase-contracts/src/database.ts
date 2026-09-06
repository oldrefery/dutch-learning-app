import type { Database as GeneratedDatabase } from './database.generated'

type PublicSchema = GeneratedDatabase['public']
type ReviewFunction = PublicSchema['Functions']['record_review_assessment']

// PostgreSQL RPC argument metadata does not describe accepted NULL values.
// Recognition reviews may omit correctness/timing; keep this correction separate
// from the generated schema. No undeployed protocol functions are added here.
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<PublicSchema, 'Functions'> & {
    Functions: Omit<PublicSchema['Functions'], 'record_review_assessment'> & {
      record_review_assessment: Omit<ReviewFunction, 'Args'> & {
        Args: Omit<
          ReviewFunction['Args'],
          'p_answered_correctly' | 'p_response_time_ms'
        > & {
          p_answered_correctly: boolean | null
          p_response_time_ms: number | null
        }
      }
    }
  }
}
