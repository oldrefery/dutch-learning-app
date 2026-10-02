import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { assertQaRoot } from './D08-qa-paths.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const stack = assertQaRoot(resolve(process.argv[2]), 'qa')
const fixture = resolve(process.argv[3])
assert.equal(
  fixture,
  join(
    root,
    'reports/shared-dictionary-cefr/woordenaar-d08-native.20261001/fixture-private.json'
  )
)
const status = JSON.parse(
  execFileSync('supabase', ['status', '--workdir', stack, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
)
assert.equal(status.API_URL, 'http://127.0.0.1:55321')
const directory = await mkdtemp(join(tmpdir(), 'woordenaar-d09-web-'))
const app = join(directory, 'apps/web')
await mkdir(app, { recursive: true })
for (const name of ['package.json', 'package-lock.json'])
  await cp(join(root, name), join(directory, name))
for (const name of [
  'src',
  'public',
  'package.json',
  'tsconfig.json',
  'jest.setup.ts',
  'next.config.ts',
  'postcss.config.mjs',
]) {
  await cp(join(root, 'apps/web', name), join(app, name), { recursive: true })
}
await symlink(join(root, 'node_modules'), join(directory, 'node_modules'))
await symlink(join(root, 'apps/web/node_modules'), join(app, 'node_modules'))
const configPath = join(app, 'next.config.ts')
const config = await readFile(configPath, 'utf8')
await writeFile(
  configPath,
  config
    .replace(
      'deleteSourcemapsAfterUpload: true',
      'disable: true, deleteSourcemapsAfterUpload: true'
    )
    .replace('silent: !process.env.CI,', 'silent: true, telemetry: false,')
)

const children = []
let stopping = false
const stop = () => {
  if (stopping) return
  stopping = true
  for (const child of children)
    if (child.exitCode === null) child.kill('SIGTERM')
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
const proxy = spawn(
  process.execPath,
  [
    join(root, 'docs/tasks/shared-dictionary-cefr/evidence/D08-qa-proxy.mjs'),
    fixture,
  ],
  { stdio: ['ignore', 'inherit', 'inherit'] }
)
children.push(proxy)
const web = spawn(
  process.execPath,
  [
    join(root, 'node_modules/next/dist/bin/next'),
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    '55400',
  ],
  {
    cwd: app,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: directory,
      NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1',
      DICTIONARY_CONTENT_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55331',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        status.PUBLISHABLE_KEY ?? status.ANON_KEY,
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:55400',
      NEXT_PUBLIC_SENTRY_DSN: '',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  }
)
children.push(web)
for (const child of children) child.on('exit', stop)
await writeFile(
  join(root, 'reports/shared-dictionary-cefr/D09-local-runner.json'),
  JSON.stringify(
    {
      directory,
      pid: process.pid,
      proxyPid: proxy.pid,
      webPid: web.pid,
      startedAt: new Date().toISOString(),
    },
    null,
    2
  )
)
console.log(
  'D09 isolated web and fixture proxy started; source copy retained for evidence.'
)
await Promise.all(
  children.map(child => new Promise(resolve => child.on('exit', resolve)))
)
