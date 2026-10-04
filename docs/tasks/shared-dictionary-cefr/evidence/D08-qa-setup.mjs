import assert from 'node:assert/strict'
import {
  cpSync,
  existsSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { assertQaRoot } from './D08-qa-paths.mjs'

const repo = realpathSync(process.cwd())
const stack = realpathSync(process.argv[2])
const native = realpathSync(process.argv[3])
const mobilePath = 'apps/mobile'
const manifestName = 'package.json'
const tsconfigName = 'tsconfig.json'
const modulesDirectory = 'node_modules'
assertQaRoot(stack, 'qa')
assertQaRoot(native, 'native')
assert.ok(
  existsSync(join(repo, 'docs/tasks/shared-dictionary-cefr/steps/D08.md'))
)
assert.equal(existsSync(join(stack, 'supabase/.temp/project-ref')), false)
if (process.argv[4] === 'web-only') {
  const webPath = join(native, 'apps/web')
  mkdirSync(webPath, { recursive: true })
  for (const file of [
    'src',
    'public',
    manifestName,
    'next.config.ts',
    'next-env.d.ts',
    tsconfigName,
    'postcss.config.mjs',
  ]) {
    cpSync(join(repo, 'apps/web', file), join(webPath, file), {
      recursive: true,
    })
  }
  symlinkSync(
    join(repo, 'apps/web/node_modules'),
    join(webPath, modulesDirectory),
    'dir'
  )
  console.log('Copied local QA web source without dotenv or build artifacts')
  process.exit(0)
}
const nativeOnly = process.argv[4] === 'native-only'
if (!nativeOnly) {
  const configPath = join(stack, 'supabase/config.toml')
  let config = readFileSync(configPath, 'utf8')
  assert.ok(config.includes(`project_id = "${basename(stack)}"`))
  for (const port of [54320, 54321, 54322, 54323, 54324, 54327, 54329]) {
    config = config.replaceAll(String(port), String(port + 1000))
  }
  config = config.replace('sql_paths = ["./seed.sql"]', 'sql_paths = []')
  writeFileSync(configPath, config)
  cpSync(
    join(repo, 'supabase/migrations'),
    join(stack, 'supabase/migrations'),
    {
      recursive: true,
      errorOnExist: true,
      force: false,
    }
  )
}
mkdirSync(join(native, mobilePath), { recursive: true })
for (const file of [manifestName, 'package-lock.json', tsconfigName]) {
  if (existsSync(join(repo, file))) cpSync(join(repo, file), join(native, file))
}
cpSync(join(repo, 'packages'), join(native, 'packages'), {
  recursive: true,
  filter: source =>
    ![modulesDirectory, 'dist', 'coverage'].includes(basename(source)),
})
for (const file of [
  'src',
  manifestName,
  'app.base.json',
  'app.config.js',
  'babel.config.js',
  'metro.config.js',
  tsconfigName,
  'tsconfig.build.json',
  'expo-env.d.ts',
]) {
  cpSync(join(repo, mobilePath, file), join(native, mobilePath, file), {
    recursive: true,
  })
}
if (!existsSync(join(native, modulesDirectory)))
  symlinkSync(
    join(repo, modulesDirectory),
    join(native, modulesDirectory),
    'dir'
  )
if (!existsSync(join(native, mobilePath, modulesDirectory)))
  symlinkSync(
    join(repo, mobilePath, modulesDirectory),
    join(native, mobilePath, modulesDirectory),
    'dir'
  )
// Local-only transport permission for the disposable QA build, never release config.
const appPath = join(native, 'apps/mobile/app.base.json')
const app = JSON.parse(readFileSync(appPath, 'utf8'))
app.expo.ios.infoPlist.NSAppTransportSecurity = { NSAllowsArbitraryLoads: true }
const buildProperties = app.expo.plugins.find(
  plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
)
assert.ok(buildProperties)
buildProperties[1].android = { usesCleartextTraffic: true }
writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n')
console.log(
  JSON.stringify({ stack, native, project: basename(stack), copied: true })
)
