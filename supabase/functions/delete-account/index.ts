// Edge Function for account deletion
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type PublicErrorCode =
  | 'method_not_allowed'
  | 'missing_authorization'
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

type PublicResponse = PublicErrorResponse | PublicSuccessResponse

const jsonResponse = (body: PublicResponse, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

const createRequestId = (req: Request): string =>
  req.headers.get('x-request-id') ?? crypto.randomUUID()

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
  message: string,
  data: Record<string, string | number | boolean | null>
) => {
  console.log('[delete-account]', message, data)
}

export const handleDeleteAccount = async (req: Request): Promise<Response> => {
  const requestId = createRequestId(req)
  logDeleteAccount('request_received', {
    requestId,
    method: req.method,
    authPresent: req.headers.has('Authorization'),
  })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logDeleteAccount('cors_preflight', {
      requestId,
      method: req.method,
      authPresent: req.headers.has('Authorization'),
    })
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Method not allowed',
        code: 'method_not_allowed',
      },
      405
    )
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      logDeleteAccount('missing_authorization', {
        requestId,
        method: req.method,
        authPresent: false,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Authorization is required',
          code: 'missing_authorization',
        },
        401
      )
    }

    // Create regular client to verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with proper auth context (best practice from docs)
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Extract JWT token from the Authorization header (2025 best practice)
    const token = authHeader.replace('Bearer ', '')

    // Verify the user is authenticated by passing JWT token to getUser()
    // According to 2025 docs: "By getting the JWT from the Authorization header, you can provide the token to getUser() to fetch the user object"
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      logDeleteAccount('user_verification_failed', {
        requestId,
        method: req.method,
        authPresent: true,
        status: 401,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Invalid or expired token',
          code: 'invalid_token',
        },
        401
      )
    }

    const hashedUserId = await hashIdentifier(user.id)
    logDeleteAccount('user_verified', {
      requestId,
      method: req.method,
      authPresent: true,
      userHash: hashedUserId,
    })

    // Create Supabase admin client for user deletion
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseServiceKey) {
      console.error('[delete-account] server_configuration_error', {
        requestId,
        method: req.method,
        authPresent: true,
        userHash: hashedUserId,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Server configuration error',
          code: 'server_configuration_error',
        },
        500
      )
    }

    // Create an admin client with a service role key (has admin privileges)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete the user account using the admin client
    // This will cascade delete all related data due to foreign key constraints
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    )

    if (deleteError) {
      console.error('[delete-account] delete_failed', {
        requestId,
        method: req.method,
        authPresent: true,
        userHash: hashedUserId,
      })
      return jsonResponse(
        {
          success: false,
          error: 'Failed to delete account',
          code: 'delete_failed',
        },
        500
      )
    }

    logDeleteAccount('delete_succeeded', {
      requestId,
      method: req.method,
      authPresent: true,
      userHash: hashedUserId,
      status: 200,
    })

    return jsonResponse(
      {
        success: true,
        message: 'Account successfully deleted',
      },
      200
    )
  } catch (error) {
    console.error('[delete-account] unexpected_error', {
      requestId,
      method: req.method,
      authPresent: req.headers.has('Authorization'),
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return jsonResponse(
      {
        success: false,
        error: 'Internal server error',
        code: 'internal_error',
      },
      500
    )
  }
}

Deno.serve(handleDeleteAccount)
