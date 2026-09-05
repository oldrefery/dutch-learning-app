import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSafeNextPath } from '@/lib/auth/navigation'
import { refreshSession } from '@/lib/supabase/proxy'

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password']

const redirectWithSessionCookies = (
  url: URL,
  sessionResponse: NextResponse
) => {
  const response = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach(cookie => {
    response.cookies.set(cookie)
  })
  return response
}

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await refreshSession(request)
  const { pathname } = request.nextUrl

  if (
    (pathname.startsWith('/app') || pathname.startsWith('/share/')) &&
    !isAuthenticated
  ) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'next',
      getSafeNextPath(`${pathname}${request.nextUrl.search}`)
    )
    return redirectWithSessionCookies(loginUrl, response)
  }

  if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
    return redirectWithSessionCookies(
      new URL('/app/collections', request.url),
      response
    )
  }

  return response
}

export const config = {
  matcher: [
    '/app/:path*',
    '/share/:path*',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ],
}
