import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id',
}

const RESPONSE_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/
const BEARER_JWT_PATTERN =
  /^Bearer[ \t]+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i
const MAX_AUTHORIZATION_LENGTH = 8192

type PublicErrorCode =
  | 'method_not_allowed'
  | 'missing_authorization'
  | 'invalid_authorization'
  | 'invalid_token'
  | 'server_configuration_error'
  | 'delete_failed'
  | 'internal_error'

interface PublicErrorResponse {
  success: false
  error: string
  code: PublicErrorCode
}

interface PublicSuccessResponse {
  success: true
  message: string
}

export type PublicResponse = PublicErrorResponse | PublicSuccessResponse

type DeleteAccountLogLevel = 'info' | 'error'

type DeleteAccountLogEvent =
  | 'request_received'
  | 'cors_preflight'
  | 'method_not_allowed'
  | 'missing_authorization'
  | 'invalid_authorization'
  | 'server_configuration_error'
  | 'user_verification_failed'
  | 'user_verified'
  | 'user_hash_failed'
  | 'delete_failed'
  | 'delete_succeeded'
  | 'unexpected_error'

type ConfigurationIssue =
  | 'missing_supabase_url'
  | 'invalid_supabase_url'
  | 'missing_anon_key'
  | 'missing_service_role_key'

export interface DeleteAccountLogEntry {
  component: 'delete-account'
  event: DeleteAccountLogEvent
  requestId: string
  method: string
  authPresent: boolean
  status?: number
  userHash?: string
  configurationIssue?: ConfigurationIssue
}

interface AuthenticatedUser {
  id: string
}

interface AuthClient {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: AuthenticatedUser | null }
      error: unknown
    }>
  }
}

interface AdminClient {
  auth: {
    admin: {
      deleteUser: (userId: string) => Promise<{ error: unknown }>
    }
  }
}

interface DeleteAccountConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
}

type ConfigResult =
  | { ok: true; config: DeleteAccountConfig }
  | { ok: false; issue: ConfigurationIssue }

type AuthorizationResult =
  | { ok: true; token: string }
  | { ok: false; code: 'missing_authorization' | 'invalid_authorization' }

export interface DeleteAccountDependencies {
  getEnv: (name: string) => string | undefined
  createAuthClient: (supabaseUrl: string, anonKey: string) => AuthClient
  createAdminClient: (
    supabaseUrl: string,
    serviceRoleKey: string
  ) => AdminClient
  createRequestId: () => string
  hashIdentifier: (value: string) => Promise<string>
  log: (level: DeleteAccountLogLevel, entry: DeleteAccountLogEntry) => void
}

const jsonResponse = (
  body: PublicResponse,
  status: number,
  requestId: string,
  extraHeaders: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      ...extraHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'x-request-id': requestId,
    },
  })

const sanitizeRequestIdCandidate = (
  candidate: string | null | undefined
): string | null => {
  const trimmedCandidate = candidate?.trim()
  if (
    !trimmedCandidate ||
    trimmedCandidate.length > 64 ||
    !REQUEST_ID_PATTERN.test(trimmedCandidate)
  ) {
    return null
  }

  return trimmedCandidate
}

export const normalizeRequestId = (
  requestIdHeader: string | null,
  createRequestId: () => string
): string =>
  sanitizeRequestIdCandidate(requestIdHeader) ??
  sanitizeRequestIdCandidate(createRequestId()) ??
  'request-id-unavailable'

export const parseAuthorizationHeader = (
  authorizationHeader: string | null
): AuthorizationResult => {
  const trimmedHeader = authorizationHeader?.trim()
  if (!trimmedHeader) {
    return { ok: false, code: 'missing_authorization' }
  }

  if (trimmedHeader.length > MAX_AUTHORIZATION_LENGTH) {
    return { ok: false, code: 'invalid_authorization' }
  }

  const match = BEARER_JWT_PATTERN.exec(trimmedHeader)
  if (!match) {
    return { ok: false, code: 'invalid_authorization' }
  }

  return { ok: true, token: match[1] }
}

const readConfig = (
  getEnv: DeleteAccountDependencies['getEnv']
): ConfigResult => {
  const supabaseUrl = getEnv('SUPABASE_URL')?.trim()
  if (!supabaseUrl) {
    return { ok: false, issue: 'missing_supabase_url' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(supabaseUrl)
  } catch {
    return { ok: false, issue: 'invalid_supabase_url' }
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    return { ok: false, issue: 'invalid_supabase_url' }
  }

  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseAnonKey) {
    return { ok: false, issue: 'missing_anon_key' }
  }

  const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!supabaseServiceRoleKey) {
    return { ok: false, issue: 'missing_service_role_key' }
  }

  return {
    ok: true,
    config: {
      supabaseUrl: parsedUrl.origin,
      supabaseAnonKey,
      supabaseServiceRoleKey,
    },
  }
}

const hashIdentifier = async (value: string): Promise<string> => {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  )
  const bytes = Array.from(new Uint8Array(hash))
  return bytes
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

