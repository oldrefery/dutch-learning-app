import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(
  repository,
  'packages/supabase-contracts/target-schema.json'
)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const artifactPath = resolve(
  repository,
  'packages/supabase-contracts',
  manifest.artifact
)
const migrationsPath = resolve(repository, 'supabase/migrations')
const checkOnly = process.argv.includes('--check')
const migrations = (await readdir(migrationsPath))
  .filter(name => name.endsWith('.sql'))
  .sort()
if (migrations.at(-1) !== manifest.migrationHead) {
  throw new Error('Target manifest must name the latest repository migration')
}

const run = (command, args, { input } = {}) => {
  const result = spawnSync(command, args, {
    cwd: repository,
    encoding: 'utf8',
    env: process.env,
    input,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  })
  if (result.error || result.status !== 0) {
    const details = [result.stderr?.trim(), result.stdout?.trim()]
      .filter(Boolean)
      .join('\n')
    throw new Error(`${command} failed: ${result.error?.message ?? details}`)
  }
  return result.stdout.trim()
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const container = `woordenaar-types-postgres-${suffix}`
const generator = `woordenaar-types-meta-${suffix}`
const network = `woordenaar-types-${suffix}`
const password = randomUUID().replaceAll('-', '')
const createdContainers = []
let networkCreated = false

try {
  run('docker', ['network', 'create', '--internal', network])
  networkCreated = true
  run('docker', [
    'create',
    '--name',
    container,
    '--network',
    network,
    '--tmpfs',
    '/var/lib/postgresql/data',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    'POSTGRES_DB=postgres',
    manifest.postgresImage,
  ])
  createdContainers.push(container)
  run('docker', ['start', container])

  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        container,
        'pg_isready',
        '--host',
        '127.0.0.1',
        '--username',
        'postgres',
        '--dbname',
        'postgres',
      ],
      { cwd: repository, encoding: 'utf8', env: process.env, timeout: 10_000 }
    )
    if (result.status === 0) {
      ready = true
      break
    }
    await setTimeout(250)
  }
  if (!ready) {
    throw new Error('Disposable target-schema PostgreSQL did not become ready')
  }

  const applySql = sql =>
    run(
      'docker',
      [
        'exec',
        '--interactive',
        container,
        'psql',
        '--quiet',
        '--set',
        'ON_ERROR_STOP=1',
        '--host',
        '127.0.0.1',
        '--username',
        'postgres',
        '--dbname',
        'postgres',
      ],
      { input: `SET statement_timeout = '30s';\n${sql}\n` }
    )

  applySql(
    await readFile(
      resolve(repository, 'scripts/postgres-tests/platform.sql'),
      'utf8'
    )
  )
  for (const name of migrations) {
    applySql(await readFile(join(migrationsPath, name), 'utf8'))
  }

  // Use the CLI's official introspection engine directly: both containers share
  // a task-owned internal network, with no host/LAN port or hosted credentials.
  run('docker', [
    'create',
    '--name',
    generator,
    '--network',
    network,
    '--env',
    `PG_META_DB_HOST=${container}`,
    '--env',
    `PG_META_DB_PASSWORD=${password}`,
    '--env',
    'PG_META_GENERATE_TYPES=typescript',
    '--env',
    `PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=${manifest.schemas.join(',')}`,
    '--env',
    'PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true',
    manifest.generatorImage,
  ])
  createdContainers.push(generator)
  const generated = run('docker', ['start', '--attach', generator])
  const generatorExit = run('docker', [
    'inspect',
    '--format',
    '{{.State.ExitCode}}',
    generator,
  ])
  if (generatorExit !== '0' || !generated.includes('export type Database')) {
    throw new Error('Disposable Postgres Meta type generation failed')
  }
  const header = `// Generated from local migrations through ${manifest.migrationHead}.\n// Supabase Postgres Meta ${manifest.generatorVersion}; source and options: target-schema.json.\n`
  const expected = `${run(
    npx,
    [
      '--yes',
      `prettier@${manifest.formatterVersion}`,
      '--stdin-filepath',
      artifactPath,
    ],
    { input: `${header}${generated}\n` }
  )}\n`

  if (checkOnly) {
    const existing = await readFile(artifactPath, 'utf8').catch(() => '')
    if (existing !== expected) {
      throw new Error(
        'Target Supabase contract is stale. Run npm run supabase-contracts:target:generate.'
      )
    }
  } else {
    await writeFile(artifactPath, expected)
  }
} finally {
  const cleanupErrors = []
  for (const name of createdContainers.reverse()) {
    try {
      run('docker', ['rm', '--force', '--volumes', name])
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (networkCreated) {
    try {
      run('docker', ['network', 'rm', network])
    } catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (cleanupErrors.length) {
    throw new AggregateError(
      cleanupErrors,
      'Disposable type-generation cleanup failed'
    )
  }
}
