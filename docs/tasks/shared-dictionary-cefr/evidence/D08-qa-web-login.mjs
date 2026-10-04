import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { assertQaFixture } from './D08-qa-paths.mjs'

const fixturePath = assertQaFixture(process.argv[2])
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
assert.equal(fixture.apiUrl, 'http://127.0.0.1:55321')
assert.match(fixture.primary.email, /^d08-primary-[0-9a-f-]+@example\.invalid$/)
const refs = process.argv.slice(3)
assert.equal(refs.length, 3)
refs.forEach(ref => assert.match(ref, /^(?:f\d+)?e\d+$/))
const cli = args => {
  const result = execFileSync(
    'bash',
    [
      '/Users/devrush/.codex/skills/playwright/scripts/playwright_cli.sh',
      ...args,
    ],
    {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH}`,
        PLAYWRIGHT_CLI_SESSION: 'd08-content-qa',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  console.log(
    result
      .replaceAll(fixture.primary.email, '[synthetic credential]')
      .replaceAll(fixture.primary.password, '[synthetic credential]')
  )
}
cli(['fill', refs[0], fixture.primary.email])
cli(['fill', refs[1], fixture.primary.password])
cli(['click', refs[2]])
