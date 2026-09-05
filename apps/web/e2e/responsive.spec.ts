import { expect, test } from '@playwright/test'

test('@extended mobile shell stays navigable without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/app/collections')
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation' })
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' })
  ).toBeHidden()

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  )
  expect(hasHorizontalOverflow).toBe(false)

  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Review' })
    .click()
  await expect(page).toHaveURL(/\/app\/review/)
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
})
