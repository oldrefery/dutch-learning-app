import { expect, test } from '@playwright/test'
import { getE2ECredentials } from './support/credentials'

test('protects private routes and accepts password login', async ({
  browser,
}) => {
  const { email, password } = getE2ECredentials()
  const context = await browser.newContext()
  await context.clearCookies()
  const page = await context.newPage()

  try {
    await page.goto('/app/collections')
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fcollections$/)

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/app\/collections$/)
    await expect(
      page.getByRole('heading', { name: 'Collections' })
    ).toBeVisible()
  } finally {
    await context.close()
  }
})
