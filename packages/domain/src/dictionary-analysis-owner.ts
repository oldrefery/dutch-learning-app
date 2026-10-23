import type { DictionaryAnalysisClientOwner } from './dictionary-analysis-client'

export interface DictionaryAnalysisAuth {
  onAuthStateChange(
    callback: (event: string, session: { user: { id: string } } | null) => void
  ): { data: { subscription: { unsubscribe(): void } } }
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>
}

/** Latch the entire captured-owner lifetime, including A -> B -> A.
 * The auth callback performs no async SDK calls. */
export async function withDictionaryAnalysisOwner<T>(
  userId: string,
  auth: DictionaryAnalysisAuth,
  action: (owner: DictionaryAnalysisClientOwner) => Promise<T>,
  context = 'shared analysis'
): Promise<T> {
  let changed = false
  const {
    data: { subscription },
  } = auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || session?.user.id !== userId) changed = true
  })
  const assert = () => {
    if (changed)
      throw new Error(`Authentication changed during dictionary ${context}`)
  }
  const check = async () => {
    assert()
    const { data, error } = await auth.getUser()
    if (error) throw error
    if (data.user?.id !== userId) changed = true
    assert()
  }
  try {
    await check()
    const result = await action({ assert, check })
    assert()
    return result
  } finally {
    subscription.unsubscribe()
  }
}
