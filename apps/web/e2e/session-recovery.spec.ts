import { expect, test } from '@playwright/test'
import { getE2ECredentials } from './support/credentials'
import {
  expireTestSession,
  readTestSession,
  signInTestAccount,
} from './support/session'

// Cookies and credentials must not be embedded in diagnostic artifacts.
test.use({
  actionTimeout: 15_000,
  navigationTimeout: 60_000,
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  video: 'off',
  screenshot: 'off',
})
test.beforeEach(async ({ page }) => {
  await signInTestAccount(page)
})

for (const path of ['/app/settings', '/login']) {
  test(`@extended refreshes an expired cookie session through ${path}`, async ({
    page,
    context,
  }) => {
    const before = await readTestSession(context)
    await page.goto('about:blank')
    await expireTestSession(context)
    await page.goto(path)
    await expect(page).toHaveURL(
      path === '/login' ? /\/app\/collections$/ : /\/app\/settings$/
    )
    const after = await readTestSession(context)
    // Boolean assertions prevent JWTs from appearing in a failed assertion diff.
    expect(after.session.refresh_token !== before.session.refresh_token).toBe(
      true
    )
    expect(after.session.expires_at > Date.now() / 1000).toBe(true)
    expect(after.session.user.id === before.session.user.id).toBe(true)
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Sign out' }).first()
    ).toBeVisible()
  })
}

test('@extended rejects an expired session with an invalid refresh token and preserves the return path', async ({
  page,
  context,
}) => {
  const { name } = await readTestSession(context)
  await page.goto('about:blank')
  await expireTestSession(context, true)
  await page.goto('/app/review?scope=all-due')
  await expect(page).toHaveURL(
    /\/login\?next=%2Fapp%2Freview%3Fscope%3Dall-due$/
  )
  expect(
    (await context.cookies()).some(
      cookie => cookie.name === name || cookie.name.startsWith(`${name}.`)
    )
  ).toBe(false)
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true })
  ).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/login\?next=/)
  const { email, password } = getE2ECredentials()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/review\?scope=all-due$/)
})
