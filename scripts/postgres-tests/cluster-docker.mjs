import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const environment = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LC_ALL: 'C',
  TZ: 'UTC',
}
const CLI = 'docker'
const POSTGRES = 'postgres'
const run = args => {
  const result = spawnSync(CLI, args, {
    env: environment,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error || result.status !== 0)
    throw new Error(
      `Docker test command failed: ${result.error?.message ?? result.stderr}`
    )
  return result.stdout.trim()
}

/** Explicit local-only fallback. Cached pinned image, no network/ports/hosted env.
 * Only this invocation's randomly named tmpfs container is ever removed. */
export async function createDockerCluster({ throughMigration } = {}) {
  const host = run([
    'context',
    'inspect',
    '--format',
    '{{.Endpoints.docker.Host}}',
  ])
  if (!host.startsWith('unix://'))
    throw new Error('PostgreSQL tests require a local Docker Unix socket')
  const command = args => run(['--host', host, ...args])
  const manifest = JSON.parse(
    await readFile(
      join(repository, 'packages/supabase-contracts/target-schema.json'),
      'utf8'
    )
  )
  command(['image', 'inspect', manifest.postgresImage]) // Fail closed, never pull.
  const container = `woordenaar-pg-test-${randomUUID()}`
  let created = false
  const connect = () => {
    const child = spawn(
      CLI,
      [
        '--host',
        host,
        'exec',
        '-i',
        container,
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        'VERBOSITY=verbose',
        '-h',
        '/var/run/postgresql',
        '-U',
        POSTGRES,
        '-d',
        POSTGRES,
      ],
      { env: environment }
    )
    let stdout = '',
      stderr = ''
    child.stdout.on('data', data => {
      stdout += data
    })
    child.stderr.on('data', data => {
      stderr += data
    })
    const completed = new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('close', code =>
        code === 0
          ? resolve(stdout.trim())
          : reject(new Error(stderr || `psql exited ${code}`))
      )
    })
    void completed.catch(() => {})
    return { child, completed, output: () => stdout }
  }
  const sql = text => {
    const connection = connect()
    connection.child.stdin.end(`SET statement_timeout='10s';\n${text}\n`)
    return connection.completed
  }
  const close = async () => {
    if (created) {
      command(['rm', '--force', '--volumes', container])
      created = false
    }
  }
  try {
    command([
      'create',
      '--name',
      container,
      '--network',
      'none',
      '--tmpfs',
      '/var/lib/postgresql/data',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      manifest.postgresImage,
      'postgres',
      '-c',
      'listen_addresses=',
    ])
    created = true
    command(['start', container])
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = spawnSync(
        CLI,
        [
          '--host',
          host,
          'exec',
          container,
          'sh',
          '-c',
          // The image initializes through a temporary server which also passes
          // pg_isready. Wait for PID 1 to become the final postgres process.
          'test "$(cat /proc/1/comm)" = postgres && exec pg_isready "$@"',
          'pg-is-ready',
          '-h',
          '/var/run/postgresql',
          '-U',
          POSTGRES,
        ],
        { env: environment, timeout: 1000 }
      )
      if (result.status === 0) {
        ready = true
        break
      }
      await setTimeout(100)
    }
    if (!ready)
      throw new Error('Disposable Docker PostgreSQL did not become ready')
    await sql(
      await readFile(new URL('./platform.sql', import.meta.url), 'utf8')
    )
    const directory = join(repository, 'supabase/migrations')
    for (const name of (await readdir(directory))
      .filter(
        name =>
          name.endsWith('.sql') &&
          (!throughMigration || name <= throughMigration)
      )
      .sort()) {
      try {
        await sql(await readFile(join(directory, name), 'utf8'))
      } catch (error) {
        throw new Error(`Migration ${name} failed`, { cause: error })
      }
    }
    await sql(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.users,public.collections,public.words TO authenticated;
      GRANT SELECT ON public.user_access_levels TO authenticated;`)
    return { sql, connect, close }
  } catch (error) {
    await close()
    throw error
  }
}
