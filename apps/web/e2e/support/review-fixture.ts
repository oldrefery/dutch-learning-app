import { expect, test as base, type Page } from '@playwright/test'
import { createE2ECollection, E2E_COLLECTION_PREFIX } from './collections'
import { signInTestAccount } from './session'

interface ReviewFixture {
  collectionId: string
  wordUrl: string
}

export const test = base.extend<{ reviewWord: ReviewFixture }>({
  reviewWord: async ({ page, context }, runTest) => {
    await signInTestAccount(page)
    const suffix = `recovery ${crypto.randomUUID().replaceAll('-', '')}`
    const name = `${E2E_COLLECTION_PREFIX} ${suffix}`
    try {
      const collection = await createE2ECollection(page, suffix)
      const collectionId = new URL(collection.url).pathname.split('/').at(-1)
      if (!collectionId) throw new Error('The test collection ID is missing.')
      await page.goto('/app/starter-pack')
      await page.getByLabel('Target collection').selectOption(collectionId)
      await page.getByRole('button', { name: 'Clear selection' }).click()
      const availableWord = page
        .getByRole('checkbox', { disabled: false })
        .first()
      await expect(
        availableWord,
        'The test account needs one unimported starter-pack word.'
      ).toBeVisible()
      await availableWord.check()
      await page
        .getByRole('button', { name: 'Import 1 word', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: '1 new word is ready' })
      ).toBeVisible()
      await page.goto(collection.url)
      const wordLink = page
        .locator(`a[href^="/app/collections/${collectionId}/words/"]`)
        .filter({ hasNotText: 'Add word' })
        .first()
      await wordLink.click()
      await expect(
        page.getByText('Repetition 0 of 3 to established')
      ).toBeVisible()
      const wordUrl = page.url()
      await runTest({ collectionId, wordUrl })
    } finally {
      await context.setOffline(false)
      await page.unrouteAll({ behavior: 'wait' })
      // Only delete the exact collection created by this fixture, never a prefix sweep.
      await page.goto('/app/collections')
      await expect(
        page.getByRole('heading', { name: 'Collections', exact: true })
      ).toBeVisible()
      const link = page.getByRole('link', { name, exact: true })
      if ((await link.count()) > 0) {
        await expect(link).toHaveCount(1)
        await link.click()
        await expect(
          page.getByRole('heading', { name, exact: true })
        ).toBeVisible()
        await page.getByLabel('Collection name confirmation').fill(name)
        await page.getByRole('button', { name: 'Delete permanently' }).click()
        await expect(page).toHaveURL(/\/app\/collections$/)
        await expect(link).toHaveCount(0)
      }
    }
  },
})

export async function startReview(
  page: Page,
  collectionId: string
): Promise<void> {
  await page.goto(
    `/app/review?scope=collection-due&collectionId=${collectionId}`
  )
  const mode = page.getByRole('radio', { name: /Meaning recall/ })
  await mode.click()
  await expect(mode).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: /Start ·/ }).click()
  await page.getByRole('button', { name: /Reveal answer/ }).click()
  await expect(page.getByRole('button', { name: /Easy/ })).toBeEnabled()
}

export async function expectPersistedProgress(
  page: Page,
  wordUrl: string,
  saved: boolean
): Promise<void> {
  await page.goto(wordUrl)
  await expect(page.getByText('EF 2.50', { exact: true })).toBeVisible()
  await expect(
    page.getByText(`Interval ${saved ? 4 : 1} d`, { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText(saved ? 'Learning' : 'New', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText(`Repetition ${saved ? 1 : 0} of 3 to established`)
  ).toBeVisible()
}
