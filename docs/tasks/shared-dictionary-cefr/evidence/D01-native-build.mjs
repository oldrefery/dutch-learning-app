import { spawn } from 'node:child_process'
import { createWriteStream, realpathSync } from 'node:fs'
import assert from 'node:assert/strict'

const root = realpathSync(process.argv[3])
assert.match(root, /^\/private\/tmp\/woordenaar-d01-native-[A-Za-z0-9]+$/)
const action = process.argv[2]
assert.ok(
  [
    'prebuild-android',
    'prebuild-ios',
    'pods-ios',
    'build-android',
    'build-ios',
  ].includes(action)
)
const env = {
  PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH}`,
  HOME: process.env.HOME,
  TMPDIR: root,
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
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:58170',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_d01_synthetic_fixture_only',
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
      `${root}/node_modules/expo/bin/cli`,
      'prebuild',
      '--platform',
      action.endsWith('ios') ? 'ios' : 'android',
      '--no-install',
    ]
  : action === 'pods-ios'
    ? ['install']
    : ios
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
          `${root}/ios-derived`,
          '-jobs',
          '2',
          'ARCHS=arm64',
          'ONLY_ACTIVE_ARCH=YES',
          'CODE_SIGNING_ALLOWED=NO',
          'build',
        ]
      : [
          'assembleRelease',
          '--no-daemon',
          '--max-workers=2',
          '-PreactNativeArchitectures=arm64-v8a',
        ]
const cwd = `${root}/apps/mobile${prebuild ? '' : ios ? '/ios' : '/android'}`
const logPath = `${root}/${action}-${Date.now()}.log`
const log = createWriteStream(logPath, { flags: 'wx' })
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
  console.log(JSON.stringify({ action, code, log: logPath }))
  process.exitCode = code ?? 1
})
