/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { NextRequest, NextResponse } from 'next/server'
// The installed Next.js package still exports the pre-Proxy helper name.
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { refreshSession } from '@/lib/supabase/proxy'
import { config, proxy } from './proxy'

jest.mock('@/lib/supabase/proxy', () => ({ refreshSession: jest.fn() }))

const refresh = jest.mocked(refreshSession)
const origin = 'https://woordenaar.example'

describe('session-preserving route protection', () => {
  it.each([
    '/app',
    '/app/collections',
    '/app/collections/id/words/id',
    '/share/token',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ])('runs the refresh proxy for %s', url => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      true
    )
  })

  it.each([
    '/',
    '/about',
    '/_next/static/app.js',
    '/favicon.ico',
    '/auth/callback?code=example',
  ])('does not intercept public assets or the code-exchange route %s', url => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(
      false
    )
  })

  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T12:00:00Z'))
  )
  afterEach(() => jest.useRealTimers())
  it.each(['/login', '/signup', '/forgot-password'])(
    'keeps all rotated token chunks on the authenticated redirect from %s',
    async route => {
      const sessionResponse = NextResponse.next()
      for (const name of ['sb-auth.0', 'sb-auth.1']) {
        sessionResponse.cookies.set(name, `rotated-${name}`, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 3600,
        })
      }
      refresh.mockResolvedValue({
        response: sessionResponse,
        isAuthenticated: true,
      })
      const response = await proxy(new NextRequest(`${origin}${route}`))
      expect(response.headers.get('location')).toBe(`${origin}/app/collections`)
      expect(response.cookies.getAll()).toEqual(
        sessionResponse.cookies.getAll()
      )
    }
  )

  it.each(['/app/collections?sort=due', '/share/invite'])(
    'clears rejected session cookies and preserves the next URL for %s',
    async route => {
      const sessionResponse = NextResponse.next()
      sessionResponse.cookies.set('sb-auth', '', { maxAge: 0, path: '/' })
      refresh.mockResolvedValue({
        response: sessionResponse,
        isAuthenticated: false,
      })
      const response = await proxy(new NextRequest(`${origin}${route}`))
      const location = new URL(response.headers.get('location')!)
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('next')).toBe(route)
      expect(response.cookies.getAll()).toEqual(
        sessionResponse.cookies.getAll()
      )
    }
  )

  it.each([
    ['/app/review', true],
    ['/reset-password', true],
    ['/reset-password', false],
    ['/login', false],
  ] as const)(
    'returns the original refresh response for %s (authenticated=%s)',
    async (route, isAuthenticated) => {
      const response = NextResponse.next()
      refresh.mockResolvedValue({ response, isAuthenticated })
      expect(await proxy(new NextRequest(`${origin}${route}`))).toBe(response)
    }
  )
})
