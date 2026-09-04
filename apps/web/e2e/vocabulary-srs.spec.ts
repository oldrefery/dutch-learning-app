import { expect, type Locator, test } from '@playwright/test'
import {
  deleteE2ECollections,
  E2E_COLLECTION_PREFIX,
} from './support/collections'

async function selectStableReviewMode(modeRadio: Locator): Promise<void> {
  let consecutiveCheckedStates = 0

  await expect
    .poll(
      async () => {
        const isChecked =
          (await modeRadio.getAttribute('aria-checked')) === 'true'
        if (!isChecked) {
          consecutiveCheckedStates = 0
          await modeRadio.click()
          return consecutiveCheckedStates
        }

        consecutiveCheckedStates += 1
        return consecutiveCheckedStates
      },
      { intervals: [100, 100, 100, 100], timeout: 5_000 }
    )
    .toBeGreaterThanOrEqual(3)
}

test('covers collection CRUD, word analysis, search, history, and SRS', async ({
  page,
}) => {
  const runId = Date.now().toString(36)
  const collectionName = `${E2E_COLLECTION_PREFIX} ${runId}`
  const renamedCollectionName = `${collectionName} Renamed`
  const dutchWord = 'zwenkgras'

  await deleteE2ECollections(page)

  try {
    await page.getByText('New collection', { exact: true }).click()
    await page.getByLabel('Collection name').fill(collectionName)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const collectionLink = page.getByRole('link', {
      name: collectionName,
      exact: true,
    })
    await expect(collectionLink).toBeVisible()
    await collectionLink.click()
    await expect(
      page.getByRole('heading', { name: collectionName })
    ).toBeVisible()

    await page.getByLabel('New collection name').fill(renamedCollectionName)
    await page.getByRole('button', { name: 'Save name' }).click()
    await expect(
      page.getByRole('heading', { name: renamedCollectionName })
    ).toBeVisible()

    await page.getByRole('main').getByRole('link', { name: 'Add word' }).click()
    await page.getByLabel('Dutch word or expression').fill(dutchWord)
    await page.getByRole('button', { name: 'Analyze', exact: true }).click()
    const saveWordButton = page.getByRole('button', { name: 'Save word' })
    await expect(saveWordButton).toBeEnabled({ timeout: 90_000 })
    await saveWordButton.click()

    await expect(page).toHaveURL(
      /\/app\/collections\/[0-9a-f-]+\/words\/[0-9a-f-]+$/,
      { timeout: 30_000 }
    )
    await expect(page.getByRole('heading', { name: dutchWord })).toBeVisible()
    await expect(page.getByText('EF 2.50', { exact: true })).toBeVisible()
    await expect(page.getByText('Interval 1 d', { exact: true })).toBeVisible()
    await expect(page.getByText('New', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Repetition 0 of 3 to established')
    ).toBeVisible()

    const wordUrl = page.url()
    const collectionUrl = wordUrl.replace(/\/words\/[0-9a-f-]+$/, '')
    const collectionId = collectionUrl.split('/').at(-1)
    if (!collectionId) throw new Error('Could not read the E2E collection ID.')

    await page.goto('/app/history')
    await expect(page.getByText(dutchWord, { exact: true })).toBeVisible()
    await expect(
      page.getByText(renamedCollectionName, { exact: true })
    ).toBeVisible()

    await page.goto('/app/search')
    await page.getByPlaceholder('Dutch word or translation').fill(dutchWord)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(
      page.getByRole('link', { name: new RegExp(dutchWord) })
    ).toBeVisible()

    await page.goto(
      `/app/review?scope=collection-due&collectionId=${collectionId}`
    )
    await selectStableReviewMode(
      page.getByRole('radio', { name: /Meaning recall/ })
    )
    await expect(
      page.getByRole('radio', { name: /One collection/ })
    ).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Collection', { exact: true })).toHaveValue(
      collectionId
    )
    await page.getByRole('button', { name: /Start ·/ }).click()
    await expect(page.getByRole('heading', { name: dutchWord })).toBeVisible()
    await page.getByRole('button', { name: /Reveal answer/ }).click()
    await page.getByRole('button', { name: /Easy/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Session complete' })
    ).toBeVisible()

    await page.goto(wordUrl)
    await expect(page.getByText('EF 2.50', { exact: true })).toBeVisible()
    await expect(page.getByText('Interval 4 d', { exact: true })).toBeVisible()
    await expect(page.getByText('Learning', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Repetition 1 of 3 to established')
    ).toBeVisible()

    await page
      .getByRole('heading', { name: 'Delete word' })
      .scrollIntoViewIfNeeded()
    await page
      .getByLabel('I understand that this removes the word and its progress.')
      .check()
    await page.getByRole('button', { name: 'Delete word', exact: true }).click()
    await expect(page).toHaveURL(collectionUrl)
    await expect(page.getByText('No words in this collection')).toBeVisible()
  } finally {
    await deleteE2ECollections(page)
  }
})
