import { importSharedCollection } from './actions'
import { isFollowingSharedImportEnabled } from './repository'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('./repository', () => ({
  isFollowingSharedImportEnabled: jest.fn(),
  getOwnedImportContext: jest.fn(),
  loadSharedCollectionRows: jest.fn(),
}))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
it('blocks the legacy private/v1 action before Auth and any database operation', async () => {
  jest.mocked(isFollowingSharedImportEnabled).mockReturnValue(true)
  await expect(
    importSharedCollection(
      'token',
      { status: 'idle', message: '' },
      new FormData()
    )
  ).resolves.toMatchObject({
    status: 'error',
    message: 'Use the explicit shared following import.',
  })
  expect(requireAuthContext).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
})
