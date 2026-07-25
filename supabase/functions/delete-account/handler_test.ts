import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  createDeleteAccountHandler,
  type DeleteAccountLogEntry,
  type PublicResponse,
} from './handler.ts'

const VALID_TOKEN = 'header.payload.signature'
const USER_ID = 'user-secret-id'
const USER_HASH = 'abcdef123456'
const ANON_KEY = 'anon-secret-key'
const SERVICE_ROLE_KEY = 'service-role-secret-key'

interface HarnessOptions {
  env?: Record<string, string | undefined>
  user?: { id: string } | null
  userError?: unknown
  deleteError?: unknown
  authClientError?: Error
  hashError?: Error
  requestId?: string
}

interface CapturedLog {
  level: 'info' | 'error'
  entry: DeleteAccountLogEntry
}

const createHarness = (options: HarnessOptions = {}) => {
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    ...options.env,
  }
  const logs: CapturedLog[] = []
  const authTokens: string[] = []
  const deletedUserIds: string[] = []
  const authClientArguments: Array<{
    supabaseUrl: string
    anonKey: string
  }> = []
  const adminClientArguments: Array<{
    supabaseUrl: string
    serviceRoleKey: string
  }> = []

  const handler = createDeleteAccountHandler({
    getEnv: name => env[name],
    createAuthClient: (supabaseUrl, anonKey) => {
      if (options.authClientError) {
        throw options.authClientError
      }

      authClientArguments.push({ supabaseUrl, anonKey })
      return {
        auth: {
          getUser: token => {
            authTokens.push(token)
            return Promise.resolve({
              data: {
                user:
                  options.user === undefined ? { id: USER_ID } : options.user,
              },
              error: options.userError ?? null,
            })
          },
        },
      }
    },
    createAdminClient: (supabaseUrl, serviceRoleKey) => {
      adminClientArguments.push({ supabaseUrl, serviceRoleKey })
      return {
        auth: {
          admin: {
            deleteUser: userId => {
              deletedUserIds.push(userId)
              return Promise.resolve({
                error: options.deleteError ?? null,
              })
            },
          },
        },
      }
    },
    createRequestId: () => options.requestId ?? 'generated-request-id',
    hashIdentifier: () =>
      options.hashError
        ? Promise.reject(options.hashError)
        : Promise.resolve(USER_HASH),
    log: (level, entry) => {
      logs.push({ level, entry })
    },
  })

  return {
    handler,
    logs,
    authTokens,
    deletedUserIds,
    authClientArguments,
    adminClientArguments,
  }
}

const createRequest = (
  method: string,
  authorization?: string,
  requestId?: string
): Request => {
  const headers = new Headers()
  if (authorization !== undefined) {
    headers.set('Authorization', authorization)
  }
  if (requestId !== undefined) {
    headers.set('x-request-id', requestId)
  }

  return new Request('https://example.com/delete-account', {
    method,
    headers,
  })
}

const readBody = async (response: Response): Promise<PublicResponse> =>
  (await response.json()) as PublicResponse

const assertLogsExclude = (logs: CapturedLog[], values: string[]): void => {
  const serializedLogs = JSON.stringify(logs)
  values.forEach(value => {
    assertEquals(serializedLogs.includes(value), false)
  })
}

