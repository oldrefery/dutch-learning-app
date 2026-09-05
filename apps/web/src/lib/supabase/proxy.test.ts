/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { refreshSession } from './proxy'

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('@/lib/env', () => ({
  getSupabasePublicConfig: () => ({
    url: 'https://example.supabase.co',
    publishableKey: 'test-public-key',
  }),
}))

type Cookie = { name: string; value: string; options?: CookieOptions }
type Cookies = { getAll: () => Cookie[]; setAll: (cookies: Cookie[]) => void }
const getClaims = jest.fn()
let cookies: Cookies

beforeEach(() => {
  jest.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    cookies = options.cookies as Cookies
    return { auth: { getClaims } } as unknown as ReturnType<
      typeof createServerClient
    >
  })
})

it('propagates SDK token refresh to both downstream request and browser response', async () => {
  const request = new NextRequest('https://woordenaar.example/app/review', {
    headers: { cookie: 'sb-auth=expired-token' },
  })
  const renewed: Cookie = {
    name: 'sb-auth',
    value: 'renewed-token',
    options: {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3600,
    },
  }
  getClaims.mockImplementation(async () => {
    expect(cookies.getAll()).toEqual([
      { name: 'sb-auth', value: 'expired-token' },
    ])
    cookies.setAll([renewed])
    return { data: { claims: { sub: 'verified-user' } }, error: null }
  })
  const result = await refreshSession(request)
  expect(result.isAuthenticated).toBe(true)
  expect(getClaims).toHaveBeenCalledTimes(1)
  expect(request.cookies.get('sb-auth')?.value).toBe('renewed-token')
  expect(result.response.headers.get('x-middleware-request-cookie')).toContain(
    'sb-auth=renewed-token'
  )
  expect(result.response.cookies.get('sb-auth')).toMatchObject({
    name: renewed.name,
    value: renewed.value,
    ...renewed.options,
  })
})

it.each([
  { data: {}, error: null },
  { data: null, error: null },
  { data: null, error: { message: 'Refresh token expired' } },
  { data: { claims: {} }, error: null },
  {
    data: { claims: { sub: 'untrusted' } },
    error: { message: 'Invalid signature' },
  },
])(
  'does not authenticate failed or missing verified claims: %j',
  async claims => {
    getClaims.mockResolvedValue(claims)
    expect(
      (await refreshSession(new NextRequest('https://woordenaar.example/app')))
        .isAuthenticated
    ).toBe(false)
  }
)

it('forwards existing request cookies even when no rotation is necessary', async () => {
  getClaims.mockResolvedValue({
    data: { claims: { sub: 'verified-user' } },
    error: null,
  })
  const request = new NextRequest('https://woordenaar.example/app', {
    headers: { cookie: 'sb-auth=valid-token' },
  })
  const result = await refreshSession(request)
  expect(result.response.headers.get('x-middleware-request-cookie')).toBe(
    'sb-auth=valid-token'
  )
  expect(result.response.cookies.getAll()).toEqual([])
  expect(result.isAuthenticated).toBe(true)
})
