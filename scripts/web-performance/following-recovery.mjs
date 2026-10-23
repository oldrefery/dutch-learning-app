import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  COLLECTION_ID,
  USER_ID,
  createFollowingFixture,
} from './fixture-backend.mjs'

/** Exercise shipped UI boundaries with test-owned cookies and read-only fixture RPCs. */
export async function qualifyFollowingRecovery(
  browser,
  backend,
  appUrl,
  output,
  colorScheme = 'light'
) {
  const scenario = { words: 500, events: 501, selected: 20 }
  const settingsUrl = `${appUrl}/app/settings`
  const defaultModeLabel = 'Default review mode'
  const exitLabel = 'Exit review'
  const productionMode = 'dutch-production'
  const context = await browser.newContext({
    serviceWorkers: 'block',
    colorScheme,
  })
  const unexpected = []
  const checks = []
  await context.route('**/*', route => {
    const request = route.request()
    const origin = new URL(request.url()).origin
    if (![appUrl, backend.url].includes(origin)) {
      unexpected.push(origin)
      return route.abort()
    }
    if (request.headers()['next-router-prefetch']) return route.abort()
    return route.continue()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  const configure = async options => {
    await backend.drain()
    backend.configure(
      createFollowingFixture(scenario, options),
      'following',
      'recovery'
    )
  }
  const installOwner = async ownerId => {
    await configure({ ownerId })
    await context.clearCookies()
    await context.addCookies(await backend.cookies(appUrl))
  }
  const start = async () => {
    await page.getByRole('radio', { name: /^Meaning recall/ }).click()
    await page.getByRole('button', { name: /^Start ·/ }).click()
    await page.locator('article').getByRole('heading', { level: 1 }).waitFor()
  }
  const prompt = () =>
    page.locator('article').getByRole('heading', { level: 1 }).innerText()
  try {
    await installOwner(USER_ID)
    backend.setUnavailable(true)
    await page.goto(`${appUrl}/app/review`, { waitUntil: 'networkidle' })
    await page
      .getByRole('heading', { name: 'Review could not be loaded' })
      .waitFor()
    backend.setUnavailable(false)
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await page.getByRole('button', { name: /^Start ·/ }).waitFor()
    await page.waitForFunction(
      theme => document.documentElement.dataset.theme === theme,
      colorScheme
    )
    checks.push('failed following snapshot recovers through shipped Retry')

    await start()
    const originalPrompt = await prompt()
    assert.ok(!originalPrompt.includes('-updated'))
    await context.setOffline(true)
    await page.getByRole('button', { name: /^Reveal answer/ }).click()
    assert.equal(await prompt(), originalPrompt)
    await page
      .getByRole('button', { name: 'Full details', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Retry full details', exact: true })
      .waitFor()
    await context.setOffline(false)
    await configure({ updated: true })
    await page
      .getByRole('button', { name: 'Retry full details', exact: true })
      .click()
    await page
      .getByRole('heading', {
        name: `de ${originalPrompt}-updated`,
        exact: true,
      })
      .waitFor()
    await page
      .getByRole('button', { name: 'Back to question', exact: true })
      .click()
    assert.equal(await prompt(), originalPrompt)
    checks.push(
      'loaded question and answer survive offline; full detail retry reads new shared head without replacing question'
    )

    const other = await context.newPage()
    await other.goto(`${appUrl}/app/collections/${COLLECTION_ID}`, {
      waitUntil: 'networkidle',
    })
    await other
      .getByRole('link', { name: /meaning-0-updated/ })
      .first()
      .waitFor()
    await other.goto(
      `${appUrl}/app/collections/${COLLECTION_ID}/words/10000000-0000-4000-8000-000000000000`,
      { waitUntil: 'networkidle' }
    )
    await other
      .getByRole('heading', { name: 'de meaning-0-updated', exact: true })
      .waitFor()
    assert.equal(await prompt(), originalPrompt)
    await other.close()
    await page.getByRole('button', { name: exitLabel, exact: true }).click()
    await page.waitForLoadState('networkidle')
    await start()
    assert.ok((await prompt()).endsWith('-updated'))
    checks.push(
      'collection/detail reflect shared head; only next review session adopts it'
    )

    await page.goto(settingsUrl, { waitUntil: 'networkidle' })
    await page.getByLabel(defaultModeLabel).selectOption(productionMode)
    await page.waitForFunction(
      ({ owner, expected }) =>
        JSON.parse(localStorage.getItem(`woordenaar:web:settings:${owner}`))
          ?.lastSelectedReviewMode === expected,
      { owner: USER_ID, expected: productionMode }
    )
    const ownerB = '00000000-0000-4000-8000-000000000003'
    await installOwner(ownerB)
    await page.goto(settingsUrl, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      () => document.querySelector('select')?.value === 'adaptive'
    )
    assert.equal(
      await page.getByLabel(defaultModeLabel).inputValue(),
      'adaptive'
    )
    await page.getByLabel(defaultModeLabel).selectOption('meaning-recall')
    await page.waitForFunction(
      owner =>
        JSON.parse(localStorage.getItem(`woordenaar:web:settings:${owner}`))
          ?.lastSelectedReviewMode === 'meaning-recall',
      ownerB
    )
    await page.goto(`${appUrl}/app/review`, { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: /^One collection/ }).click()
    assert.equal(
      await page
        .getByLabel('Collection', { exact: true })
        .locator('option')
        .last()
        .innerText(),
      'Owner 3 fixture'
    )
    assert.equal(
      await page.getByRole('button', { name: exitLabel, exact: true }).count(),
      0
    )
    await start()
    await installOwner(USER_ID)
    await page.goto(settingsUrl, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      expected =>
        [...document.querySelectorAll('select')].some(
          select => select.value === expected
        ),
      productionMode
    )
    assert.equal(
      await page.getByLabel(defaultModeLabel).inputValue(),
      productionMode
    )
    await page.goto(`${appUrl}/app/review`, { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: /^One collection/ }).click()
    assert.equal(
      await page
        .getByLabel('Collection', { exact: true })
        .locator('option')
        .last()
        .innerText(),
      'Owner 1 fixture'
    )
    assert.equal(
      await page.getByRole('button', { name: exitLabel, exact: true }).count(),
      0
    )
    checks.push(
      'same browser A-B-A return restores owner settings and discards another owner session'
    )

    await backend.drain()
    assert.deepEqual(unexpected, [])
    assert.deepEqual(backend.errors, [])
    checks.push(
      'only isolated origins and allowlisted read RPCs; no learning or provider writes'
    )
    return {
      checks,
      colorScheme,
      passed: checks.length,
      scenario,
      limitations: [
        'Synthetic owner identity; not production token validation.',
        'Loaded session works offline; cold offline navigation requires connectivity and explicit retry.',
        'No learning assessment was submitted.',
      ],
    }
  } catch (error) {
    await page.screenshot({
      path: join(output, 'recovery-failure.png'),
      fullPage: true,
    })
    await writeFile(
      join(output, 'recovery-failure.json'),
      JSON.stringify(
        {
          checks,
          unexpected,
          backendErrors: backend.errors,
          requests: backend.requests,
        },
        null,
        2
      )
    )
    throw error
  } finally {
    backend.setUnavailable(false)
    await context.setOffline(false)
    await context.close()
  }
}
