/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAuthContext } from './session'

jest.mock('server-only', () => ({}))
// React request caching needs a server dispatcher; test the authorization body here.
jest.mock('react', () => ({ cache: (callback: unknown) => callback }))
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const getUser = jest.fn()
const maybeSingle = jest.fn()
const eq = jest.fn(() => ({ maybeSingle }))
const select = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ select }))

beforeEach(() => {
  jest
    .mocked(createClient)
    .mockResolvedValue({ auth: { getUser }, from } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
  getUser.mockResolvedValue({
    data: { user: { id: 'verified-id', email: 'qa@example.test' } },
    error: null,
  })
})

it.each([
  { user: null, error: null },
  { user: { id: 'untrusted-id' }, error: { message: 'JWT expired' } },
])(
  'denies unauthenticated requests even if an errored response contains a user: %j',
  async result => {
    getUser.mockResolvedValue({
      data: { user: result.user },
      error: result.error,
    })
    await expect(requireAuthContext()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
    expect(from).not.toHaveBeenCalled()
  }
)

it.each(['full_access', 'read_only', 'unknown', null])(
  'derives access from the verified user and fails closed for %s',
  async accessLevel => {
    maybeSingle.mockResolvedValue({
      data: accessLevel ? { access_level: accessLevel } : null,
    })
    expect(await requireAuthContext()).toEqual({
      userId: 'verified-id',
      email: 'qa@example.test',
      accessLevel: accessLevel === 'full_access' ? 'full_access' : 'read_only',
    })
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('user_access_levels')
    expect(select).toHaveBeenCalledWith('access_level')
    expect(eq).toHaveBeenCalledWith('user_id', 'verified-id')
    expect(redirect).not.toHaveBeenCalled()
  }
)

it('supports a verified user without an email and a failed access-level lookup', async () => {
  getUser.mockResolvedValue({
    data: { user: { id: 'verified-id' } },
    error: null,
  })
  maybeSingle.mockResolvedValue({
    data: null,
    error: { message: 'Unavailable' },
  })
  expect(await requireAuthContext()).toEqual({
    userId: 'verified-id',
    email: null,
    accessLevel: 'read_only',
  })
})