const logDeleteAccount = (
  level: DeleteAccountLogLevel,
  entry: DeleteAccountLogEntry
): void => {
  if (level === 'error') {
    console.error(entry)
    return
  }

  console.log(entry)
}

const defaultDependencies: DeleteAccountDependencies = {
  getEnv: name => Deno.env.get(name),
  createAuthClient: (supabaseUrl, anonKey) => {
    const client = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    return {
      auth: {
        getUser: token => client.auth.getUser(token),
      },
    }
  },
  createAdminClient: (supabaseUrl, serviceRoleKey) => {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    return {
      auth: {
        admin: {
          deleteUser: userId => client.auth.admin.deleteUser(userId),
        },
      },
    }
  },
  createRequestId: () => crypto.randomUUID(),
  hashIdentifier,
  log: logDeleteAccount,
}

export const createDeleteAccountHandler = (
  dependencyOverrides: Partial<DeleteAccountDependencies> = {}
): ((req: Request) => Promise<Response>) => {
  const dependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  }

  return async (req: Request): Promise<Response> => {
    const method = req.method.toUpperCase()
    const authorizationHeader = req.headers.get('Authorization')
    const authPresent = Boolean(authorizationHeader?.trim())
    const requestId = normalizeRequestId(
      req.headers.get('x-request-id'),
      dependencies.createRequestId
    )
    const baseLogEntry = {
      component: 'delete-account' as const,
      requestId,
      method,
      authPresent,
    }

    dependencies.log('info', {
      ...baseLogEntry,
      event: 'request_received',
    })

    if (method === 'OPTIONS') {
      dependencies.log('info', {
        ...baseLogEntry,
        event: 'cors_preflight',
        status: 204,
      })
      return new Response(null, {
        status: 204,
        headers: {
          ...RESPONSE_HEADERS,
          'x-request-id': requestId,
        },
      })
    }

    if (method !== 'POST') {
      dependencies.log('info', {
        ...baseLogEntry,
        event: 'method_not_allowed',
        status: 405,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Method not allowed',
          code: 'method_not_allowed',
        },
        405,
        requestId,
        { Allow: 'POST, OPTIONS' }
      )
    }

    const authorization = parseAuthorizationHeader(authorizationHeader)
    if (!authorization.ok) {
      const isMissing = authorization.code === 'missing_authorization'
      dependencies.log('info', {
        ...baseLogEntry,
        event: isMissing ? 'missing_authorization' : 'invalid_authorization',
        status: 401,
      })
      return jsonResponse(
        {
          success: false,
          error: isMissing
            ? 'Authorization is required'
            : 'Authorization must use a valid Bearer token',
          code: authorization.code,
        },
        401,
        requestId
      )
    }

    const configResult = readConfig(dependencies.getEnv)
    if (!configResult.ok) {
      dependencies.log('error', {
        ...baseLogEntry,
        event: 'server_configuration_error',
        status: 500,
        configurationIssue: configResult.issue,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Server configuration error',
          code: 'server_configuration_error',
        },
        500,
        requestId
      )
    }

    try {
      const { config } = configResult
      const authClient = dependencies.createAuthClient(
        config.supabaseUrl,
        config.supabaseAnonKey
      )
      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser(authorization.token)

      if (userError || !user) {
        dependencies.log('info', {
          ...baseLogEntry,
          event: 'user_verification_failed',
          status: 401,
        })
        return jsonResponse(
          {
            success: false,
            error: 'Invalid or expired token',
            code: 'invalid_token',
          },
          401,
          requestId
        )
      }

      let userHash: string | undefined
      try {
        userHash = await dependencies.hashIdentifier(user.id)
      } catch {
        dependencies.log('error', {
          ...baseLogEntry,
          event: 'user_hash_failed',
        })
      }

      dependencies.log('info', {
        ...baseLogEntry,
        event: 'user_verified',
        userHash,
      })

      const adminClient = dependencies.createAdminClient(
        config.supabaseUrl,
        config.supabaseServiceRoleKey
      )
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        user.id
      )

      if (deleteError) {
        dependencies.log('error', {
          ...baseLogEntry,
          event: 'delete_failed',
          status: 500,
          userHash,
        })
        return jsonResponse(
          {
            success: false,
            error: 'Failed to delete account',
            code: 'delete_failed',
          },
          500,
          requestId
        )
      }

      dependencies.log('info', {
        ...baseLogEntry,
        event: 'delete_succeeded',
        status: 200,
        userHash,
      })
      return jsonResponse(
        {
          success: true,
          message: 'Account successfully deleted',
        },
        200,
        requestId
      )
    } catch {
      dependencies.log('error', {
        ...baseLogEntry,
        event: 'unexpected_error',
        status: 500,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Internal server error',
          code: 'internal_error',
        },
        500,
        requestId
      )
    }
  }
}

export const handleDeleteAccount = createDeleteAccountHandler()
