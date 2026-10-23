import type { DictionaryAnalysisAuth } from './dictionary-analysis-owner'
import type { DictionaryCreationJournalOwner } from './dictionary-creation-journal'

export interface DictionaryCreationOwner extends DictionaryCreationJournalOwner {
  readonly signal: AbortSignal
}
/** Fresh Auth lifetime and mounted context; synchronous callback latches A -> B -> A.
 * Abort covers SDK token acquisition before HTTP. It cannot undo a committed call. */
export async function withDictionaryCreationOwner<T>(
  userId: string,
  auth: DictionaryAnalysisAuth,
  assertCurrent: () => void,
  action: (owner: DictionaryCreationOwner) => Promise<T>,
  contextSignal?: AbortSignal
): Promise<T> {
  assertCurrent()
  const controller = new AbortController()
  const cancel = () => controller.abort()
  contextSignal?.addEventListener('abort', cancel)
  if (contextSignal?.aborted) cancel()
  let changed = false
  const {
    data: { subscription },
  } = auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || session?.user.id !== userId) {
      changed = true
      cancel()
    }
  })
  const assert = () => {
    if (changed)
      throw new Error('Authentication changed during dictionary creation')
    if (controller.signal.aborted) throw new Error('Creation context changed')
    try {
      assertCurrent()
    } catch (error) {
      cancel()
      throw error
    }
  }
  const check = async () => {
    assert()
    const { data, error } = await auth.getUser()
    if (error) throw error
    if (data.user?.id !== userId) {
      changed = true
      cancel()
    }
    assert()
  }
  try {
    await check()
    const result = await action({
      user_id: userId,
      assert,
      check,
      signal: controller.signal,
    })
    await check()
    return result
  } finally {
    cancel()
    contextSignal?.removeEventListener('abort', cancel)
    subscription.unsubscribe()
  }
}
