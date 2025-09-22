// Edge Function for account deletion
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  console.log('=== DELETE ACCOUNT FUNCTION START ===')
  console.log('Request method:', req.method)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Authorization header present:', !!authHeader)
    console.log(
      'Authorization header value:',
      authHeader ? `${authHeader.substring(0, 20)}...` : 'null'
    )

    if (!authHeader) {
      console.log('ERROR: No authorization header found')
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create regular client to verify user
    console.log('Creating Supabase client for user verification...')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    console.log('Supabase URL exists:', !!supabaseUrl)
    console.log('Supabase ANON key exists:', !!supabaseAnonKey)

    // Create client with proper auth context (best practice from docs)
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Extract JWT token from the Authorization header (2025 best practice)
    const token = authHeader.replace('Bearer ', '')
    console.log('JWT token extracted, length:', token.length)

    // Verify the user is authenticated by passing JWT token to getUser()
    // According to 2025 docs: "By getting the JWT from the Authorization header, you can provide the token to getUser() to fetch the user object"
    console.log('Verifying user authentication with JWT token...')
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)

    console.log('User verification result:')
    console.log('- User exists:', !!user)
    console.log('- User ID:', user?.id)
    console.log('- Error:', userError?.message)

    if (userError || !user) {
      console.log('ERROR: User verification failed:', userError?.message)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Deleting account for user:', user.id)

    // Create Supabase admin client for user deletion
    console.log('Creating admin client...')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    console.log('Service role key exists:', !!supabaseServiceKey)
    console.log('Service role key length:', supabaseServiceKey?.length || 0)

    if (!supabaseServiceKey) {
      console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is missing!')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error',
          details: 'Service role key not configured',
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
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
    console.log('Attempting to delete user account...')
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    )

    console.log('Delete operation result:')
    console.log('- Success:', !deleteError)
    console.log('- Error:', deleteError?.message)
    console.log('- Error details:', deleteError)

    if (deleteError) {
      console.error('ERROR: Failed to delete user:', deleteError.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to delete account',
          details: deleteError.message,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Account successfully deleted for user:', user.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account successfully deleted',
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  }
})
