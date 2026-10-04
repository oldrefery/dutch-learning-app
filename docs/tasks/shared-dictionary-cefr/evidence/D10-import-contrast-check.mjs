import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { homedir } from 'node:os'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const outputRoot = join(
  root,
  'reports/shared-dictionary-cefr/d10-r4-repair-20261002'
)
const phase = process.argv[2]
assert(['baseline', 'repaired'].includes(phase))
const script = readFileSync(
  new URL('./D10-import-contrast-browser.js', import.meta.url),
  'utf8'
)
const wrapper = join(
  homedir(),
  '.codex/skills/playwright/scripts/playwright_cli.sh'
)
const output = execFileSync(
  'bash',
  [wrapper, '--session', 'd10-r4-contrast', 'run-code', script],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
)
writeFileSync(join(outputRoot, `${phase}-contrast.log`), output)
const serialized = output.split('### Result\n')[1]?.split('### Ran')[0].trim()
assert(serialized, 'Browser matrix did not return measurements')
const result = JSON.parse(serialized)
writeFileSync(
  join(outputRoot, `${phase}-contrast.json`),
  JSON.stringify(result, null, 2)
)
assert.equal(result.rows.length, 40)
assert.equal(result.scenarioCount, 16)
console.log(
  JSON.stringify({
    phase,
    rows: result.rows.length,
    scenarios: result.scenarioCount,
    allPassed: result.allPassed,
  })
)
if (phase === 'repaired') assert(result.allPassed)
else
  assert(result.rows.some(row => row.theme === 'light' && row.contrast === 1))
