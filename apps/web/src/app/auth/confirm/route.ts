import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getSafeNextPath } from '@/lib/auth/navigation'
import { createClient } from '@/lib/supabase/server'

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'email',
  'recovery',
  'invite',
  'email_change',
  'signup',
  'magiclink',
]

const isEmailOtpType = (value: string | null): value is EmailOtpType =>
  value !== null && EMAIL_OTP_TYPES.includes(value as EmailOtpType)

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get('next'))

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.url))
    }
  }

  return NextResponse.redirect(new URL('/auth/error', request.url))
}
