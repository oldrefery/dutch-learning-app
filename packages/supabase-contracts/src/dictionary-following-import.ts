import type { Database } from './database'
import type { Database as TargetDatabase } from './database.target.generated'

/** Only the existing dormant target's authenticated imports and public revisions. */
export type DictionaryFollowingImportDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions' | 'Tables'> & {
    Tables: Database['public']['Tables'] &
      Pick<TargetDatabase['public']['Tables'], 'dictionary_revisions'>
    Functions: Database['public']['Functions'] &
      Pick<
        TargetDatabase['public']['Functions'],
        | 'dictionary_content_capability_v2'
        | 'get_dictionary_effective_content_v2'
        | 'apply_dictionary_import_intent_v2'
        | 'read_dictionary_import_recovery_v2'
        | 'recover_dictionary_import_v2'
        | 'cancel_dictionary_import_v2'
        | 'export_dictionary_collection_v2'
        | 'get_shared_dictionary_collection_v2'
      >
  }
}
