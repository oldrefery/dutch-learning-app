import { expect, test } from '@playwright/test'
import {
  MAX_COLLECTION_NAME_LENGTH,
  validateCollectionName,
} from '../src/features/collections/collection-validation'
import { E2E_COLLECTION_PREFIX } from './support/collections'
import { createSmokeCollectionNames } from './support/smoke-collection'

// These contract tests never authenticate or navigate to an application server.
test.use({ storageState: { cookies: [], origins: [] } })

test('@smoke fixture names satisfy collection validation before and after rename', () => {
  const { name, renamedName } = createSmokeCollectionNames()
  for (const value of [name, renamedName]) {
    expect(value.length).toBeLessThanOrEqual(MAX_COLLECTION_NAME_LENGTH)
    expect(validateCollectionName(value)).toEqual({ error: null, value })
    expect(value.startsWith(`${E2E_COLLECTION_PREFIX} `)).toBe(true)
  }
  expect(renamedName).toBe(`${name} Renamed`)
})

test('@smoke fixture names preserve the complete UUID and remain distinct', () => {
  const names = Array.from({ length: 100 }, () => createSmokeCollectionNames())
  for (const { name, renamedName } of names) {
    const id = name.slice(E2E_COLLECTION_PREFIX.length + 1)
    expect(id).toMatch(/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/)
    expect(renamedName).not.toBe(name)
  }
  expect(
    new Set(names.flatMap(({ name, renamedName }) => [name, renamedName])).size
  ).toBe(200)
})

test('@smoke browser keeps fixture names intact in length-limited fields', async ({
  page,
}) => {
  const { name, renamedName } = createSmokeCollectionNames()
  await page.setContent(`
    <label>Collection name<input maxlength="${MAX_COLLECTION_NAME_LENGTH}" /></label>
    <label>New collection name<input maxlength="${MAX_COLLECTION_NAME_LENGTH}" /></label>
  `)
  const createInput = page.getByLabel('Collection name', { exact: true })
  const renameInput = page.getByLabel('New collection name', { exact: true })
  await createInput.fill(name)
  await expect(createInput).toHaveValue(name)
  await renameInput.fill(renamedName)
  await expect(renameInput).toHaveValue(renamedName, { timeout: 1_000 })
})
