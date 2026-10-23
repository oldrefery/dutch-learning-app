import type { Database as TargetDatabase } from './database.target.generated'
import type { DictionaryFollowingImportDatabase } from './dictionary-following-import'

/** Authenticated published candidate reads, with the existing table RLS. */
export type DictionaryMeaningLookupDatabase = Omit<
  DictionaryFollowingImportDatabase,
  'public'
> & {
  public: Omit<DictionaryFollowingImportDatabase['public'], 'Tables'> & {
    Tables: DictionaryFollowingImportDatabase['public']['Tables'] &
      Pick<
        TargetDatabase['public']['Tables'],
        'dictionary_entries' | 'dictionary_entry_heads'
      >
  }
}
