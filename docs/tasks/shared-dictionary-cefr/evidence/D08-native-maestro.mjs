import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { dirname } from 'node:path'
import { assertQaFixture, assertQaRoot } from './D08-qa-paths.mjs'

const fixturePath = realpathSync(process.argv[2])
const flowPath = realpathSync(process.argv[3])
const platform = process.argv[4]
const device = process.argv[5]
const outputRoot = realpathSync(process.argv[6])
const expectedContent = process.argv[7] ?? 'QA local version'
assert.match(expectedContent, /^QA [A-Za-z0-9 -]+$/)
const targetWord = process.argv[8] ?? 'balkon'
assert.ok(['balkon', 'tuin'].includes(targetWord))

assertQaFixture(fixturePath)
assert.match(
  flowPath,
  /\/docs\/tasks\/shared-dictionary-cefr\/evidence\/D(?:08|10)-native-[A-Za-z0-9-]+\.yaml$/
)
assertQaRoot(outputRoot, 'native')
assert.equal(outputRoot, dirname(fixturePath))
assert.ok(platform === 'ios' || platform === 'android')
assert.match(device, /^[A-Za-z0-9._:-]+$/)
assert.equal(
  device,
  platform === 'ios' ? 'DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F' : 'emulator-5584'
)

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
assert.match(fixture.primary.email, /^d08-primary-[0-9a-f-]+@example\.invalid$/)
assert.match(
  fixture.isolated.email,
  /^d08-isolated-[0-9a-f-]+@example\.invalid$/
)
assert.equal(typeof fixture.primary.password, 'string')
assert.equal(typeof fixture.isolated.password, 'string')
const appId =
  platform === 'ios'
    ? 'com.oldrefery.dutch-learning-app'
    : 'com.oldrefery.dutchlearningapp'
const runId = `${platform}-${Date.now()}`
const args = [
  'test',
  flowPath,
  '--device',
  device,
  '--no-reinstall-driver',
  '--no-ansi',
  '--format',
  'JUNIT',
  '--output',
  `${outputRoot}/${runId}.xml`,
  '--debug-output',
  `${outputRoot}/${runId}-debug`,
  '-e',
  `APP_ID=${appId}`,
  '-e',
  `D08_EXPECTED=${expectedContent}`,
  '-e',
  `D08_WORD=${targetWord}`,
  '-e',
  `D08_EMAIL=${fixture.primary.email}`,
  '-e',
  `D08_PASSWORD=${fixture.primary.password}`,
  '-e',
  `D08_PRIMARY_EMAIL=${fixture.primary.email}`,
  '-e',
  `D08_PRIMARY_PASSWORD=${fixture.primary.password}`,
  '-e',
  `D08_ISOLATED_EMAIL=${fixture.isolated.email}`,
  '-e',
  `D08_ISOLATED_PASSWORD=${fixture.isolated.password}`,
]
const child = spawn('maestro', args, {
  stdio: ['ignore', 'pipe', 'pipe'],
})
for (const stream of [child.stdout, child.stderr]) {
  createInterface({ input: stream }).on('line', line => {
    for (const value of [
      fixture.primary.email,
      fixture.primary.password,
      fixture.isolated.email,
      fixture.isolated.password,
    ]) {
      line = line.replaceAll(value, '[synthetic credential]')
    }
    console.log(line)
  })
}
child.on('error', error => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('close', code => {
  console.log(
    JSON.stringify({ platform, device, flow: flowPath, runId, code: code ?? 1 })
  )
  process.exitCode = code ?? 1
})
