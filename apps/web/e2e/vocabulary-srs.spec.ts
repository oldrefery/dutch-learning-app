import { expect, type Locator } from '@playwright/test'
import { deleteE2ECollections } from './support/collections'
import { test } from './support/smoke-collection'

test.use({ actionTimeout: 15_000, navigationTimeout: 60_000 })

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

test('@smoke covers collection CRUD, word analysis, search, history, and SRS', async ({
  page,
  smokeCollection,
}) => {
  const collectionName = smokeCollection.name
  const renamedCollectionName = smokeCollection.renamedName
  const dutchWord = 'zwenkgras'

  // Preserve recovery from older failed runs that left the fixed test word.
  await deleteE2ECollections(page)

  await page.getByText('New collection', { exact: true }).click()
  await page.getByLabel('Collection name').fill(collectionName)
  await expect(page.getByLabel('Collection name')).toHaveValue(collectionName)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const collectionLink = page.getByRole('link', {
    name: collectionName,
    exact: true,
  })
  await expect(collectionLink).toBeVisible({ timeout: 60_000 })
  await collectionLink.click()
  await expect(page.getByRole('heading', { name: collectionName })).toBeVisible(
    { timeout: 60_000 }
  )

  await page.getByLabel('New collection name').fill(renamedCollectionName)
  await expect(page.getByLabel('New collection name')).toHaveValue(
    renamedCollectionName
  )
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(
    page.getByRole('heading', { name: renamedCollectionName })
  ).toBeVisible({ timeout: 60_000 })

  await page.getByRole('main').getByRole('link', { name: 'Add word' }).click()
  await page.getByLabel('Dutch word or expression').fill(dutchWord)
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  const saveWordButton = page.getByRole('button', { name: 'Save word' })
  await expect(saveWordButton).toBeEnabled({ timeout: 90_000 })
  await saveWordButton.click()

  await expect(page).toHaveURL(
    /\/app\/collections\/[0-9a-f-]+\/words\/[0-9a-f-]+$/,
    { timeout: 90_000 }
  )
  await expect(page.getByRole('heading', { name: dutchWord })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText('EF 2.50', { exact: true })).toBeVisible()
  await expect(page.getByText('Interval 1 d', { exact: true })).toBeVisible()
  await expect(page.getByText('New', { exact: true })).toBeVisible()
  await expect(page.getByText('Repetition 0 of 3 to established')).toBeVisible()

  const wordUrl = page.url()
  const collectionUrl = wordUrl.replace(/\/words\/[0-9a-f-]+$/, '')
  const collectionId = collectionUrl.split('/').at(-1)
  if (!collectionId) throw new Error('Could not read the E2E collection ID.')

  await page.goto('/app/history')
  await expect(page.getByText(dutchWord, { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  await expect(
    page.getByText(renamedCollectionName, { exact: true })
  ).toBeVisible()

  await page.goto('/app/search')
  await page.getByPlaceholder('Dutch word or translation').fill(dutchWord)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('link', { name: new RegExp(dutchWord) })
  ).toBeVisible({ timeout: 60_000 })

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
  const startButton = page.getByRole('button', { name: /Start ·/ })
  await expect(
    startButton,
    'A newly created word must be due for its first review today.'
  ).toBeEnabled()
  await startButton.click()
  await expect(page.getByRole('heading', { name: dutchWord })).toBeVisible({
    timeout: 60_000,
  })
  await page.getByRole('button', { name: /Reveal answer/ }).click()
  await page.getByRole('button', { name: /Easy/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Session complete' })
  ).toBeVisible({ timeout: 60_000 })

  await page.goto(wordUrl)
  await expect(page.getByText('EF 2.50', { exact: true })).toBeVisible()
  await expect(page.getByText('Interval 4 d', { exact: true })).toBeVisible()
  await expect(page.getByText('Learning', { exact: true })).toBeVisible()
  await expect(page.getByText('Repetition 1 of 3 to established')).toBeVisible()

  await page
    .getByRole('heading', { name: 'Delete word' })
    .scrollIntoViewIfNeeded()
  await page
    .getByLabel('I understand that this removes the word and its progress.')
    .check()
  await page.getByRole('button', { name: 'Delete word', exact: true }).click()
  await expect(page).toHaveURL(collectionUrl, { timeout: 60_000 })
  await expect(page.getByText('No words in this collection')).toBeVisible({
    timeout: 60_000,
  })
})
