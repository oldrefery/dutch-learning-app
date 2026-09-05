import { expect, test } from '@playwright/test'
import {
  createE2ECollection,
  deleteE2ECollections,
} from './support/collections'

test.describe('@extended authenticated workspace', () => {
  test('persists preferences, reports connectivity, and protects account deletion', async ({
    context,
    page,
  }) => {
    await page.goto('/app/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    const autoPlay = page.getByRole('switch', {
      name: /Auto-play pronunciation/,
    })
    const originalAutoPlay = await autoPlay.isChecked()
    const selectedTheme = page.locator('input[name="theme"]:checked')
    const originalTheme = await selectedTheme.inputValue()

    try {
      await autoPlay.setChecked(!originalAutoPlay)
      await page.getByRole('radio', { name: /Dark/ }).check()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

      await page.reload()
      await expect(autoPlay).toBeChecked({ checked: !originalAutoPlay })
      await expect(page.getByRole('radio', { name: /Dark/ })).toBeChecked()

      await context.setOffline(true)
      await expect(
        page.getByText('Browser offline', { exact: true })
      ).toBeVisible()
      await context.setOffline(false)
      await expect(
        page.getByText('Browser online', { exact: true })
      ).toBeVisible()

      await page.getByRole('button', { name: 'Begin account deletion' }).click()
      await expect(
        page.getByRole('heading', { name: 'Confirm permanent deletion' })
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Delete my account permanently' })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(
        page.getByRole('button', { name: 'Begin account deletion' })
      ).toBeVisible()
    } finally {
      await context.setOffline(false)
      await page.goto('/app/settings')
      await page
        .getByRole('switch', { name: /Auto-play pronunciation/ })
        .setChecked(originalAutoPlay)
      await page
        .getByRole('radio', { name: new RegExp(`^${originalTheme}`, 'i') })
        .check()
    }
  })

  test('validates starter-pack and batch-capture selection without AI writes', async ({
    page,
  }) => {
    await page.goto('/app/starter-pack')
    await expect(
      page.getByText('Official content', { exact: false })
    ).toBeVisible()
    const clearSelection = page.getByRole('button', { name: 'Clear selection' })
    await expect(clearSelection).toBeVisible()
    await clearSelection.click()
    await expect(
      page.getByRole('button', { name: 'Import 0 words' })
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Select available' }).click()
    await expect(
      page.getByRole('button', { name: /^Import \d+ words?$/ })
    ).toBeEnabled()

    await page.goto('/app/batch-capture')
    await expect(
      page.getByRole('heading', { name: 'Batch capture' })
    ).toBeVisible()
    const input = page.getByLabel('Dutch words')
    const analyze = page.getByRole('button', { name: /Analyze \d+ words/ })
    await input.fill('huis ; house\nHUIS ; home\n; missing')
    await expect(page.getByText('1 valid', { exact: true })).toBeVisible()
    await expect(
      page.getByText('2 unrecognized', { exact: true })
    ).toBeVisible()
    await expect(analyze).toBeDisabled()

    await input.fill('huis ; house\nHUIS ; home')
    await expect(page.getByText('1 valid', { exact: true })).toBeVisible()
    await expect(
      page.getByText('1 unrecognized', { exact: true })
    ).toBeVisible()
    await expect(analyze).toBeEnabled()
  })

  test('imports one starter-pack word into a disposable collection', async ({
    page,
  }) => {
    await deleteE2ECollections(page)

    try {
      const collection = await createE2ECollection(
        page,
        `Starter ${Date.now().toString(36)}`
      )
      await page.goto('/app/starter-pack')
      await page.getByLabel('Target collection').selectOption({
        label: collection.name,
      })
      await page.getByRole('button', { name: 'Clear selection' }).click()
      await page
        .locator('input[name="entryIds"]:not(:disabled)')
        .first()
        .check()
      await page.getByRole('button', { name: 'Import 1 word' }).click()

      await expect(page.getByText('Starter pack imported')).toBeVisible({
        timeout: 60_000,
      })
      await expect(
        page.getByRole('heading', { name: '1 new word is ready' })
      ).toBeVisible()
      await page.getByRole('link', { name: `Open ${collection.name}` }).click()
      await expect(
        page.getByRole('heading', { name: collection.name })
      ).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText('1 words', { exact: true })).toBeVisible()
    } finally {
      await deleteE2ECollections(page)
    }
  })

  test('publishes and revokes a disposable collection share link', async ({
    page,
  }) => {
    await deleteE2ECollections(page)

    try {
      const collection = await createE2ECollection(
        page,
        `Sharing ${Date.now().toString(36)}`
      )
      await page.getByRole('button', { name: 'Publish collection' }).click()
      await expect(
        page.getByRole('heading', { name: 'Published collection' })
      ).toBeVisible({ timeout: 60_000 })
      const shareUrl = await page.getByLabel('Share link').inputValue()
      const sharePath = new URL(shareUrl).pathname

      await page.goto(sharePath)
      await expect(
        page.getByRole('heading', { name: collection.name })
      ).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText('Shared words').locator('..')).toContainText(
        '0'
      )
      await expect(
        page.getByText(
          `“${collection.name}” does not contain any active words yet.`
        )
      ).toBeVisible()

      await page.goto(collection.url)
      await page.getByRole('button', { name: 'Stop sharing' }).click()
      await expect(
        page.getByRole('heading', { name: 'Private collection' })
      ).toBeVisible({ timeout: 60_000 })
      await page.goto(sharePath)
      await expect(
        page.getByRole('heading', {
          name: 'This collection is no longer shared',
        })
      ).toBeVisible({ timeout: 60_000 })
    } finally {
      await deleteE2ECollections(page)
    }
  })

  test('loads every primary workspace destination and insights representation', async ({
    page,
  }) => {
    const routes = [
      ['/app/collections', 'Collections'],
      ['/app/review', 'Review'],
      ['/app/add', 'Add a Dutch word'],
      ['/app/history', 'History'],
      ['/app/settings', 'Settings'],
      ['/app/insights', 'Insights'],
      ['/app/batch-capture', 'Batch capture'],
      ['/app/review/audio', 'Audio Review'],
      ['/app/guide', 'How the schedule works'],
      ['/app/search', 'Search words'],
    ] as const

    for (const [path, heading] of routes) {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { name: heading }).first()
      ).toBeVisible()
    }

    await page.goto('/app/insights')
    const tableToggle = page
      .getByRole('button', { name: 'View as table' })
      .first()
    if (await tableToggle.isVisible()) {
      await tableToggle.click()
      await expect(page.getByRole('table').first()).toBeVisible()
      await page.getByRole('button', { name: 'View as bars' }).first().click()
      await expect(
        page.getByRole('button', { name: 'View as table' }).first()
      ).toBeVisible()
    }
  })
})
