import { expect, type Page } from '@playwright/test'

export const E2E_COLLECTION_PREFIX = 'Web E2E'

export async function createE2ECollection(
  page: Page,
  suffix = Date.now().toString(36)
): Promise<{ name: string; url: string }> {
  const name = `${E2E_COLLECTION_PREFIX} ${suffix}`

  await page.goto('/app/collections')
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible({
    timeout: 60_000,
  })
  await page.getByText('New collection', { exact: true }).click()
  await page.getByLabel('Collection name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible({
    timeout: 60_000,
  })

  return { name, url: page.url() }
}

export async function deleteE2ECollections(page: Page): Promise<void> {
  await page.goto('/app/collections')
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible({
    timeout: 60_000,
  })

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
    await expect(page).toHaveURL(/\/app\/collections$/, { timeout: 60_000 })
  }
}
