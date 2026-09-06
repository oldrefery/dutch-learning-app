import { expect, type Request } from '@playwright/test'
import {
  test,
  startReview,
  expectPersistedProgress,
} from './support/review-fixture'

test.use({
  actionTimeout: 15_000,
  navigationTimeout: 60_000,
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  video: 'off',
  screenshot: 'off',
})

for (const failure of ['offline', 'lost-response'] as const) {
  test(`@extended retries a review after ${failure} without doubling progress`, async ({
    page,
    context,
    reviewWord,
  }) => {
    await startReview(page, reviewWord.collectionId)
    const requests: string[] = []
    const isReviewWrite = (request: Request) =>
      request.method() === 'POST' &&
      !!request.headers()['next-action'] &&
      new URL(request.url()).pathname === '/app/review'
    page.on('request', request => {
      if (isReviewWrite(request)) requests.push(request.postData() ?? '')
    })
    let acceptedResponse = false
    if (failure === 'offline') {
      await context.setOffline(true)
      expect(await page.evaluate(() => navigator.onLine)).toBe(false)
    } else {
      await page.route(
        '**/app/review?**',
        async route => {
          if (!isReviewWrite(route.request())) return route.continue()
          // Execute the real server action; lose only its response to the browser.
          const response = await route.fetch({ maxRetries: 0 })
          acceptedResponse = response.ok()
          await route.abort('connectionreset')
        },
        { times: 1 }
      )
    }

    await page.getByRole('button', { name: /Easy/ }).click()
    await expect(
      page.getByText('Could not save this review. Please try again.', {
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Session complete' })
    ).toHaveCount(0)
    await expect(page.getByText('0 completed', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Easy/ })).toBeEnabled()
    if (failure === 'lost-response') expect(acceptedResponse).toBe(true)

    await context.setOffline(false)
    expect(await page.evaluate(() => navigator.onLine)).toBe(true)
    const observer = await context.newPage()
    try {
      await expectPersistedProgress(
        observer,
        reviewWord.wordUrl,
        failure === 'lost-response'
      )
      await page.getByRole('button', { name: /Easy/ }).click()
      await expect(
        page.getByRole('heading', { name: 'Session complete' })
      ).toBeVisible()
      expect(requests).toHaveLength(2)
      expect(requests[0].length > 0).toBe(true)
      expect(requests[1] === requests[0]).toBe(true)
      await expectPersistedProgress(observer, reviewWord.wordUrl, true)
      await observer.reload()
      await expect(
        observer.getByText('Repetition 1 of 3 to established')
      ).toBeVisible()
    } finally {
      await observer.close()
    }
  })
}
