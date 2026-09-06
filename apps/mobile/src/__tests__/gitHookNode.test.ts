import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(__dirname, '../../../..')
const required = readFileSync(path.join(root, '.nvmrc'), 'utf8').trim()
const NVM_SCRIPT = 'nvm/nvm.sh'
const HOOK_COMMAND = 'sh -e .husky/pre-commit'
let fixture: string

const write = (name: string, content: string) => {
  writeFileSync(path.join(fixture, name), content, { mode: 0o755 })
}
const runtime = (directory: string, version: string) => {
  write(
    `${directory}/node`,
    version === 'missing'
      ? '#!/bin/sh\nexit 127\n'
      : `#!/bin/sh\nprintf '%s\\n' '${version}'\n`
  )
}
const run = (command = '. .husky/node-env.sh && node --version') =>
  spawnSync('/bin/sh', ['-ec', command], {
    cwd: fixture,
    encoding: 'utf8',
    timeout: 5000,
    env: {
      NODE_ENV: 'test',
      PATH: `${fixture}/bin:/usr/bin:/bin`,
      HOME: fixture,
      NVM_DIR: `${fixture}/nvm`,
      QA_RUNTIME_BIN: `${fixture}/selected`,
    },
  })

beforeEach(() => {
  fixture = mkdtempSync(path.join(tmpdir(), 'woordenaar-hook-node-'))
  for (const name of ['.husky', 'bin', 'nvm', 'selected']) {
    mkdirSync(path.join(fixture, name))
  }
  for (const name of ['node-env.sh', 'pre-commit']) {
    write(
      `.husky/${name}`,
      readFileSync(path.join(root, '.husky', name), 'utf8')
    )
  }
  write('.nvmrc', `${required}\n`)
  // No real Git command, staging, commit, install, or lint command is executed.
  write('bin/git', '#!/bin/sh\necho feature/fixture\n')
  write('bin/npx', '#!/bin/sh\necho TOOLS_STARTED\nexit 77\n')
})
afterEach(() => rmSync(fixture, { recursive: true, force: true }))

it('keeps a matching runtime without loading nvm', () => {
  runtime('bin', `v${required}`)
  write(NVM_SCRIPT, 'echo UNEXPECTED_NVM_LOAD >&2\nexit 9\n')
  const result = run()
  expect(result.status).toBe(0)
  expect(result.stdout.trim()).toBe(`v${required}`)
  expect(result.stderr).toBe('')
})

it.each(['v20.19.5', 'missing'])(
  'selects the pinned runtime from a non-interactive shell with %s Node',
  version => {
    runtime('bin', version)
    runtime('selected', `v${required}`)
    write(
      NVM_SCRIPT,
      `
nvm() {
  [ "$1" = use ] && [ "$2" = --silent ] && [ "$3" = '${required}' ] || return 1
  export PATH="$QA_RUNTIME_BIN:$PATH"
}
`
    )
    const result = run()
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(`v${required}`)
    expect(result.stderr).toBe('')
  }
)

it.each(['v20.19.5', 'v24.0.0', 'missing'])(
  'blocks the actual pre-commit before tools when the runtime is %s',
  version => {
    runtime('bin', version)
    const result = run(HOOK_COMMAND)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`Node ${required} is required`)
    expect(result.stderr).toContain('nvm install && nvm use')
    expect(result.stdout).not.toContain('TOOLS_STARTED')
  }
)

it.each([0, 3])(
  'validates the actual runtime even when nvm returns %i without switching',
  status => {
    runtime('bin', 'v20.19.5')
    write(NVM_SCRIPT, `nvm() { return ${status}; }\n`)
    expect(run().status).toBe(1)
  }
)

it('starts tools only after validating the runtime', () => {
  runtime('bin', `v${required}`)
  const result = run(HOOK_COMMAND)
  expect(result.status).toBe(77)
  expect(result.stdout).toContain('TOOLS_STARTED')
})

it('rejects a missing version file before tools', () => {
  rmSync(path.join(fixture, '.nvmrc'))
  const result = run(HOOK_COMMAND)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('cannot read .nvmrc')
  expect(result.stdout).not.toContain('TOOLS_STARTED')
})
