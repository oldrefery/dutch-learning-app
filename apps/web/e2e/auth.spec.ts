import { expect, test } from '@playwright/test'
import { getE2ECredentials } from './support/credentials'

test('@smoke protects private routes and accepts password login', async ({
  browser,
}) => {
  const { email, password } = getE2ECredentials()
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()

  try {
    await page.goto('/app/collections')
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fcollections$/)

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/app\/collections$/, { timeout: 45_000 })
    await expect(
      page.getByRole('heading', { name: 'Collections' })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/, { timeout: 45_000 })
    await page.goto('/app/settings')
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsettings$/)
  } finally {
    await context.close()
  }
})
