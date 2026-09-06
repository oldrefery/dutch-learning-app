import { expect, type BrowserContext, type Page } from '@playwright/test'
import { combineChunks, createChunks, isChunkLike } from '@supabase/ssr'
import { getE2ECredentials } from './credentials'

interface CookieSession {
  access_token: string
  refresh_token: string
  expires_at: number
  user: { id: string; email: string }
}

function isCookieSession(value: unknown): value is CookieSession {
  if (!value || typeof value !== 'object') return false
  return (
    'access_token' in value &&
    typeof value.access_token === 'string' &&
    'refresh_token' in value &&
    typeof value.refresh_token === 'string' &&
    'expires_at' in value &&
    typeof value.expires_at === 'number' &&
    'user' in value &&
    !!value.user &&
    typeof value.user === 'object' &&
    'id' in value.user &&
    typeof value.user.id === 'string' &&
    'email' in value.user &&
    typeof value.user.email === 'string'
  )
}

export async function signInTestAccount(page: Page): Promise<void> {
  const { email, password } = getE2ECredentials()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/collections$/, { timeout: 45_000 })
  await expect(page.getByText(email, { exact: true })).toBeVisible()
}

export async function readTestSession(context: BrowserContext) {
  const { email } = getE2ECredentials()
  const cookies = await context.cookies()
  const cookie = cookies.find(item =>
    /^sb-.+-auth-token(?:\.0)?$/.test(item.name)
  )
  if (!cookie) throw new Error('Test session cookie is missing.')
  const name = cookie.name.replace(/\.0$/, '')
  const encoded = await combineChunks(
    name,
    key => cookies.find(item => item.name === key)?.value
  )
  if (!encoded?.startsWith('base64-')) {
    throw new Error('Unexpected test session cookie encoding.')
  }
  const session: unknown = JSON.parse(
    Buffer.from(encoded.slice(7), 'base64url').toString('utf8')
  )
  if (!isCookieSession(session) || session.user.email !== email) {
    throw new Error(
      'Refusing to use a session outside the configured test account.'
    )
  }
  return { cookie, name, session }
}

export async function expireTestSession(
  context: BrowserContext,
  invalidRefreshToken = false
): Promise<void> {
  const { cookie, name, session } = await readTestSession(context)
  const expired = {
    ...session,
    // Trigger the real provider refresh without changing the signed access JWT.
    expires_at: Math.floor(Date.now() / 1000) - 60,
    refresh_token: invalidRefreshToken
      ? 'invalid-e2e-refresh-token'
      : session.refresh_token,
  }
  for (const current of await context.cookies()) {
    if (isChunkLike(current.name, name)) {
      await context.clearCookies({
        name: current.name,
        domain: current.domain,
        path: current.path,
      })
    }
  }
  const encoded = `base64-${Buffer.from(JSON.stringify(expired)).toString('base64url')}`
  await context.addCookies(
    createChunks(name, encoded).map(chunk => ({ ...cookie, ...chunk }))
  )
}
