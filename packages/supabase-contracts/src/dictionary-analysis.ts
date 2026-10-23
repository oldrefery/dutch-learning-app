import type { Database } from './database'
import type { Database as TargetDatabase } from './database.target.generated'

/** Additive RPC projection from the generated dormant target schema. */
export type DictionaryAnalysisDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] &
      Pick<
        TargetDatabase['public']['Functions'],
        | 'dictionary_analysis_actor_v1'
        | 'dictionary_content_capability_v2'
        | 'get_dictionary_analysis_operation_v2'
        | 'get_dictionary_effective_content_v2'
      >
  }
}
