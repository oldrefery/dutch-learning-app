import { expect, test } from '@playwright/test'

test.describe('@extended authentication UI', () => {
  test('validates sign-up and reset forms without creating an account', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    try {
      await page.goto('/signup?next=%2Fapp%2Fsettings')
      await expect(
        page.getByRole('heading', { name: 'Create account' })
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Continue with Google' })
      ).toHaveAttribute(
        'href',
        '/auth/oauth?provider=google&next=%2Fapp%2Fsettings'
      )
      await page.getByLabel('Email').fill('browser-validation@example.test')
      await page.getByLabel('Password', { exact: true }).fill('valid-pass-1')
      await page.getByLabel('Confirm password').fill('valid-pass-2')
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByText('Passwords do not match.')).toBeVisible()

      await page.goto('/forgot-password')
      await expect(
        page.getByRole('heading', { name: 'Reset password' })
      ).toBeVisible()
      const resetEmail = page.getByLabel('Email')
      await resetEmail.fill('invalid-email')
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await expect(resetEmail).toHaveJSProperty('validity.valid', false)
      await expect(page).toHaveURL(/\/forgot-password$/)

      await page.goto('/reset-password')
      await page.getByLabel('New password').fill('valid-pass-1')
      await page.getByLabel('Confirm password').fill('valid-pass-2')
      await page.getByRole('button', { name: 'Update password' }).click()
      await expect(page.getByText('Passwords do not match.')).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('renders safe auth status and error routes', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    try {
      await page.goto('/login?message=password-updated')
      await expect(
        page.getByText('Password updated. Sign in with your new password.')
      ).toBeVisible()

      await page.goto('/login?message=oauth-start-failed')
      await expect(
        page.getByRole('alert').filter({
          hasText: 'Could not start social sign-in. Please try again.',
        })
      ).toBeVisible()

      await page.goto('/auth/error')
      await expect(
        page.getByRole('heading', { name: 'Authentication link failed' })
      ).toBeVisible()
      await page.getByRole('link', { name: 'Return to sign in' }).click()
      await expect(page).toHaveURL(/\/login$/)
    } finally {
      await context.close()
    }
  })
})
