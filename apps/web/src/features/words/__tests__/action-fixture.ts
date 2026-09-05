import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const collectionId = '11111111-1111-4111-8111-111111111111'
export const wordId = '22222222-2222-4222-8222-222222222222'
export const targetId = '33333333-3333-4333-8333-333333333333'
export const userId = 'verified-user'
export const collectionPath = `/app/collections/${collectionId}`
export const wordPath = `${collectionPath}/words/${wordId}`
export const redirectSignal = new Error('NEXT_REDIRECT')
export const from = jest.fn()
export const invoke = jest.fn()
export const rpc = jest.fn()

export const form = (fields: Record<string, string> = {}) => {
  const result = new FormData()
  for (const [key, value] of Object.entries(fields)) result.set(key, value)
  return result
}

export function queueQuery(
  data: unknown = { word_id: wordId },
  error: unknown = null
) {
  const query = {
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  }
  from.mockReturnValueOnce(query)
  return query
}

export function setupActions() {
  from.mockReset()
  invoke.mockReset()
  rpc.mockReset()
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId,
    email: null,
    accessLevel: 'full_access',
  })
  jest.mocked(createClient).mockResolvedValue({
    from,
    rpc,
    functions: { invoke },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(redirect).mockImplementation(() => {
    throw redirectSignal
  })
}

export function expectOwnedWord(query: ReturnType<typeof queueQuery>) {
  expect(query.eq.mock.calls).toEqual([
    ['word_id', wordId],
    ['collection_id', collectionId],
    ['user_id', userId],
  ])
  expect(query.is.mock.calls).toEqual([['deleted_at', null]])
  expect(query.maybeSingle).toHaveBeenCalledTimes(1)
}

export function expectNoSuccessEffects() {
  expect(revalidatePath).not.toHaveBeenCalled()
  expect(redirect).not.toHaveBeenCalled()
}
