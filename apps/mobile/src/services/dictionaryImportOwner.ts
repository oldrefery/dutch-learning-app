import { withDictionaryAnalysisOwner } from '@woordenaar/domain'
import { supabase } from '@/lib/supabase'

export interface DictionaryOwnerGuard {
  assert: () => void
  check: () => Promise<void>
}

export async function withDictionaryOwner<Value>(
  userId: string,
  action: (owner: DictionaryOwnerGuard) => Promise<Value>,
  context = 'synchronization'
): Promise<Value> {
  return withDictionaryAnalysisOwner(userId, supabase.auth, action, context)
}

export const withDictionaryImportOwner = <Value>(
  userId: string,
  action: (owner: DictionaryOwnerGuard) => Promise<Value>
): Promise<Value> => withDictionaryOwner(userId, action, 'import')
