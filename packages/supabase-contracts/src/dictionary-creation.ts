import type { Database } from './database'
import type { Database as TargetDatabase } from './database.target.generated'

/** Owner RPCs only. Reviewed identity registration/resolution stays service-only. */
export type DictionaryCreationDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] &
      Pick<
        TargetDatabase['public']['Functions'],
        | 'request_dictionary_meaning_resolution_v2'
        | 'get_dictionary_meaning_resolution_v2'
        | 'accept_dictionary_creation_v2'
        | 'get_dictionary_creation_operation_v2'
        | 'dictionary_content_capability_v2'
        | 'dictionary_analysis_actor_v1'
      >
  }
}
