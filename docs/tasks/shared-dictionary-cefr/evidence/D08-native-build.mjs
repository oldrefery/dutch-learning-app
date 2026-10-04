import assert from 'node:assert/strict'
import { createWriteStream, mkdirSync, realpathSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { assertQaRoot } from './D08-qa-paths.mjs'

const action = process.argv[2]
const sourceRoot = realpathSync(process.argv[3])
const stackRoot = realpathSync(process.argv[4])
const dictionaryEnabled = process.argv[5]

assertQaRoot(sourceRoot, 'native')
assertQaRoot(stackRoot, 'qa')
assert.ok(
  [
    'prebuild-android',
    'prebuild-ios',
    'pods-ios',
    'build-android',
    'clean-android',
    'build-ios',
  ].includes(action)
)
assert.ok(dictionaryEnabled === 'true' || dictionaryEnabled === 'false')

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
const nativeApiUrl = process.argv[6] ?? apiUrl
assert.ok([apiUrl, 'http://127.0.0.1:55331'].includes(nativeApiUrl))
const publishableKey =
  status.stdout.match(/^PUBLISHABLE_KEY=/m) !== null
    ? readStatusValue('PUBLISHABLE_KEY')
    : readStatusValue('ANON_KEY')
const buildTmp = `${sourceRoot}/tmp-${dictionaryEnabled}`
mkdirSync(buildTmp, { recursive: true, mode: 0o700 })

const env = {
  PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH}`,
  HOME: process.env.HOME,
  // Metro does not include inlined EXPO_PUBLIC_* values in every transform-cache
  // key. Isolate caches so enabled and dormant QA artifacts cannot share a bundle.
  TMPDIR: buildTmp,
  LANG: 'en_US.UTF-8',
  LC_ALL: 'en_US.UTF-8',
  JAVA_HOME: '/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home',
  ANDROID_HOME: '/Users/devrush/Library/Android/sdk',
  ANDROID_SDK_ROOT: '/Users/devrush/Library/Android/sdk',
  CI: '1',
  NODE_ENV: 'production',
  EXPO_NO_DOTENV: '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_OFFLINE: '1',
  COCOAPODS_DISABLE_STATS: 'true',
  WOORDENAAR_QA_BUILD: 'true',
  SENTRY_DISABLE_AUTO_UPLOAD: 'true',
  SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD: 'true',
  EXPO_PUBLIC_SUPABASE_URL: nativeApiUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: publishableKey,
  EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED: dictionaryEnabled,
}

const prebuild = action.startsWith('prebuild-')
const ios = action.endsWith('ios')
const command = prebuild
  ? process.execPath
  : action === 'pods-ios'
    ? '/opt/homebrew/lib/ruby/gems/3.3.0/bin/pod'
    : ios
      ? 'xcodebuild'
      : './gradlew'
const args = prebuild
  ? [
      `${sourceRoot}/node_modules/expo/bin/cli`,
      'prebuild',
      '--platform',
      ios ? 'ios' : 'android',
      '--no-install',
    ]
  : action === 'pods-ios'
    ? ['install', '--no-repo-update']
    : action === 'build-ios'
      ? [
          '-workspace',
          'DeWoordenaar.xcworkspace',
          '-scheme',
          'DeWoordenaar',
          '-configuration',
          'Release',
          '-sdk',
          'iphonesimulator',
          '-destination',
          'generic/platform=iOS Simulator',
          '-derivedDataPath',
          `${sourceRoot}/ios-derived`,
          '-jobs',
          '2',
          'ARCHS=arm64',
          'ONLY_ACTIVE_ARCH=YES',
          'CODE_SIGNING_ALLOWED=NO',
          'build',
        ]
      : action === 'clean-android'
        ? ['clean', '--no-daemon', '--max-workers=2']
        : [
            'assembleRelease',
            '--no-daemon',
            '--max-workers=2',
            '-PreactNativeArchitectures=arm64-v8a',
          ]
const cwd = `${sourceRoot}/apps/mobile${prebuild ? '' : ios ? '/ios' : '/android'}`
const logPath = `${sourceRoot}/${action}-${dictionaryEnabled}-${Date.now()}.log`
const log = createWriteStream(logPath, { flags: 'wx', mode: 0o600 })
const child = spawn(command, args, {
  cwd,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

child.stdout.pipe(log)
child.stderr.pipe(log)
child.on('error', error => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('close', code => {
  log.end()
  console.log(JSON.stringify({ action, dictionaryEnabled, code, log: logPath }))
  process.exitCode = code ?? 1
})
