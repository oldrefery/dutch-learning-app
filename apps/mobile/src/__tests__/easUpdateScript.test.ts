import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../../../..')

describe('production OTA safety', () => {
  let fixture: string

  beforeEach(() => {
    fixture = realpathSync(mkdtempSync(path.join(tmpdir(), 'woordenaar-ota-')))
    for (const directory of ['scripts', 'bin', 'apps/mobile']) {
      mkdirSync(path.join(fixture, directory), { recursive: true })
    }
    for (const name of ['eas-update-production.sh', 'verify-eas-identity.sh']) {
      copyFileSync(
        path.join(repoRoot, 'scripts', name),
        path.join(fixture, 'scripts', name)
      )
    }
    writeFileSync(path.join(fixture, 'calls'), '')
    writeFileSync(
      path.join(fixture, 'bin/npx'),
      `#!/bin/bash
set -eu
echo "$PWD | $*" >> "$OTA_FIXTURE/calls"
case "$3" in
  account:view)
    printf '%s\\n' "$OTA_ACCOUNT"
    exit "\${OTA_ACCOUNT_EXIT:-0}"
    ;;
  project:info)
    printf 'fullName %s\\n' "$OTA_PROJECT"
    exit "\${OTA_PROJECT_EXIT:-0}"
    ;;
  update) exit "\${OTA_UPDATE_EXIT:-0}" ;;
  *) exit 99 ;;
esac
`,
      { mode: 0o755 }
    )
    writeFileSync(
      path.join(fixture, 'scripts/upload-sourcemaps.sh'),
      `#!/bin/bash
echo "$PWD | upload $*" >> "$OTA_FIXTURE/calls"
exit "\${OTA_UPLOAD_EXIT:-0}"
`
    )
  })

  afterEach(() => rmSync(fixture, { recursive: true, force: true }))

  const run = (
    args: string[] = [],
    overrides: Record<string, string | undefined> = {}
  ) => {
    // Deliberately inherit neither real EAS credentials nor Git hook state.
    const result = spawnSync(
      'bash',
      ['../../scripts/eas-update-production.sh', ...args],
      {
        cwd: path.join(fixture, 'apps/mobile'),
        encoding: 'utf8',
        env: {
          NODE_ENV: 'test',
          PATH: `${fixture}/bin:/usr/bin:/bin`,
          OTA_FIXTURE: fixture,
          OTA_ACCOUNT: 'oldrefery',
          OTA_PROJECT: '@oldrefery/dutch-learning-app',
          ...overrides,
        },
      }
    )
    return {
      ...result,
      calls: readFileSync(path.join(fixture, 'calls'), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean),
    }
  }

  it.each(['oldrefery', 'oldrefery (authenticated using EXPO_TOKEN)'])(
    'verifies %s before publishing and uploading the exact dist',
    account => {
      const result = run(
        ['--message', 'Session and sync fixes', '--non-interactive'],
        { OTA_ACCOUNT: account }
      )
      expect(result.status).toBe(0)
      expect(result.calls).toEqual([
        `${fixture}/apps/mobile | -y eas-cli@latest account:view`,
        `${fixture}/apps/mobile | -y eas-cli@latest project:info`,
        `${fixture}/apps/mobile | -y eas-cli@latest update --channel production --environment production --message Session and sync fixes --non-interactive`,
        `${fixture} | upload --update-dist apps/mobile/dist`,
      ])
    }
  )

  it('supports invocation without optional arguments', () => {
    expect(run().status).toBe(0)
  })

  it.each([
    'guardia',
    'guardia\noldrefery',
    'Not logged in',
    '',
    'Robot (authenticated using EXPO_TOKEN)',
  ])('stops before project lookup for an unsafe identity: %s', account => {
    const result = run([], { OTA_ACCOUNT: account })
    expect(result.status).toBe(1)
    expect(result.calls).toHaveLength(1)
  })

  it.each([
    { OTA_ACCOUNT_EXIT: '1' },
    { OTA_PROJECT: '@guardia/dutch-learning-app' },
    { OTA_PROJECT: '@oldrefery/another-app' },
    { OTA_PROJECT_EXIT: '1' },
  ])('never publishes if verification fails: %j', overrides => {
    const result = run([], overrides)
    expect(result.status).toBe(1)
    expect(result.calls.join('\n')).not.toContain(' update ')
    expect(result.calls.join('\n')).not.toContain('upload ')
  })

  it.each([
    '--channel',
    '--branch=preview',
    '--environment',
    '--output-dir',
    '--skip-bundler',
    '--message',
  ])(
    'rejects unsafe or incomplete options before contacting EAS: %s',
    option => {
      const result = run([option])
      expect(result.status).toBe(1)
      expect(result.calls).toEqual([])
    }
  )

  it('provides help without contacting EAS', () => {
    const result = run(['--help'])
    expect(result.status).toBe(0)
    expect(result.calls).toEqual([])
    expect(result.stdout).toContain('Usage:')
  })

  it.each([
    ['--message', '--branch=preview'],
    ['--platform', '--channel=preview'],
    ['--platform', 'both'],
    ['--message', ''],
  ])('rejects an invalid option value: %j', (option, value) => {
    const result = run([option, value])
    expect(result.status).toBe(1)
    expect(result.calls).toEqual([])
  })

  it('does not upload stale maps when publication fails', () => {
    const result = run([], { OTA_UPDATE_EXIT: '9' })
    expect(result.status).toBe(9)
    expect(result.calls).toHaveLength(3)
  })

  it('reports partial success without republishing when map upload fails', () => {
    const result = run([], { OTA_UPLOAD_EXIT: '1' })
    expect(result.status).toBe(1)
    expect(result.calls).toHaveLength(4)
    expect(result.stderr).toContain('Do not republish')
    expect(result.stderr).toContain('npm run sourcemaps:update')
  })
})
