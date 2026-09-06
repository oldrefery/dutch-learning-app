import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const environment = { PATH: process.env.PATH, LC_ALL: 'C', TZ: 'UTC' }
const binary = name =>
  process.env.WOORDENAAR_PG_BIN
    ? join(process.env.WOORDENAAR_PG_BIN, name)
    : name

function command(name, args) {
  const result = spawnSync(binary(name), args, {
    env: environment,
    encoding: 'utf8',
  })
  if (result.error || result.status !== 0) {
    throw new Error(`${name} failed: ${result.error?.message ?? result.stderr}`)
  }
  return result.stdout
}

// No connection string, ambient PG* variables, credentials or existing cluster.
export async function createCluster({ throughMigration } = {}) {
  command('initdb', ['--version'])
  // macOS TMPDIR is too long for PostgreSQL's Unix socket path limit.
  const directory = await mkdtemp(
    join(
      process.platform === 'darwin' ? '/tmp' : tmpdir(),
      'woordenaar-pg-test-'
    )
  )
  const data = join(directory, 'data')
  let startAttempted = false
  const args = [
    '-X',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    'VERBOSITY=verbose',
    '-h',
    directory,
    '-p',
    '5432',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ]

  function connect() {
    const child = spawn(binary('psql'), args, { env: environment })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    const completed = new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('close', code =>
        code === 0
          ? resolve(stdout.trim())
          : reject(new Error(stderr || `psql exited ${code}`))
      )
    })
    // A query can fail while a concurrency test is observing a lock.
    void completed.catch(() => {})
    return { child, completed, output: () => stdout }
  }

  async function sql(text) {
    const connection = connect()
    connection.child.stdin.end(`SET statement_timeout = '10s';\n${text}\n`)
    return connection.completed
  }

  async function close() {
    if (startAttempted) {
      const status = spawnSync(binary('pg_ctl'), ['-D', data, 'status'], {
        env: environment,
      })
      if (status.status === 0) {
        command('pg_ctl', ['-D', data, '-m', 'fast', '-t', '10', '-w', 'stop'])
      } else if (status.status !== 3) {
        throw new Error(
          `Could not confirm the test server stopped; retained ${directory}`
        )
      }
      startAttempted = false
    }
    // Only the private mkdtemp directory created by this invocation is removed.
    await rm(directory, { recursive: true, force: true })
  }

  try {
    command('initdb', [
      '-D',
      data,
      '-A',
      'trust',
      '-U',
      'postgres',
      '--no-locale',
      '--encoding=UTF8',
    ])
    startAttempted = true
    command('pg_ctl', [
      '-D',
      data,
      '-l',
      join(directory, 'postgres.log'),
      '-w',
      '-t',
      '10',
      'start',
      '-o',
      `-F -c listen_addresses='' -c unix_socket_directories='${directory}'`,
    ])
    await sql(
      await readFile(new URL('./platform.sql', import.meta.url), 'utf8')
    )
    const migrations = join(repository, 'supabase/migrations')
    for (const name of (await readdir(migrations))
      .filter(
        name =>
          name.endsWith('.sql') &&
          (!throughMigration || name <= throughMigration)
      )
      .sort()) {
      try {
        await sql(await readFile(join(migrations, name), 'utf8'))
      } catch (error) {
        throw new Error(`Migration ${name} failed`, { cause: error })
      }
    }
    await sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.collections, public.words TO authenticated;
      GRANT SELECT ON public.user_access_levels TO authenticated;`)
    return { sql, connect, close }
  } catch (error) {
    await close()
    throw error
  }
}
