import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../../../..')
const APP_CONFIG_PATH = 'apps/mobile/app.base.json'
const PACKAGE_JSON_PATH = 'package.json'
const MOBILE_PACKAGE_JSON_PATH = 'apps/mobile/package.json'
const PACKAGE_LOCK_PATH = 'package-lock.json'
const PREPARE_SCRIPT_PATH = 'scripts/prepare-release.js'
const BUILD_SCRIPT_PATH = 'scripts/build-release.sh'
const SUBMIT_SCRIPT_PATH = 'scripts/submit-release.sh'
const VERIFY_EAS_IDENTITY_SCRIPT_PATH = 'scripts/verify-eas-identity.sh'
const CURRENT_VERSION = '1.13.0'
const CURRENT_BUILD_NUMBER = '78'

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8')

const run = (cwd: string, command: string, args: string[] = []) => {
  const env = { ...process.env }
  // Git hooks may export the parent repository's index and object paths.
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) delete env[key]
  }
  return spawnSync(command, args, { cwd, encoding: 'utf8', env })
}

const createFixture = (): string => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'dutch-release-'))
  mkdirSync(path.join(fixtureDir, 'scripts'))
  mkdirSync(path.join(fixtureDir, 'builds'))
  mkdirSync(path.join(fixtureDir, 'apps/mobile'), { recursive: true })

  for (const scriptName of [
    path.basename(PREPARE_SCRIPT_PATH),
    path.basename(BUILD_SCRIPT_PATH),
    path.basename(SUBMIT_SCRIPT_PATH),
    path.basename(VERIFY_EAS_IDENTITY_SCRIPT_PATH),
  ]) {
    const target = path.join(fixtureDir, 'scripts', scriptName)
    writeFileSync(target, readRepoFile(path.join('scripts', scriptName)))
    chmodSync(target, 0o755)
  }

  writeFileSync(
    path.join(fixtureDir, APP_CONFIG_PATH),
    `${JSON.stringify(
      {
        expo: {
          version: CURRENT_VERSION,
          runtimeVersion: { policy: 'fingerprint' },
          ios: {
            buildNumber: CURRENT_BUILD_NUMBER,
            bundleIdentifier: 'com.oldrefery.dutch-learning-app',
          },
          android: {
            versionCode: Number(CURRENT_BUILD_NUMBER),
            package: 'com.oldrefery.dutchlearningapp',
          },
        },
      },
      null,
      2
    )}\n`
  )
  writeFileSync(
    path.join(fixtureDir, PACKAGE_JSON_PATH),
    `${JSON.stringify({ name: 'fixture', version: CURRENT_VERSION }, null, 2)}\n`
  )
  writeFileSync(
    path.join(fixtureDir, MOBILE_PACKAGE_JSON_PATH),
    `${JSON.stringify(
      { name: '@woordenaar/mobile', version: CURRENT_VERSION },
      null,
      2
    )}\n`
  )
  writeFileSync(
    path.join(fixtureDir, PACKAGE_LOCK_PATH),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: CURRENT_VERSION,
        lockfileVersion: 3,
        packages: {
          '': { name: 'fixture', version: CURRENT_VERSION },
          'apps/mobile': {
            name: '@woordenaar/mobile',
            version: CURRENT_VERSION,
          },
        },
      },
      null,
      2
    )}\n`
  )
  writeFileSync(path.join(fixtureDir, '.gitignore'), 'builds/\n')

  run(fixtureDir, 'git', ['init'])
  run(fixtureDir, 'git', ['config', 'user.email', 'release-test@example.com'])
  run(fixtureDir, 'git', ['config', 'user.name', 'Release Test'])
  run(fixtureDir, 'git', ['add', '.'])
  run(fixtureDir, 'git', ['commit', '-m', 'test fixture'])

  return fixtureDir
}

describe('release scripts', () => {
  let fixtureDir: string | null = null

  afterEach(() => {
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true })
      fixtureDir = null
    }
  })

  it('keeps build, submit, version mutation, and Git ownership separate', () => {
    const prepareScript = readRepoFile(PREPARE_SCRIPT_PATH)
    const buildScript = readRepoFile(BUILD_SCRIPT_PATH)
    const submitScript = readRepoFile(SUBMIT_SCRIPT_PATH)

    expect(prepareScript).not.toMatch(/git (add|commit|push)/)
    expect(buildScript).not.toContain('EAS_SKIP_AUTO_FINGERPRINT')
    expect(buildScript).not.toMatch(/eas-cli@latest submit/)
    expect(buildScript).not.toMatch(/git (add|commit|push)/)
    expect(submitScript).not.toMatch(/eas-cli@latest build/)
    expect(submitScript).toContain('--path "$REPO_ROOT/$artifact"')
  })

  it('shows help and performs version preparation as a dry run by default', () => {
    fixtureDir = createFixture()
    const originalAppConfig = readFileSync(
      path.join(fixtureDir, APP_CONFIG_PATH),
      'utf8'
    )

    const help = run(fixtureDir, 'node', [PREPARE_SCRIPT_PATH, '--help'])
    const dryRun = run(fixtureDir, 'node', [
      PREPARE_SCRIPT_PATH,
      '--version',
      '2.0.0',
      '--build',
      '79',
    ])

    expect(help.status).toBe(0)
    expect(help.stdout).toContain('Without --apply')
    expect(dryRun.status).toBe(0)
    expect(dryRun.stdout).toContain('Dry run only')
    expect(readFileSync(path.join(fixtureDir, APP_CONFIG_PATH), 'utf8')).toBe(
      originalAppConfig
    )
  })

  it('updates all version sources without committing', () => {
    fixtureDir = createFixture()

    const result = run(fixtureDir, 'node', [
      PREPARE_SCRIPT_PATH,
      '--version',
      '2.0.0',
      '--build',
      '79',
      '--apply',
    ])
    const appConfig = JSON.parse(
      readFileSync(path.join(fixtureDir, APP_CONFIG_PATH), 'utf8')
    )
    const packageJson = JSON.parse(
      readFileSync(path.join(fixtureDir, PACKAGE_JSON_PATH), 'utf8')
    )
    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(fixtureDir, MOBILE_PACKAGE_JSON_PATH), 'utf8')
    )
    const packageLock = JSON.parse(
      readFileSync(path.join(fixtureDir, PACKAGE_LOCK_PATH), 'utf8')
    )

    expect(result.status).toBe(0)
    expect(appConfig.expo.version).toBe('2.0.0')
    expect(appConfig.expo.ios.buildNumber).toBe('79')
    expect(appConfig.expo.android.versionCode).toBe(79)
    expect(packageJson.version).toBe('2.0.0')
    expect(mobilePackageJson.version).toBe('2.0.0')
    expect(packageLock.version).toBe('2.0.0')
    expect(packageLock.packages[''].version).toBe('2.0.0')
    expect(packageLock.packages['apps/mobile'].version).toBe('2.0.0')
    expect(run(fixtureDir, 'git', ['log', '--oneline']).stdout).toContain(
      'test fixture'
    )
    expect(run(fixtureDir, 'git', ['log', '--oneline']).stdout).not.toContain(
      '2.0.0'
    )
  })

  it('rejects invalid versions and reused build numbers before mutation', () => {
    fixtureDir = createFixture()

    const invalidVersion = run(fixtureDir, 'node', [
      PREPARE_SCRIPT_PATH,
      '--version',
      '1.14',
      '--build',
      '79',
    ])
    const reusedBuild = run(fixtureDir, 'node', [
      PREPARE_SCRIPT_PATH,
      '--version',
      '2.0.0',
      '--build',
      CURRENT_BUILD_NUMBER,
    ])

    expect(invalidVersion.status).toBe(1)
    expect(invalidVersion.stderr).toContain('version must use X.Y.Z format')
    expect(reusedBuild.status).toBe(1)
    expect(reusedBuild.stderr).toContain(
      'target build 78 must be greater than current 78'
    )
  })

  it('refuses dirty worktrees and mismatched version sources', () => {
    fixtureDir = createFixture()
    writeFileSync(path.join(fixtureDir, 'dirty.txt'), 'dirty\n')

    const dirtyResult = run(fixtureDir, 'node', [
      PREPARE_SCRIPT_PATH,
      '--check',
      '--require-clean',
    ])
    expect(dirtyResult.status).toBe(1)
    expect(dirtyResult.stderr).toContain('Git worktree must be clean')

    rmSync(path.join(fixtureDir, 'dirty.txt'))
    const packageJsonPath = path.join(fixtureDir, PACKAGE_JSON_PATH)
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    packageJson.version = '1.12.9'
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

    const mismatchResult = run(fixtureDir, 'node', [
      PREPARE_SCRIPT_PATH,
      '--check',
    ])
    expect(mismatchResult.status).toBe(1)
    expect(mismatchResult.stderr).toContain('version sources disagree')
  })

  it('validates a build dry run without creating artifacts or submitting', () => {
    fixtureDir = createFixture()

    const result = run(fixtureDir, 'bash', [
      BUILD_SCRIPT_PATH,
      '--platform',
      'both',
      '--confirmed-build-number',
      CURRENT_BUILD_NUMBER,
      '--dry-run',
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('eas-cli@latest build --platform ios')
    expect(result.stdout).toContain('eas-cli@latest build --platform android')
    expect(result.stdout).toContain(
      'no directory, artifact, upload, or submission'
    )
    expect(result.stdout).not.toContain('eas-cli@latest submit')
  })

  it('submits only exact build-context artifacts in dry-run mode', () => {
    fixtureDir = createFixture()
    const commitSha = run(fixtureDir, 'git', [
      'rev-parse',
      'HEAD',
    ]).stdout.trim()
    const iosArtifact = 'builds/app-1.13.0-78.ipa'
    const androidArtifact = 'builds/app-1.13.0-78.aab'

    writeFileSync(path.join(fixtureDir, iosArtifact), 'ios artifact')
    writeFileSync(path.join(fixtureDir, androidArtifact), 'android artifact')
    writeFileSync(
      path.join(fixtureDir, 'builds/build-context.json'),
      `${JSON.stringify(
        {
          version: CURRENT_VERSION,
          iosBuildNumber: CURRENT_BUILD_NUMBER,
          androidBuildNumber: CURRENT_BUILD_NUMBER,
          commitSha,
          built: { ios: true, android: true },
          artifacts: { ios: iosArtifact, android: androidArtifact },
        },
        null,
        2
      )}\n`
    )

    const result = run(fixtureDir, 'bash', [
      SUBMIT_SCRIPT_PATH,
      '--platform',
      'both',
      '--dry-run',
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      `submit --platform ios --profile production --path ${iosArtifact}`
    )
    expect(result.stdout).toContain(
      `submit --platform android --profile production --path ${androidArtifact}`
    )
    expect(result.stdout).toContain('no artifact was submitted')
  })
})
