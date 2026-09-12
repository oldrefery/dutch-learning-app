import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir, cpus, platform, arch } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import {
  startFixtureBackend,
  createFixture,
  PUBLIC_KEY,
} from './fixture-backend.mjs'
import { installBrowserProbe, readBrowserMetrics } from './browser-probe.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const smoke = process.argv.includes('--smoke')
const core = process.argv.includes('--core')
assert.ok(
  process.argv.slice(2).every(arg => ['--smoke', '--core'].includes(arg)),
  'Unknown benchmark option'
)
assert.ok(!(smoke && core), 'Choose smoke or core, not both')
const AUTO_PREFETCH = 'auto-prefetch'
const runs = smoke ? 1 : 5
const latencyMs = Number(process.env.WEB_PERF_LATENCY_MS ?? 40)
const cpuRate = Number(process.env.WEB_PERF_CPU_RATE ?? 1)
assert.ok([1, 4].includes(cpuRate), 'CPU rate must be 1 or 4')
const allScenarios = smoke
  ? [{ words: 500, events: 501, selected: 500 }]
  : [
      { words: 500, events: 0, selected: 500 },
      { words: 2500, events: 501, selected: 2500 },
      { words: 5000, events: 5000, selected: 5000 },
      { words: 5000, events: 5000, selected: 20 },
    ]
const scenarios = core
  ? allScenarios.filter(scenario => scenario.words >= 2500)
  : allScenarios
const navigationKinds =
  smoke || core
    ? ['cold', 'client']
    : ['cold', 'client', AUTO_PREFETCH, 'repeat']
const output = join(
  root,
  'apps/web/output/performance/navigation',
  `${Date.now()}-${cpuRate}x${smoke ? '-smoke' : ''}${core ? '-core' : ''}`
)
await mkdir(output, { recursive: true })

async function availablePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

function startProcess(args, cwd, env, log) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let text = ''
  child.stdout.on('data', data => {
    text += data
  })
  child.stderr.on('data', data => {
    text += data
  })
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', async code => {
      await writeFile(log, text)
      resolve(code)
    })
  })
  return { child, finished, text: () => text }
}

async function isolatedSource(directory) {
  const app = join(directory, 'apps/web')
  await mkdir(app, { recursive: true })
  for (const file of ['package.json', 'package-lock.json'])
    await cp(join(root, file), join(directory, file))
  for (const file of [
    'src',
    'public',
    'package.json',
    'tsconfig.json',
    'jest.setup.ts',
    'next.config.ts',
    'postcss.config.mjs',
  ]) {
    await cp(join(root, 'apps/web', file), join(app, file), { recursive: true })
  }
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'))
  await symlink(join(root, 'apps/web/node_modules'), join(app, 'node_modules'))
  // Preserve the application's Sentry build transforms, but prohibit plugin
  // telemetry and source-map upload in the throwaway build.
  const configPath = join(app, 'next.config.ts')
  const config = await readFile(configPath, 'utf8')
  assert.ok(config.includes('deleteSourcemapsAfterUpload: true'))
  await writeFile(
    configPath,
    config
      .replace(
        'deleteSourcemapsAfterUpload: true',
        'disable: true, deleteSourcemapsAfterUpload: true'
      )
      .replace('silent: !process.env.CI,', 'silent: true, telemetry: false,')
  )
  return app
}

async function waitForServer(url, processHandle) {
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.equal(processHandle.child.exitCode, null, processHandle.text())
    try {
      const response = await fetch(`${url}/login`, {
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) return
    } catch {
      /* The process may not yet have bound its socket. */
    }
    await delay(250)
  }
  throw new Error('Isolated Next server did not become ready')
}

