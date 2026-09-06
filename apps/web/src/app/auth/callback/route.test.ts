/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const exchangeCodeForSession = jest.fn()
const origin = 'https://woordenaar.example'

beforeEach(() => {
  jest.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  exchangeCodeForSession.mockResolvedValue({ error: null })
})

it.each([
  ['/share/qa-invite?source=friend', '/share/qa-invite?source=friend'],
  ['/app/review', '/app/review'],
  ['https://external.example', '/app/collections'],
  ['//external.example', '/app/collections'],
])(
  'exchanges the exact code and restricts destination %s',
  async (next, destination) => {
    const query = new URLSearchParams({ code: 'one-time-code', next })
    const response = await GET(
      new NextRequest(`${origin}/auth/callback?${query}`)
    )
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(exchangeCodeForSession).toHaveBeenCalledWith('one-time-code')
    expect(response.headers.get('location')).toBe(`${origin}${destination}`)
  }
)

it.each(['', '?code='])(
  'does not initialize a client without an authorization code: %s',
  async query => {
    const response = await GET(
      new NextRequest(`${origin}/auth/callback${query}`)
    )
    expect(response.headers.get('location')).toBe(`${origin}/auth/error`)
    expect(createClient).not.toHaveBeenCalled()
  }
)

it('redirects a rejected or already-used code to the auth error page', async () => {
  exchangeCodeForSession.mockResolvedValue({
    error: { message: 'PKCE verifier invalid' },
  })
  const response = await GET(
    new NextRequest(`${origin}/auth/callback?code=used-code&next=/app/review`)
  )
  expect(response.headers.get('location')).toBe(`${origin}/auth/error`)
})

it('uses collections after a successful exchange without a next destination', async () => {
  const response = await GET(
    new NextRequest(`${origin}/auth/callback?code=one-time-code`)
  )
  expect(response.headers.get('location')).toBe(`${origin}/app/collections`)
})
