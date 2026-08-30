import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSafeNextPath } from '@/lib/auth/navigation'
import { refreshSession } from '@/lib/supabase/proxy'

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password']

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await refreshSession(request)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/app') && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'next',
      getSafeNextPath(`${pathname}${request.nextUrl.search}`)
    )
    return NextResponse.redirect(loginUrl)
  }

  if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/app/collections', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/app/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ],
}
