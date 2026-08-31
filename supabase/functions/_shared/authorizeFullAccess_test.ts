import {
  assertEquals,
  assertObjectMatch,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  authorizeFullAccess,
  type FullAccessAuthorizationDependencies,
} from './authorizeFullAccess.ts'

const createDependencies = (
  overrides: Partial<FullAccessAuthorizationDependencies> = {}
): FullAccessAuthorizationDependencies => ({
  verifyUser: () => Promise.resolve({ userId: 'user-1', error: null }),
  getAccessLevel: () =>
    Promise.resolve({ accessLevel: 'full_access', error: null }),
  ...overrides,
})

Deno.test(
  'authorizeFullAccess rejects a missing authorization header',
  async () => {
    const result = await authorizeFullAccess(null, createDependencies())

    assertObjectMatch(result, {
      ok: false,
      status: 401,
      code: 'missing_authorization',
    })
  }
)

Deno.test(
  'authorizeFullAccess rejects a malformed authorization header',
  async () => {
    const result = await authorizeFullAccess(
      'Basic credentials',
      createDependencies()
    )

    assertObjectMatch(result, {
      ok: false,
      status: 401,
      code: 'invalid_authorization',
    })
  }
)

Deno.test('authorizeFullAccess rejects an invalid token', async () => {
  const result = await authorizeFullAccess(
    'Bearer invalid-token',
    createDependencies({
      verifyUser: () =>
        Promise.resolve({ userId: null, error: new Error('invalid token') }),
    })
  )

  assertObjectMatch(result, {
    ok: false,
    status: 401,
    code: 'invalid_token',
  })
})

Deno.test('authorizeFullAccess rejects a read-only user', async () => {
  const result = await authorizeFullAccess(
    'Bearer valid-token',
    createDependencies({
      getAccessLevel: () =>
        Promise.resolve({ accessLevel: 'read_only', error: null }),
    })
  )

  assertObjectMatch(result, {
    ok: false,
    status: 403,
    code: 'full_access_required',
  })
})

Deno.test(
  'authorizeFullAccess fails closed when access lookup fails',
  async () => {
    const result = await authorizeFullAccess(
      'Bearer valid-token',
      createDependencies({
        getAccessLevel: () =>
          Promise.resolve({
            accessLevel: null,
            error: new Error('database unavailable'),
          }),
      })
    )

    assertObjectMatch(result, {
      ok: false,
      status: 500,
      code: 'authorization_unavailable',
    })
  }
)

Deno.test(
  'authorizeFullAccess returns the verified full-access user',
  async () => {
    const result = await authorizeFullAccess(
      'Bearer valid-token',
      createDependencies()
    )

    assertEquals(result, { ok: true, userId: 'user-1' })
  }
)
