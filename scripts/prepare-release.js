#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(path.dirname(process.argv[1]), '..')
const mobileDir = path.join(rootDir, 'apps/mobile')
const appConfigPath = ['app.json', 'app.base.json']
  .map(file => path.join(mobileDir, file))
  .find(file => fs.existsSync(file))
const packageJsonPath = path.join(rootDir, 'package.json')
const mobilePackageJsonPath = path.join(mobileDir, 'package.json')
const packageLockPath = path.join(rootDir, 'package-lock.json')

function printHelp() {
  console.log(`Usage:
  node scripts/prepare-release.js --check [--require-clean]
  node scripts/prepare-release.js --version X.Y.Z --build N [--apply]

Options:
  --check          Validate current version alignment without changing files.
  --require-clean  Refuse a dirty Git worktree (always enabled with --apply).
  --version        Target marketing version in X.Y.Z format.
  --build          Target iOS build number and Android version code.
  --apply          Write the validated version to all three version sources.
  --help           Show this help.

Without --apply, version preparation is a dry run.`)
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const options = {
    apply: false,
    check: false,
    help: false,
    requireClean: false,
    version: null,
    build: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') options.apply = true
    else if (arg === '--check') options.check = true
    else if (arg === '--help') options.help = true
    else if (arg === '--require-clean') options.requireClean = true
    else if (arg === '--version' || arg === '--build') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`${arg} requires a value`)
      if (arg === '--version') options.version = value
      else options.build = value
      index += 1
    } else {
      fail(`unknown option: ${arg}`)
    }
  }

  return options
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) {
    fail(`required file not found: ${file || 'app.json or app.base.json'}`)
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`cannot parse ${path.basename(file)}: ${error.message}`)
  }
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`version must use X.Y.Z format, received: ${version}`)
  }
}

function validateBuild(build) {
  if (!/^\d+$/.test(String(build)) || Number(build) < 1) {
    fail(`build must be a positive integer, received: ${build}`)
  }
}

function assertCleanWorktree() {
  const result = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: rootDir, encoding: 'utf8' }
  )

  if (result.status !== 0) {
    fail('cannot inspect Git worktree')
  }
  if (result.stdout.trim()) {
    fail('Git worktree must be clean before release preparation or build')
  }
}

function loadReleaseState() {
  const appConfig = readJson(appConfigPath)
  const packageJson = readJson(packageJsonPath)
  const mobilePackageJson = readJson(mobilePackageJsonPath)
  const packageLock = readJson(packageLockPath)
  const versions = {
    app: appConfig.expo?.version,
    rootPackage: packageJson.version,
    mobilePackage: mobilePackageJson.version,
    lock: packageLock.version,
    lockRoot: packageLock.packages?.['']?.version,
    lockMobile: packageLock.packages?.['apps/mobile']?.version,
  }
  const iosBuild = appConfig.expo?.ios?.buildNumber
  const androidBuild = appConfig.expo?.android?.versionCode

  for (const [source, version] of Object.entries(versions)) {
    if (typeof version !== 'string') fail(`missing version in ${source}`)
    validateVersion(version)
  }
  if (new Set(Object.values(versions)).size !== 1) {
    fail(`version sources disagree: ${JSON.stringify(versions)}`)
  }

  validateBuild(iosBuild)
  validateBuild(androidBuild)
  if (Number(iosBuild) !== Number(androidBuild)) {
    fail(
      `native build numbers disagree: iOS ${iosBuild}, Android ${androidBuild}`
    )
  }

  return {
    appConfig,
    packageJson,
    mobilePackageJson,
    packageLock,
    version: versions.app,
    build: Number(iosBuild),
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  printHelp()
  process.exit(0)
}

if (options.apply || options.requireClean) assertCleanWorktree()
const state = loadReleaseState()

if (options.check) {
  if (options.version || options.build || options.apply) {
    fail('--check cannot be combined with version mutation options')
  }
  console.log(`Version alignment is valid: ${state.version} (${state.build})`)
  process.exit(0)
}

if (!options.version || !options.build) {
  printHelp()
  fail('--version and --build are required together')
}

validateVersion(options.version)
validateBuild(options.build)
const targetBuild = Number(options.build)
if (targetBuild <= state.build) {
  fail(
    `target build ${targetBuild} must be greater than current ${state.build}`
  )
}

console.log(
  `Release preparation: ${state.version} (${state.build}) -> ${options.version} (${targetBuild})`
)

if (!options.apply) {
  console.log('Dry run only; pass --apply to update version files.')
  process.exit(0)
}

state.appConfig.expo.version = options.version
state.appConfig.expo.ios.buildNumber = String(targetBuild)
state.appConfig.expo.android.versionCode = targetBuild
state.packageJson.version = options.version
state.mobilePackageJson.version = options.version
state.packageLock.version = options.version
state.packageLock.packages[''].version = options.version
state.packageLock.packages['apps/mobile'].version = options.version

writeJson(appConfigPath, state.appConfig)
writeJson(packageJsonPath, state.packageJson)
writeJson(mobilePackageJsonPath, state.mobilePackageJson)
writeJson(packageLockPath, state.packageLock)

console.log(
  'Updated app config, root/mobile package manifests, and package-lock.json.'
)
console.log('No Git commit, build, upload, or submission was performed.')
