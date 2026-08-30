import { createClient } from '@supabase/supabase-js'

interface UserVerificationResult {
  userId: string | null
  error: unknown
}

interface AccessLevelResult {
  accessLevel: string | null
  error: unknown
}

export interface FullAccessAuthorizationDependencies {
  verifyUser: (token: string) => Promise<UserVerificationResult>
  getAccessLevel: (userId: string) => Promise<AccessLevelResult>
}

export type FullAccessAuthorizationResult =
  | {
      ok: true
      userId: string
    }
  | {
      ok: false
      status: 401 | 403 | 500
      code:
        | 'missing_authorization'
        | 'invalid_authorization'
        | 'invalid_token'
        | 'full_access_required'
        | 'authorization_unavailable'
      message: string
    }

const parseBearerToken = (
  authorizationHeader: string | null
): { ok: true; token: string } | { ok: false; missing: boolean } => {
  const value = authorizationHeader?.trim()
  if (!value) {
    return { ok: false, missing: true }
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(value)
  if (!match) {
    return { ok: false, missing: false }
  }

  return { ok: true, token: match[1] }
}

export const authorizeFullAccess = async (
  authorizationHeader: string | null,
  dependencies: FullAccessAuthorizationDependencies
): Promise<FullAccessAuthorizationResult> => {
  const authorization = parseBearerToken(authorizationHeader)
  if (!authorization.ok) {
    return authorization.missing
      ? {
          ok: false,
          status: 401,
          code: 'missing_authorization',
          message: 'Authorization is required',
        }
      : {
          ok: false,
          status: 401,
          code: 'invalid_authorization',
          message: 'Authorization must use a valid Bearer token',
        }
  }

  const verification = await dependencies.verifyUser(authorization.token)
  if (verification.error || !verification.userId) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_token',
      message: 'Invalid or expired token',
    }
  }

  const access = await dependencies.getAccessLevel(verification.userId)
  if (access.error) {
    return {
      ok: false,
      status: 500,
      code: 'authorization_unavailable',
      message: 'Unable to verify account access',
    }
  }

  if (access.accessLevel !== 'full_access') {
    return {
      ok: false,
      status: 403,
      code: 'full_access_required',
      message: 'Full access is required for this feature',
    }
  }

  return { ok: true, userId: verification.userId }
}

export const authorizeFullAccessRequest = async (
  req: Request
): Promise<FullAccessAuthorizationResult> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      status: 500,
      code: 'authorization_unavailable',
      message: 'Authorization service is not configured',
    }
  }

  const authorizationHeader = req.headers.get('Authorization')
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: authorizationHeader
      ? { headers: { Authorization: authorizationHeader } }
      : undefined,
  })

  return authorizeFullAccess(authorizationHeader, {
    verifyUser: async token => {
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token)

      return { userId: user?.id ?? null, error }
    },
    getAccessLevel: async userId => {
      const { data, error } = await client
        .from('user_access_levels')
        .select('access_level')
        .eq('user_id', userId)
        .maybeSingle()

      return { accessLevel: data?.access_level ?? null, error }
    },
  })
}
