import { expect, test } from '@playwright/test'

test('public auth shell and protected redirect work across browser engines', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()

  try {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeEditable()
    await expect(page.getByLabel('Password')).toBeEditable()

    await page.goto('/app/settings')
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings$/)
  } finally {
    await context.close()
  }
})
