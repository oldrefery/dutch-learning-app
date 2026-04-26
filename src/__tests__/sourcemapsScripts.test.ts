import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const repoRoot = process.cwd()
const UPLOAD_SCRIPT_PATH = 'scripts/upload-sourcemaps.sh'

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8')

const createSourcemapScriptFixture = (): string => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'dutch-sourcemaps-'))
  mkdirSync(path.join(fixtureDir, 'scripts'))

  for (const scriptName of [
    'upload-sourcemaps.sh',
    'build-and-submit.sh',
    'eas-update-production.sh',
  ]) {
    writeFileSync(
      path.join(fixtureDir, 'scripts', scriptName),
      readRepoFile(path.join('scripts', scriptName))
    )
  }

  writeFileSync(
    path.join(fixtureDir, '.sentryclirc'),
    '[auth]\ntoken=test-token\n'
  )
  writeFileSync(
    path.join(fixtureDir, 'app.base.json'),
    `${JSON.stringify(
      {
        expo: {
          version: '1.12.1',
          ios: {
            buildNumber: '76',
            bundleIdentifier: 'com.oldrefery.dutch-learning-app',
          },
          android: {
            versionCode: 76,
            package: 'com.oldrefery.dutchlearningapp',
          },
        },
      },
      null,
      2
    )}\n`
  )

  return fixtureDir
}

describe('Sentry sourcemap scripts', () => {
  let fixtureDir: string | null = null

  afterEach(() => {
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true })
      fixtureDir = null
    }
  })

  it('documents EAS Update sourcemap upload without requiring network access', () => {
    fixtureDir = createSourcemapScriptFixture()

    const result = spawnSync('bash', [UPLOAD_SCRIPT_PATH, '--help'], {
      cwd: fixtureDir,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('--update-dist DIR')
    expect(result.stdout).toContain('Upload EAS Update sourcemaps from dist')
  })

  it('fails fast for a missing EAS Update dist directory before Sentry validation', () => {
    fixtureDir = createSourcemapScriptFixture()

    const result = spawnSync(
      'bash',
      [UPLOAD_SCRIPT_PATH, '--update-dist', 'missing-dist'],
      {
        cwd: fixtureDir,
        encoding: 'utf8',
      }
    )

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(
      'Error: EAS Update dist directory not found: missing-dist'
    )
    expect(result.stdout).not.toContain('Validating Sentry token')
  })

  it('keeps native sourcemap uploads aligned with release, dist, and app URL prefix', () => {
    const uploadScript = readRepoFile(UPLOAD_SCRIPT_PATH)
    const buildScript = readRepoFile('scripts/build-and-submit.sh')
    const easConfig = JSON.parse(readRepoFile('eas.json')) as {
      build: { production: { environment?: string } }
    }

    expect(uploadScript).toContain(
      'SENTRY_URL="${SENTRY_URL:-https://us.sentry.io/}"'
    )
    expect(uploadScript).toContain(
      'release_name="${bundle_id}@${VERSION}+${build_number}"'
    )
    expect(uploadScript).toContain('--release "$release_name"')
    expect(uploadScript).toContain('--dist "$build_number"')
    expect(uploadScript).toContain('--url-prefix "app:///"')
    expect(uploadScript).toContain(
      'SENTRY_DISABLE_AUTO_UPLOAD=true NODE_ENV=production npx expo export:embed'
    )
    expect(buildScript).toContain(
      'export SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN_CLI"'
    )
    expect(buildScript).toContain(
      'SENTRY_ENFORCE_BUILD_CONTEXT=true scripts/upload-sourcemaps.sh --platform "$PLATFORM"'
    )
    expect(easConfig.build.production.environment).toBe('production')
  })

  it('publishes production EAS updates before uploading the generated dist sourcemaps', () => {
    const updateScript = readRepoFile('scripts/eas-update-production.sh')
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts: Record<string, string>
    }

    const updateCommandIndex = updateScript.indexOf(
      'npx -y eas-cli@latest update --channel production --environment production "$@"'
    )
    const uploadCommandIndex = updateScript.indexOf(
      'scripts/upload-sourcemaps.sh --update-dist dist'
    )

    expect(updateCommandIndex).toBeGreaterThanOrEqual(0)
    expect(uploadCommandIndex).toBeGreaterThan(updateCommandIndex)
    expect(packageJson.scripts['update:production']).toBe(
      'bash scripts/eas-update-production.sh'
    )
    expect(packageJson.scripts['sourcemaps:update']).toBe(
      'bash scripts/upload-sourcemaps.sh --update-dist dist'
    )
  })
})
