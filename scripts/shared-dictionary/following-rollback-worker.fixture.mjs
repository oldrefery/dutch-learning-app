// Owned disposable SQLite worker. IPC barriers prove provisional writes/locking.
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
const [engine, path, run, batch, owner] = process.argv.slice(2)
const { rollbackSqliteMigration } = await import(pathToFileURL(engine).href)
const db = new DatabaseSync(path)
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=100;')
let inserts = 0
const values = input =>
  input.length === 1 && Array.isArray(input[0]) ? input[0] : input
const adapter = {
  getFirstAsync: async (sql, ...input) =>
    db.prepare(sql).get(...values(input)) ?? null,
  getAllAsync: async (sql, ...input) => db.prepare(sql).all(...values(input)),
  runAsync: async (sql, ...input) => {
    const result = db.prepare(sql).run(...values(input))
    if (
      sql.startsWith('INSERT INTO following_migration_rollback(') &&
      ++inserts === 2
    ) {
      process.send({ provisionalReceipts: inserts })
      await new Promise(resolve => process.once('message', resolve))
    }
    return result
  },
  withExclusiveTransactionAsync: async callback => {
    db.exec('BEGIN IMMEDIATE')
    try {
      await callback(adapter)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  },
}
try {
  const result = await rollbackSqliteMigration(adapter, run, batch, owner, 2)
  process.send({ committed: result })
} finally {
  db.close()
  process.disconnect()
}
