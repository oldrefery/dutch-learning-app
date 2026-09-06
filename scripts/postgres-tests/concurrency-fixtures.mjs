import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { asUser, owner, rpc } from './fixtures.mjs'

async function until(predicate) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await setTimeout(20)
  }
  throw new Error('Expected PostgreSQL concurrency barrier was not reached')
}

// Hold A until pg_stat_activity proves B is waiting on a real database lock.
export async function overlap(db, first, second) {
  const a = db.connect()
  const application = `qa-review-${randomUUID()}`
  let b
  try {
    a.child.stdin.write(`SET statement_timeout = '10s';
      SET idle_in_transaction_session_timeout = '10s'; BEGIN;
      ${asUser(owner, typeof first === 'string' ? first : rpc(first))}\n\\echo ASSESSMENT_HELD\n`)
    await until(() => a.output().includes('ASSESSMENT_HELD'))
    b = db.sql(
      `SET application_name = '${application}'; ${asUser(owner, typeof second === 'string' ? second : rpc(second))}`
    )
    void b.catch(() => {})
    await until(
      async () =>
        (await db.sql(`SELECT count(*) FROM pg_stat_activity
      WHERE application_name = '${application}' AND wait_event_type = 'Lock';`)) ===
        '1'
    )
    a.child.stdin.end('COMMIT;\n')
    await a.completed
    return await b
  } finally {
    if (!a.child.stdin.writableEnded) a.child.stdin.end('ROLLBACK;\n')
    await a.completed.catch(() => {})
    await b?.catch(() => {})
  }
}