async function measure(
  browser,
  backend,
  appUrl,
  scenario,
  mode,
  navigation,
  pair
) {
  const id = `${scenario.words}-${scenario.events}-${scenario.selected}-${navigation}-${pair}-${mode}`
  backend.configure(createFixture(scenario), mode, `${id}-setup`)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  })
  const unexpected = []
  const errors = []
  const prefetchRequests = []
  await context.route('**/*', route => {
    const request = route.request()
    const url = new URL(request.url())
    if (![appUrl, backend.url].includes(url.origin)) {
      unexpected.push(url.origin)
      return route.abort()
    }
    if (request.headers()['next-router-prefetch']) {
      prefetchRequests.push(url.pathname)
      const allowReviewPrefetch = [AUTO_PREFETCH, 'repeat'].includes(navigation)
      if (!allowReviewPrefetch || url.pathname !== '/app/review')
        return route.abort()
    }
    return route.continue()
  })
  await context.addCookies(await backend.cookies(appUrl))
  await context.addInitScript(installBrowserProbe, scenario)
  const page = await context.newPage()
  const primaryNavigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  })
  page.on('pageerror', error => errors.push(error.message))
  if (cpuRate !== 1) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
  }
  try {
    if (navigation !== 'cold') {
      await page.goto(`${appUrl}/app/settings`, { waitUntil: 'networkidle' })
      // Prove the origin screen has hydrated before measuring client navigation.
      await page
        .getByLabel('Default review mode')
        .selectOption('meaning-recall')
      await page.waitForFunction(() =>
        Object.keys(localStorage).some(
          key =>
            key.startsWith('woordenaar:web:settings:') &&
            JSON.parse(localStorage.getItem(key)).lastSelectedReviewMode ===
              'meaning-recall'
        )
      )
      if (navigation === 'repeat') {
        await primaryNavigation.getByTitle('Review', { exact: true }).click()
        await page.waitForFunction(
          () => window.__reviewPerformance.done,
          null,
          {
            timeout: 30000,
          }
        )
        await page
          .getByRole('button', { name: 'Exit review', exact: true })
          .click()
        await primaryNavigation.getByTitle('Settings', { exact: true }).click()
        await page.getByLabel('Default review mode').waitFor()
      }
      if (navigation === AUTO_PREFETCH) {
        await primaryNavigation.getByTitle('Review', { exact: true }).hover()
      }
      await page.waitForLoadState('networkidle')
    }
    await backend.drain()
    const preparationRequests = structuredClone(backend.requests)
    const originDocument =
      navigation === 'cold'
        ? null
        : await page.evaluate(() => performance.timeOrigin)
    backend.configure(createFixture(scenario), mode, id)
    if (navigation === 'cold')
      await page.goto(`${appUrl}/app/review`, { waitUntil: 'commit' })
    else await primaryNavigation.getByTitle('Review', { exact: true }).click()
    await page.waitForFunction(() => window.__reviewPerformance.done, null, {
      timeout: 30000,
    })
    await page.waitForLoadState('networkidle')
    await backend.drain()
    const metrics = await page.evaluate(readBrowserMetrics)
    if (originDocument !== null) {
      assert.equal(
        await page.evaluate(() => performance.timeOrigin),
        originDocument,
        'Expected a client transition, not a document reload'
      )
    }
    assert.ok(
      await page
        .getByText(`1 / ${scenario.selected}`, { exact: true })
        .isVisible(),
      'Session must retain every selected word'
    )
    assert.equal(errors.length, 0, JSON.stringify(errors))
    assert.equal(unexpected.length, 0, 'Browser attempted a non-fixture origin')
    assert.equal(backend.errors.length, 0, JSON.stringify(backend.errors))
    assert.ok(metrics.setupMs > 0 && metrics.startToCardMs > 0)
    const result = {
      id,
      ...scenario,
      mode,
      navigation,
      pair,
      cpuRate,
      latencyMs,
      ...metrics,
      requests: structuredClone(backend.requests),
      preparationRequests,
      prefetchRequests,
    }
    await writeFile(join(output, `${id}.json`), JSON.stringify(result, null, 2))
    console.log(
      `${id}: setup=${metrics.setupMs.toFixed(0)}ms start=${metrics.startToCardMs.toFixed(0)}ms requests=${backend.requests.length}`
    )
    return result
  } catch (error) {
    await page.screenshot({
      path: join(output, `${id}-failure.png`),
      fullPage: true,
    })
    await writeFile(
      join(output, `${id}-failure.json`),
      JSON.stringify(
        {
          errors,
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
    await context.close()
    await backend.drain()
  }
}

function summarize(results) {
  const groups = Map.groupBy(
    results,
    result =>
      `${result.words}/${result.events}/${result.selected}/${result.navigation}/${result.mode}`
  )
  const stats = values => {
    const sorted = values.toSorted((a, b) => a - b)
    return {
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted.at(-1),
    }
  }
  return [...groups].map(([scenario, rows]) => ({
    scenario,
    samples: rows.length,
    setupMs: stats(rows.map(row => row.setupMs)),
    startToCardMs: stats(rows.map(row => row.startToCardMs)),
    navigationToCardMs: stats(rows.map(row => row.navigationToCardMs)),
    requests: stats(rows.map(row => row.requests.length)),
  }))
}

const directory = await mkdtemp(join(tmpdir(), 'review-navigation-'))
let backend
let server
let browser
try {
  backend = await startFixtureBackend({ latencyMs })
  const appUrl = `http://127.0.0.1:${await availablePort()}`
  const app = await isolatedSource(directory)
  // Never inherit application credentials, NODE_OPTIONS, proxies or .env files.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: directory,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: backend.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLIC_KEY,
  }
  const next = join(root, 'node_modules/next/dist/bin/next')
  console.log(
    'Building isolated production app (no application credentials or env files).'
  )
  const build = startProcess(
    [next, 'build', '--webpack'],
    app,
    env,
    join(output, 'build.log')
  )
  const buildCode = await build.finished
  assert.equal(buildCode, 0, build.text())
  server = startProcess(
    [next, 'start', '--hostname', '127.0.0.1', '--port', new URL(appUrl).port],
    app,
    env,
    join(output, 'server.log')
  )
  await waitForServer(appUrl, server)
  browser = await chromium.launch()
  const metadata = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    browser: browser.version(),
    node: process.version,
    platform: `${platform()}-${arch()}`,
    cpu: cpus()[0].model,
    createdAt: new Date().toISOString(),
    runs,
    profile: smoke ? 'smoke' : core ? 'core' : 'full',
    cpuRate,
    latencyMs,
    caveats: [
      'Synthetic loopback upstream; not production network, SQL or authentication performance.',
      'Fresh browser context per sample; Next process is warm after production build/start.',
      'Browser interception disables its HTTP cache; router cache remains enabled.',
      'Auto-prefetch uses existing application behavior, not forced full-data prefetch.',
      'Unrelated route prefetch is blocked; cold/client block Review prefetch too.',
      'Setup includes real mode/scope interaction checks, then Start is pressed immediately.',
      'No learning assessment is submitted. No real account, cookies or credentials are loaded.',
      'Mapping, serialization and hydration are included in browser boundaries, not separately attributed.',
    ],
  }
  const results = []
  if (!smoke) {
    for (const mode of ['legacy', 'snapshot']) {
      await measure(
        browser,
        backend,
        appUrl,
        scenarios[0],
        mode,
        'cold',
        'warmup'
      )
    }
  }
  for (const scenario of scenarios) {
    for (const navigation of navigationKinds) {
      for (let pair = 0; pair < runs; pair++) {
        // Alternate order to reduce consistent JIT/thermal/order bias.
        for (const mode of pair % 2
          ? ['snapshot', 'legacy']
          : ['legacy', 'snapshot']) {
          results.push(
            await measure(
              browser,
              backend,
              appUrl,
              scenario,
              mode,
              navigation,
              pair
            )
          )
        }
      }
    }
  }
  await writeFile(
    join(output, 'summary.json'),
    JSON.stringify({ metadata, summary: summarize(results) }, null, 2)
  )
  console.log(`Results: ${output}`)
} finally {
  await browser?.close()
  if (server) {
    server.child.kill('SIGTERM')
    await server.finished
  }
  await backend?.close()
  // Only remove the exact private directory created by this invocation.
  await rm(directory, { recursive: true, force: true })
}
