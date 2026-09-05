import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../../../..')

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
