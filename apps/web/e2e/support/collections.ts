import { expect, type Page } from '@playwright/test'

export const E2E_COLLECTION_PREFIX = 'Web E2E'

export async function deleteE2ECollections(page: Page): Promise<void> {
  await page.goto('/app/collections')
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible()

  while (true) {
    const collectionLink = page
      .getByRole('link', { name: new RegExp(`^${E2E_COLLECTION_PREFIX}`) })
      .first()

    if ((await collectionLink.count()) === 0) return

    const collectionName = (await collectionLink.textContent())?.trim()
    if (!collectionName?.startsWith(E2E_COLLECTION_PREFIX)) {
      throw new Error('Refusing to delete a collection outside the E2E prefix.')
    }

    await collectionLink.click()
    await page
      .getByRole('heading', { name: 'Delete collection' })
      .scrollIntoViewIfNeeded()
    await page.getByLabel('Collection name confirmation').fill(collectionName)
    await page.getByRole('button', { name: 'Delete permanently' }).click()
    await expect(page).toHaveURL(/\/app\/collections$/)
  }
}
