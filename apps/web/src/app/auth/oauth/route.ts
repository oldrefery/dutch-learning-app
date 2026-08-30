import type { Provider } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getSafeNextPath } from '@/lib/auth/navigation'
import { getSiteOrigin } from '@/lib/site-origin'
import { createClient } from '@/lib/supabase/server'

const getProvider = (value: string | null): Provider | null => {
  if (value === 'google' || value === 'apple') {
    return value
  }

  return null
}

const getLoginErrorUrl = (request: NextRequest) => {
  const url = new URL('/login', request.url)
  url.searchParams.set('message', 'oauth-start-failed')
  return url
}

export async function GET(request: NextRequest) {
  const provider = getProvider(request.nextUrl.searchParams.get('provider'))
  if (!provider) {
    return NextResponse.redirect(getLoginErrorUrl(request))
  }

  const next = getSafeNextPath(request.nextUrl.searchParams.get('next'))
  const origin = getSiteOrigin()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(getLoginErrorUrl(request))
  }

  return NextResponse.redirect(data.url)
}
