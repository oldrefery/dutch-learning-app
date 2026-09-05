import { expect, test as setup } from '@playwright/test'
import path from 'node:path'
import { getE2ECredentials } from './support/credentials'

const authStatePath = path.join(
  __dirname,
  '..',
  '.playwright',
  '.auth',
  'user.json'
)

setup('authenticate dedicated test account', async ({ page }) => {
  const { email, password } = getE2ECredentials()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/app\/collections$/, { timeout: 45_000 })
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.context().storageState({ path: authStatePath })
})
