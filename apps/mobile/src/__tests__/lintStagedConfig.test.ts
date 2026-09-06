import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../../../..')

describe('CI warning budget', () => {
  it.each([
    [0, 'const ready = true\n'],
    [1, '// TODO: regression fixture\nconst ready = true\n'],
  ] as const)(
    'returns exit status %i for the warning fixture',
    (status, source) => {
      const manifest = JSON.parse(
        readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
      ) as { scripts: Record<string, string> }
      const command = manifest.scripts['lint:ci'].split(' ')
      expect(command.slice(0, 4)).toEqual(['npm', 'run', 'lint', '--'])
      const result = spawnSync(
        process.execPath,
        [
          path.join(repoRoot, 'node_modules/eslint/bin/eslint.js'),
          ...command.slice(4),
          '--no-config-lookup',
          '--stdin',
          '--stdin-filename',
          'warning-budget.js',
          '--rule',
          'no-warning-comments:warn',
        ],
        { cwd: repoRoot, input: source, encoding: 'utf8', timeout: 15_000 }
      )
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(status)
      if (status === 1) expect(result.stdout).toContain('no-warning-comments')
    }
  )
})

describe('workspace-aware staged linting', () => {
  it.each([
    ['apps/web/src/proxy.ts', true],
    ['apps/mobile/src/services/syncManager.ts', false],
  ] as const)(
    'selects the correct framework config from the root for %s',
    (file, isWeb) => {
      const manifest = JSON.parse(
        readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
      ) as {
        'lint-staged': Record<string, string[]>
      }
      const command = manifest['lint-staged']['*.{ts,tsx,js,jsx}'].find(value =>
        value.startsWith('eslint ')
      )
      if (!command) throw new Error('Missing staged ESLint command')
      const args = command
        .split(' ')
        .slice(1)
        .filter(argument => argument !== '--fix')
      const result = spawnSync(
        process.execPath,
        [
          path.join(repoRoot, 'node_modules/eslint/bin/eslint.js'),
          ...args,
          '--print-config',
          path.join(repoRoot, file),
        ],
        { cwd: repoRoot, encoding: 'utf8', timeout: 15_000 }
      )
      expect(result.status).toBe(0)
      const config = JSON.parse(result.stdout) as {
        rules: Record<string, unknown>
        settings?: Record<string, unknown>
      }
      expect(Boolean(config.rules['@next/next/no-html-link-for-pages'])).toBe(
        isWeb
      )
      if (!isWeb) {
        expect(config.settings?.['import/resolver']).toEqual(
          expect.objectContaining({
            typescript: { project: ['apps/mobile/tsconfig.json'] },
          })
        )
      }
    }
  )
})
