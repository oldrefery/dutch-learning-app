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

beforeEach(() => {
  getClaims.mockResolvedValue({
    data: { claims: { sub: 'synthetic-owner' } },
    error: null,
  })
  jest.mocked(createServerClient).mockReturnValue({
    auth: { getClaims, getUser },
  } as unknown as ReturnType<typeof createServerClient>)
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
})

it('reproduces the revoked-session loop between the real proxy and page guard', async () => {
  // Review counterexample: valid unexpired claims do not prove a live session.
  // Convert to a no-loop safety assertion with the implementation repair.
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
  expect(loginResponse.status).toBe(307)
  expect(loginResponse.headers.get('location')).toBe(
    'https://woordenaar.example/app/collections'
  )
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
