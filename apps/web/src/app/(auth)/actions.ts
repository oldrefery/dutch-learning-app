'use server'

import type { Provider } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSafeNextPath } from '@/lib/auth/navigation'
import type { AuthFormState } from '@/lib/auth/types'
import { createClient } from '@/lib/supabase/server'

const getFormValue = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

const getCredentials = (formData: FormData) => ({
  email: getFormValue(formData, 'email').toLowerCase(),
  password: getFormValue(formData, 'password'),
})

const validateCredentials = (
  email: string,
  password: string
): AuthFormState['fieldErrors'] => {
  const fieldErrors: NonNullable<AuthFormState['fieldErrors']> = {}

  if (!email || !email.includes('@')) {
    fieldErrors.email = 'Enter a valid email address.'
  }

  if (password.length < 6) {
    fieldErrors.password = 'Password must contain at least 6 characters.'
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
}

const getRequestOrigin = async () => {
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin')
  if (origin) return origin

  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  return host ? `${protocol}://${host}` : 'https://woordenaar.app'
}

const getAuthErrorMessage = (message: string) => {
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Confirm your email before signing in.'
  }
  if (message.includes('already registered')) {
    return 'An account with this email already exists.'
  }

  return 'Authentication failed. Please try again.'
}

export async function login(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = getCredentials(formData)
  const fieldErrors = validateCredentials(email, password)
  if (fieldErrors) {
    return { status: 'error', message: null, fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { status: 'error', message: getAuthErrorMessage(error.message) }
  }

  revalidatePath('/', 'layout')
  redirect(getSafeNextPath(formData.get('next')))
}

export async function signup(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = getCredentials(formData)
  const confirmPassword = getFormValue(formData, 'confirmPassword')
  const fieldErrors = validateCredentials(email, password) ?? {}

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: null, fieldErrors }
  }

  const next = getSafeNextPath(formData.get('next'))
  const origin = await getRequestOrigin()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    return { status: 'error', message: getAuthErrorMessage(error.message) }
  }

  if (!data.session) {
    return {
      status: 'success',
      message: 'Check your email to confirm your account.',
    }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function requestPasswordReset(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = getFormValue(formData, 'email').toLowerCase()
  if (!email || !email.includes('@')) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { email: 'Enter a valid email address.' },
    }
  }

  const origin = await getRequestOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { status: 'error', message: 'Could not send the reset email.' }
  }

  return {
    status: 'success',
    message: 'If the account exists, a reset link has been sent.',
  }
}

export async function updatePassword(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = getFormValue(formData, 'password')
  const confirmPassword = getFormValue(formData, 'confirmPassword')
  const fieldErrors: NonNullable<AuthFormState['fieldErrors']> = {}

  if (password.length < 6) {
    fieldErrors.password = 'Password must contain at least 6 characters.'
  }
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: null, fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { status: 'error', message: 'Could not update the password.' }
  }

  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login?message=password-updated')
}

export async function signInWithOAuth(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const providerValue = getFormValue(formData, 'provider')
  if (providerValue !== 'google' && providerValue !== 'apple') {
    return { status: 'error', message: 'Unsupported sign-in provider.' }
  }

  const provider: Provider = providerValue
  const next = getSafeNextPath(formData.get('next'))
  const origin = await getRequestOrigin()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error || !data.url) {
    return { status: 'error', message: 'Could not start social sign-in.' }
  }

  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  revalidatePath('/', 'layout')
  redirect('/login')
}
