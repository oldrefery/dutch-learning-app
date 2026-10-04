/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { requireAuthenticatedIdentity } from '@/lib/auth/session'
import { createClient } from './server'

jest.mock('server-only', () => ({}))
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('./server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/env', () => ({
  getSupabasePublicConfig: () => ({
    url: 'https://example.supabase.co',
    publishableKey: 'test-public-key',
  }),
}))
jest.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

const getClaims = jest.fn()
const getUser = jest.fn()
let sessionCookies: {
  getAll: () => { name: string; value: string }[]
  setAll: (
    cookies: {
      name: string
      value: string
      options?: { maxAge?: number; path?: string }
    }[]
  ) => void
}

beforeEach(() => {
  getClaims.mockResolvedValue({
    data: { claims: { sub: 'synthetic-owner' } },
    error: null,
  })
  jest.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    sessionCookies = options.cookies as typeof sessionCookies
    return { auth: { getClaims, getUser } } as unknown as ReturnType<
      typeof createServerClient
    >
  })
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
})

it('lets a revoked session reach sign-in after the protected page redirects there', async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Auth session missing!', status: 400 },
  })
  const protectedResponse = await proxy(
    new NextRequest('https://woordenaar.example/app/collections')
  )
  expect(protectedResponse.headers.get('x-middleware-next')).toBe('1')
  await expect(requireAuthenticatedIdentity()).rejects.toThrow(
    'redirect:/login'
  )
  const loginResponse = await proxy(
    new NextRequest('https://woordenaar.example/login')
  )
  expect(loginResponse.status).toBe(200)
  expect(loginResponse.headers.get('x-middleware-next')).toBe('1')
  expect(getClaims).toHaveBeenCalledTimes(1)
  expect(getUser).toHaveBeenCalledTimes(2)
})

it('keeps the valid-session control consistent across proxy and page guard', async () => {
  getUser.mockResolvedValue({
    data: { user: { id: 'synthetic-owner', email: 'owner@example.invalid' } },
    error: null,
  })
  await expect(requireAuthenticatedIdentity()).resolves.toEqual({
    userId: 'synthetic-owner',
    email: 'owner@example.invalid',
  })
  const response = await proxy(
    new NextRequest('https://woordenaar.example/login')
  )
  expect(response.headers.get('location')).toBe(
    'https://woordenaar.example/app/collections'
  )
})

it.each([
  { user: null, error: null },
  { user: { id: 'synthetic-owner' }, error: { message: 'Auth unavailable' } },
])('keeps sign-in reachable when server validation fails: %j', async result => {
  getUser.mockResolvedValue({
    data: { user: result.user },
    error: result.error,
  })
  const response = await proxy(
    new NextRequest('https://woordenaar.example/login')
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('x-middleware-next')).toBe('1')
})

it.each(['/signup', '/forgot-password'])(
  'keeps %s reachable when the signed session was revoked',
  async route => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session missing!', status: 400 },
    })
    const response = await proxy(
      new NextRequest(`https://woordenaar.example${route}`)
    )
    expect(response.status).toBe(200)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(getClaims).not.toHaveBeenCalled()
  }
)

it('keeps sign-in reachable when server validation throws', async () => {
  getUser.mockRejectedValue(new Error('Auth service unavailable'))
  const response = await proxy(
    new NextRequest('https://woordenaar.example/login')
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('x-middleware-next')).toBe('1')
})

it('keeps both refreshed cookie chunks on a verified login redirect', async () => {
  const request = new NextRequest('https://woordenaar.example/login', {
    headers: { cookie: 'sb-auth.0=old-0; sb-auth.1=old-1' },
  })
  getUser.mockImplementation(async () => {
    expect(sessionCookies.getAll()).toEqual([
      { name: 'sb-auth.0', value: 'old-0' },
      { name: 'sb-auth.1', value: 'old-1' },
    ])
    sessionCookies.setAll([
      { name: 'sb-auth.0', value: 'new-0', options: { path: '/' } },
      { name: 'sb-auth.1', value: 'new-1', options: { path: '/' } },
    ])
    return {
      data: { user: { id: 'synthetic-owner' } },
      error: null,
    }
  })
  const response = await proxy(request)
  expect(response.headers.get('location')).toBe(
    'https://woordenaar.example/app/collections'
  )
  expect(request.cookies.get('sb-auth.0')?.value).toBe('new-0')
  expect(request.cookies.get('sb-auth.1')?.value).toBe('new-1')
  expect(response.cookies.get('sb-auth.0')?.value).toBe('new-0')
  expect(response.cookies.get('sb-auth.1')?.value).toBe('new-1')
})

it('delivers revoked-cookie deletions to the sign-in response', async () => {
  getUser.mockImplementation(async () => {
    sessionCookies.setAll([
      { name: 'sb-auth.0', value: '', options: { path: '/', maxAge: 0 } },
      { name: 'sb-auth.1', value: '', options: { path: '/', maxAge: 0 } },
    ])
    return { data: { user: null }, error: { message: 'Auth session missing!' } }
  })
  const response = await proxy(
    new NextRequest('https://woordenaar.example/login')
  )
  expect(response.status).toBe(200)
  expect(response.cookies.get('sb-auth.0')).toMatchObject({
    value: '',
    maxAge: 0,
  })
  expect(response.cookies.get('sb-auth.1')).toMatchObject({
    value: '',
    maxAge: 0,
  })
})
