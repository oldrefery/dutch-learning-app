import { supabase } from '@/lib/supabase'

export async function withDictionaryImportOwner<Value>(
  userId: string,
  action: (owner: {
    assert: () => void
    check: () => Promise<void>
  }) => Promise<Value>
): Promise<Value> {
  let changed = false
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== userId) changed = true
  })
  const assert = () => {
    if (changed)
      throw new Error('Authentication changed during dictionary import')
  }
  const check = async () => {
    assert()
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (data.user?.id !== userId) changed = true
    assert()
  }
  try {
    await check()
    return await action({ assert, check })
  } finally {
    subscription.unsubscribe()
  }
}
