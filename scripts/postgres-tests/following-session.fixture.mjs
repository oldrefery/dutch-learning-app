import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

export async function until(predicate) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await setTimeout(20)
  }
  throw new Error('Owned PostgreSQL session barrier was not reached')
}

export async function session(db) {
  const connection = db.connect()
  const name = `following-qa-${randomUUID()}`
  const write = text => connection.child.stdin.write(text + '\n')
  const mark = async text => {
    const marker = `BARRIER_${randomUUID()}`
    write(`${text}\n\\echo ${marker}`)
    await until(() => {
      if (connection.child.exitCode !== null)
        throw new Error('Owned session exited before its barrier')
      return connection.output().includes(marker)
    })
  }
  write(`SET application_name='${name}'; SET statement_timeout='10s';
    SET idle_in_transaction_session_timeout='15s'; SET idle_session_timeout='15s';
    SELECT pg_backend_pid() AS owned_pid \\gset
    \\echo OWNED_PID :owned_pid`)
  await until(() => /OWNED_PID \d+/.test(connection.output()))
  const pid = Number(connection.output().match(/OWNED_PID (\d+)/)[1])
  assert.ok(Number.isSafeInteger(pid) && pid > 0)
  const finish = async (command = 'ROLLBACK') => {
    if (
      !connection.child.stdin.writableEnded &&
      connection.child.exitCode === null
    )
      connection.child.stdin.end(`${command};\n`)
    await connection.completed.catch(() => {})
  }
  const waitLock = async blocker =>
    until(
      async () =>
        (await db.sql(`SELECT count(*) FROM pg_stat_activity WHERE pid=${pid}
      AND application_name='${name}' AND wait_event_type='Lock'
      ${blocker ? `AND ${blocker.pid}=ANY(pg_blocking_pids(${pid}))` : ''};`)) ===
        '1'
    )
  const terminate = async () => {
    // This exact PID/name came from this invocation's owned session only.
    assert.equal(
      await db.sql(`SELECT pg_terminate_backend(pid,2000) FROM pg_stat_activity
      WHERE pid=${pid} AND application_name='${name}';`),
      't'
    )
    if (!connection.child.stdin.writableEnded)
      connection.child.stdin.end('SELECT 1;\n')
    await assert.rejects(
      connection.completed,
      /terminating connection|administrator command|server closed/
    )
  }
  return {
    ...connection,
    name,
    pid,
    write,
    mark,
    finish,
    waitLock,
    terminate,
    result: () =>
      JSON.parse(
        connection
          .output()
          .split('\n')
          .filter(line => line.startsWith('{'))
          .at(-1)
      ),
  }
}
