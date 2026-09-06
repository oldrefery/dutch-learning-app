import { randomUUID } from 'node:crypto'
import { expect, test as base, type Page } from '@playwright/test'
import { E2E_COLLECTION_PREFIX } from './collections'
import { getE2ECredentials } from './credentials'

interface SmokeCollection {
  name: string
  renamedName: string
}

async function deleteExactCollection(page: Page, name: string): Promise<void> {
  if (!name.startsWith(`${E2E_COLLECTION_PREFIX} `)) {
    throw new Error('Refusing to delete a collection outside the test fixture.')
  }
  await page.goto('/app/collections')
  await expect(
    page.getByRole('heading', { name: 'Collections', exact: true })
  ).toBeVisible({ timeout: 15_000 })
  const link = page.getByRole('link', { name, exact: true })
  if ((await link.count()) === 0) return
  await expect(link).toHaveCount(1)
  await link.click()
  await page
    .getByRole('heading', { name: 'Delete collection', exact: true })
    .scrollIntoViewIfNeeded()
  await page.getByLabel('Collection name confirmation').fill(name)
  await page
    .getByRole('button', { name: 'Delete permanently', exact: true })
    .click()
  await expect(page).toHaveURL(/\/app\/collections$/, { timeout: 15_000 })
  await expect(link).toHaveCount(0)
}

export const test = base.extend<{ smokeCollection: SmokeCollection }>({
  smokeCollection: [
    async ({ browser, baseURL, storageState }, runTest) => {
      getE2ECredentials()
      const name = `${E2E_COLLECTION_PREFIX} ${randomUUID()}`
      const renamedName = `${name} Renamed`
      try {
        await runTest({ name, renamedName })
      } finally {
        // The test page may already be closed after a timeout. Teardown owns a
        // separate context and budget; errors here do not replace the test error.
        const context = await browser.newContext({ baseURL, storageState })
        context.setDefaultTimeout(15_000)
        context.setDefaultNavigationTimeout(15_000)
        try {
          const page = await context.newPage()
          await deleteExactCollection(page, name)
          await deleteExactCollection(page, renamedName)
        } finally {
          await context.close()
        }
      }
    },
    { timeout: 60_000 },
  ],
})
