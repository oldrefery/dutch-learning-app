import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A separate, network-disabled package on the already assigned Android device.
// Never overwrite an existing harness or mutate the retained main application.
const repo = process.cwd()
const root = join(
  repo,
  'reports/shared-dictionary-cefr/woordenaar-d08-native.d10upgrade20261002'
)
const retained = join(
  repo,
  'reports/shared-dictionary-cefr/woordenaar-d08-native.20261001'
)
assert.equal(
  existsSync(root),
  false,
  'Inspect retained harness before any retry'
)
assert.equal(
  execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  'feature/shared-dictionary-schema'
)
const manifestName = 'package.json'
const mobilePath = 'apps/mobile'
const app = join(root, mobilePath)
mkdirSync(app, { recursive: true, mode: 0o700 })
for (const name of [manifestName, 'package-lock.json'])
  cpSync(join(repo, name), join(root, name))
for (const name of [
  manifestName,
  'app.config.js',
  'app.base.json',
  'babel.config.js',
  'metro.config.js',
  'tsconfig.json',
  'src',
]) {
  cpSync(join(repo, mobilePath, name), join(app, name), { recursive: true })
}
cpSync(join(repo, 'packages'), join(root, 'packages'), {
  recursive: true,
  filter: path =>
    !['node_modules', 'dist', 'coverage'].includes(basename(path)),
})
cpSync(join(retained, 'apps/mobile/android'), join(app, 'android'), {
  recursive: true,
  filter: path => !['build', '.gradle', '.cxx'].includes(basename(path)),
})
symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir')
symlinkSync(
  join(repo, 'apps/mobile/node_modules'),
  join(app, 'node_modules'),
  'dir'
)
const manifest = JSON.parse(readFileSync(join(app, manifestName), 'utf8'))
manifest.main = 'index.js'
writeFileSync(join(app, manifestName), JSON.stringify(manifest, null, 2) + '\n')

const fingerprint = value => createHash('sha256').update(value).digest('hex')
const hashes = []
const files = [
  'initDB.ts',
  'schema.ts',
  'reviewCorrectionSchema.ts',
  'reviewCorrectionRecoverySchema.ts',
  'dictionaryContentSchema.ts',
  'dictionaryImportSchema.ts',
]
for (const version of [14, 15]) {
  for (const current of [false, true]) {
    const ref = current ? 'c3f9baf' : version === 14 ? 'dfdc7f0' : '5efd6ff'
    const target = join(
      app,
      'upgrade',
      `${current ? 'current' : 'old'}${version}`
    )
    mkdirSync(target, { recursive: true })
    const selected = current
      ? [
          ...files,
          'dictionaryImportRecoverySchema.ts',
          'dictionaryImportRecoveryViewRepository.ts',
          'dictionaryImportRecoveryStorage.ts',
        ]
      : files
    for (const file of selected) {
      const path = `apps/mobile/src/db/${file}`
      const original = execFileSync('git', ['show', `${ref}:${path}`], {
        encoding: 'utf8',
      })
      let copied = original
      if (file === 'initDB.ts') {
        assert.ok(
          original.includes(`const SCHEMA_VERSION = ${current ? 16 : version}`)
        )
        copied = original
          .replace(
            "const DB_NAME = 'dutch_learning.db'",
            `const DB_NAME = 'd10-v${version}.db'`
          )
          .replace(
            "const SCHEMA_VERSION_KEY = 'db_schema_version'",
            `const SCHEMA_VERSION_KEY = 'd10_schema_v${version}'`
          )
          .replace("from '@/lib/sentry'", "from '../sentry'")
      }
      writeFileSync(join(target, file), copied)
      hashes.push({
        ref,
        path,
        copy: `upgrade/${basename(target)}/${file}`,
        original: fingerprint(original),
        copied: fingerprint(copied),
      })
    }
  }
}
writeFileSync(
  join(app, 'upgrade/sentry.ts'),
  'export const Sentry = { addBreadcrumb() {}, captureMessage() {}, captureException() {} }\n'
)
for (const [source, destination] of [
  ['D10-native-upgrade-app.js', 'upgrade/app.js'],
  ['D10-native-upgrade-fixture.js', 'upgrade/D10-native-upgrade-fixture.js'],
]) {
  cpSync(
    fileURLToPath(new URL(source, import.meta.url)),
    join(app, destination)
  )
}
writeFileSync(
  join(app, 'index.js'),
  `
import { registerUpgradeHarness } from './upgrade/app'
import * as old14 from './upgrade/old14/initDB'
import * as old15 from './upgrade/old15/initDB'
import * as current14 from './upgrade/current14/initDB'
import * as current15 from './upgrade/current15/initDB'
import { dictionaryImportRecoveryViewRepository as view14 } from './upgrade/current14/dictionaryImportRecoveryViewRepository'
import { dictionaryImportRecoveryViewRepository as view15 } from './upgrade/current15/dictionaryImportRecoveryViewRepository'
import { requireOrigin } from './upgrade/current14/dictionaryImportRecoveryStorage'
registerUpgradeHarness([
  { version: 14, old: old14, current: current14, view: view14 },
  { version: 15, old: old15, current: current15, view: view15 },
], requireOrigin)
`
)
const gradlePath = join(app, 'android/app/build.gradle')
const gradle = readFileSync(gradlePath, 'utf8')
assert.ok(gradle.includes("applicationId 'com.oldrefery.dutchlearningapp'"))
writeFileSync(
  gradlePath,
  gradle.replace(
    "applicationId 'com.oldrefery.dutchlearningapp'",
    "applicationId 'com.oldrefery.dutchlearningapp.d10upgrade'"
  )
)
const xmlPath = join(app, 'android/app/src/main/AndroidManifest.xml')
let xml = readFileSync(xmlPath, 'utf8')
xml = xml.replace(
  'android.permission.INTERNET"/',
  'android.permission.INTERNET" tools:node="remove"/'
)
xml = xml.replace(
  'android:name=".MainApplication"',
  'android:name="com.oldrefery.dutchlearningapp.MainApplication"'
)
xml = xml.replace(
  'android:name=".MainActivity"',
  'android:name="com.oldrefery.dutchlearningapp.MainActivity"'
)
xml = xml.replace(
  /\s*<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g,
  match => (match.includes('android.intent.action.VIEW') ? '' : match)
)
writeFileSync(xmlPath, xml)
writeFileSync(
  join(root, 'source-hashes.json'),
  JSON.stringify(hashes, null, 2) + '\n'
)
console.log(
  JSON.stringify({
    root,
    applicationId: 'com.oldrefery.dutchlearningapp.d10upgrade',
    historicalFiles: hashes.length,
  })
)