Deno.test(
  'delete-account handles CORS without reading configuration',
  async () => {
    const harness = createHarness({
      env: {
        SUPABASE_URL: undefined,
        SUPABASE_ANON_KEY: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
    })

    const response = await harness.handler(
      createRequest('OPTIONS', undefined, 'cors-request')
    )

    assertEquals(response.status, 204)
    assertEquals(response.headers.get('x-request-id'), 'cors-request')
    assertEquals(
      response.headers
        .get('Access-Control-Allow-Headers')
        ?.includes('x-request-id'),
      true
    )
    assertEquals(harness.authClientArguments, [])
  }
)

Deno.test(
  'delete-account replaces unsafe request ids before logging',
  async () => {
    const unsafeRequestId = 'unsafe request id <script>'
    const harness = createHarness({ requestId: 'safe-generated-id' })

    const response = await harness.handler(
      createRequest('POST', undefined, unsafeRequestId)
    )

    assertEquals(response.status, 401)
    assertEquals(response.headers.get('x-request-id'), 'safe-generated-id')
    assertEquals(
      harness.logs.every(
        capturedLog => capturedLog.entry.requestId === 'safe-generated-id'
      ),
      true
    )
    assertLogsExclude(harness.logs, [unsafeRequestId])
  }
)

Deno.test('delete-account rejects unsupported methods', async () => {
  const harness = createHarness()

  const response = await harness.handler(createRequest('GET'))

  assertEquals(response.status, 405)
  assertEquals(response.headers.get('Allow'), 'POST, OPTIONS')
  assertEquals(await readBody(response), {
    success: false,
    error: 'Method not allowed',
    code: 'method_not_allowed',
  })
  assertEquals(harness.authClientArguments, [])
})

for (const authorizationCase of [
  {
    name: 'a missing Authorization header',
    value: undefined,
    error: 'Authorization is required',
    code: 'missing_authorization',
  },
  {
    name: 'an empty Authorization header',
    value: '   ',
    error: 'Authorization is required',
    code: 'missing_authorization',
  },
  {
    name: 'a Basic Authorization header',
    value: 'Basic credentials',
    error: 'Authorization must use a valid Bearer token',
    code: 'invalid_authorization',
  },
  {
    name: 'an opaque Bearer token',
    value: 'Bearer not-a-jwt',
    error: 'Authorization must use a valid Bearer token',
    code: 'invalid_authorization',
  },
  {
    name: 'a Bearer header with multiple credentials',
    value: `Bearer ${VALID_TOKEN}, Bearer other.payload.signature`,
    error: 'Authorization must use a valid Bearer token',
    code: 'invalid_authorization',
  },
] as const) {
  Deno.test(`delete-account rejects ${authorizationCase.name}`, async () => {
    const harness = createHarness()

    const response = await harness.handler(
      createRequest('POST', authorizationCase.value)
    )

    assertEquals(response.status, 401)
    assertEquals(await readBody(response), {
      success: false,
      error: authorizationCase.error,
      code: authorizationCase.code,
    })
    assertEquals(harness.authClientArguments, [])
    if (authorizationCase.value) {
      assertLogsExclude(harness.logs, [authorizationCase.value])
    }
  })
}

for (const configCase of [
  {
    name: 'SUPABASE_URL is missing',
    env: { SUPABASE_URL: undefined },
    issue: 'missing_supabase_url',
  },
  {
    name: 'SUPABASE_URL is invalid',
    env: { SUPABASE_URL: 'file:///tmp/supabase' },
    issue: 'invalid_supabase_url',
  },
  {
    name: 'SUPABASE_ANON_KEY is missing',
    env: { SUPABASE_ANON_KEY: ' ' },
    issue: 'missing_anon_key',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY is missing',
    env: { SUPABASE_SERVICE_ROLE_KEY: undefined },
    issue: 'missing_service_role_key',
  },
] as const) {
  Deno.test(`delete-account fails safely when ${configCase.name}`, async () => {
    const harness = createHarness({ env: configCase.env })

    const response = await harness.handler(
      createRequest('POST', `Bearer ${VALID_TOKEN}`)
    )

    assertEquals(response.status, 500)
    assertEquals(await readBody(response), {
      success: false,
      error: 'Server configuration error',
      code: 'server_configuration_error',
    })
    assertEquals(
      harness.logs.some(
        capturedLog =>
          capturedLog.entry.event === 'server_configuration_error' &&
          capturedLog.entry.configurationIssue === configCase.issue
      ),
      true
    )
    assertEquals(harness.authClientArguments, [])
    assertLogsExclude(harness.logs, [ANON_KEY, SERVICE_ROLE_KEY, VALID_TOKEN])
  })
}

Deno.test(
  'delete-account rejects an unverified user without leaking auth errors',
  async () => {
    const internalError = 'auth-provider-internal-detail'
    const harness = createHarness({
      user: null,
      userError: new Error(internalError),
    })

    const response = await harness.handler(
      createRequest('POST', `Bearer ${VALID_TOKEN}`)
    )

    assertEquals(response.status, 401)
    assertEquals(await readBody(response), {
      success: false,
      error: 'Invalid or expired token',
      code: 'invalid_token',
    })
    assertEquals(harness.deletedUserIds, [])
    assertLogsExclude(harness.logs, [internalError, VALID_TOKEN])
  }
)

Deno.test(
  'delete-account deletes only the verified user and keeps logs safe',
  async () => {
    const harness = createHarness()

    const response = await harness.handler(
      createRequest('POST', `Bearer ${VALID_TOKEN}`, 'request-123')
    )

    assertEquals(response.status, 200)
    assertEquals(response.headers.get('x-request-id'), 'request-123')
    assertEquals(await readBody(response), {
      success: true,
      message: 'Account successfully deleted',
    })
    assertEquals(harness.authTokens, [VALID_TOKEN])
    assertEquals(harness.deletedUserIds, [USER_ID])
    assertEquals(harness.authClientArguments, [
      {
        supabaseUrl: 'https://project.supabase.co',
        anonKey: ANON_KEY,
      },
    ])
    assertEquals(harness.adminClientArguments, [
      {
        supabaseUrl: 'https://project.supabase.co',
        serviceRoleKey: SERVICE_ROLE_KEY,
      },
    ])
    assertEquals(
      harness.logs.some(
        capturedLog =>
          capturedLog.entry.event === 'delete_succeeded' &&
          capturedLog.entry.userHash === USER_HASH
      ),
      true
    )
    assertLogsExclude(harness.logs, [
      VALID_TOKEN,
      USER_ID,
      ANON_KEY,
      SERVICE_ROLE_KEY,
    ])
  }
)

Deno.test(
  'delete-account does not let hash failures block deletion',
  async () => {
    const internalError = 'hash-internal-detail'
    const harness = createHarness({
      hashError: new Error(internalError),
    })

    const response = await harness.handler(
      createRequest('POST', `Bearer ${VALID_TOKEN}`)
    )

    assertEquals(response.status, 200)
    assertEquals(harness.deletedUserIds, [USER_ID])
    assertEquals(
      harness.logs.some(
        capturedLog => capturedLog.entry.event === 'user_hash_failed'
      ),
      true
    )
    assertLogsExclude(harness.logs, [internalError, USER_ID])
  }
)

Deno.test(
  'delete-account returns a stable response for admin deletion errors',
  async () => {
    const internalError = 'database-internal-delete-detail'
    const harness = createHarness({
      deleteError: new Error(internalError),
    })

    const response = await harness.handler(
      createRequest('POST', `Bearer ${VALID_TOKEN}`)
    )

    assertEquals(response.status, 500)
    assertEquals(await readBody(response), {
      success: false,
      error: 'Failed to delete account',
      code: 'delete_failed',
    })
    assertLogsExclude(harness.logs, [internalError, USER_ID, VALID_TOKEN])
  }
)

Deno.test('delete-account contains unexpected dependency errors', async () => {
  const internalError = 'client-construction-internal-detail'
  const harness = createHarness({
    authClientError: new Error(internalError),
  })

  const response = await harness.handler(
    createRequest('POST', `Bearer ${VALID_TOKEN}`)
  )

  assertEquals(response.status, 500)
  assertEquals(await readBody(response), {
    success: false,
    error: 'Internal server error',
    code: 'internal_error',
  })
  assertLogsExclude(harness.logs, [internalError, VALID_TOKEN])
})
