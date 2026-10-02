import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { assertQaRoot } from './D08-qa-paths.mjs'

const sourceRoot = realpathSync(process.argv[2])
const stackRoot = realpathSync(process.argv[3])

assertQaRoot(sourceRoot, 'native')
assertQaRoot(stackRoot, 'qa')

const status = spawnSync(
  'supabase',
  ['status', '--workdir', stackRoot, '-o', 'env'],
  { encoding: 'utf8' }
)
assert.equal(status.status, 0, status.stderr)

const readStatusValue = name => {
  const match = status.stdout.match(new RegExp(`^${name}="?([^"\\n]+)"?`, 'm'))
  assert.ok(match, `Missing ${name} from local Supabase status`)
  return match[1].trim()
}

const apiUrl = readStatusValue('API_URL')
assert.equal(apiUrl, 'http://127.0.0.1:55321')
const publishableKey =
  status.stdout.match(/^PUBLISHABLE_KEY=/m) !== null
    ? readStatusValue('PUBLISHABLE_KEY')
    : readStatusValue('ANON_KEY')

const child = spawn(
  '/opt/homebrew/opt/node@24/bin/npm',
  [
    'run',
    'dev',
    '--',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    '55400',
  ],
  {
    cwd: `${sourceRoot}/apps/web`,
    env: {
      PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH}`,
      HOME: process.env.HOME,
      NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:55400',
      NEXT_PUBLIC_SENTRY_DSN: '',
    },
    stdio: 'inherit',
  }
)

child.on('error', error => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('close', code => {
  process.exitCode = code ?? 1
})
