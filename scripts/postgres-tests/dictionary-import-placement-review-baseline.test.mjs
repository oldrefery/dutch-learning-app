import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { owner, seedUsers } from './fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import {
  importFixture,
  recoverRpc,
} from './dictionary-import-recovery-fixtures.mjs'

// D10 checkpoint 6 counterexample, pinned to the reviewed server revision.
// A passing test demonstrates unsafe baseline behavior, NOT release acceptance.
let db
before(async () => {
  db = await createCluster({
    throughMigration: '20261002120000_add_dictionary_import_recovery.sql',
  })
  await seedUsers(db)
  await db.sql(`UPDATE private.dictionary_content_runtime SET
    reads_enabled = true, operations_enabled = true, legacy_guard_enabled = true;`)
})
after(async () => db?.close())

test('review baseline: delayed ordinary placement UPDATE overwrites a committed recovery', async () => {
  const f = await importFixture(db)
  await f.apply()
  const request = f.recovery({ target_collection_id: f.targets[2] })
  // The current mobile metadata writer uses precisely these predicates. The
  // other device commits recovery while this older ordinary move waits on it.
  await overlap(
    db,
    recoverRpc(request),
    `UPDATE public.words SET collection_id = '${f.targets[1]}'
     WHERE user_id = '${owner}' AND word_id IN ('${f.intent.word_id}')
       AND deleted_at IS NULL RETURNING word_id;`
  )
  assert.equal((await f.row()).collection_id, f.targets[1])
  assert.equal((await f.origin()).recovery_version, 1)
  assert.equal((await f.recover(request)).idempotent, true)
  assert.equal((await f.row()).collection_id, f.targets[1])
})
