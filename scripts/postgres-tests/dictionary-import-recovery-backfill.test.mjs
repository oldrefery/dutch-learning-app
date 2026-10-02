import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { owner, other, seedUsers } from './fixtures.mjs'
import { importFixture } from './dictionary-import-recovery-fixtures.mjs'

const migration = await readFile(
  new URL(
    '../../supabase/migrations/20261002120000_add_dictionary_import_recovery.sql',
    import.meta.url
  ),
  'utf8'
)
async function baseline(run) {
  const db = await createCluster({
    throughMigration: '20261002110000_add_dictionary_import_intents.sql',
  })
  try {
    await seedUsers(db)
    await db.sql(
      `UPDATE private.dictionary_content_runtime SET reads_enabled = true,operations_enabled = true,legacy_guard_enabled = true;`
    )
    await run(db)
  } finally {
    await db.close()
  }
}

test('recovery backfill retains live and deleted provenance, excludes semantic conflicts and preserves receipts', async () => {
  await baseline(async db => {
    const live = await importFixture(db)
    const deleted = await importFixture(db)
    await live.apply()
    await deleted.apply()
    await db.sql(
      `DELETE FROM public.words WHERE word_id = '${deleted.intent.word_id}';`
    )
    const conflict = {
      ...live.intent,
      operation_id: randomUUID(),
      word_id: randomUUID(),
    }
    await live.apply(conflict)
    const receipts = await db.sql(
      'SELECT jsonb_agg(to_jsonb(r) ORDER BY operation_id) FROM private.dictionary_import_receipts r;'
    )
    await db.sql(migration)
    assert.equal((await live.origin()).inserted_once, true)
    assert.equal((await deleted.origin()).inserted_once, true)
    assert.equal((await deleted.read()).state, 'unavailable')
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM private.dictionary_import_origins WHERE word_id = '${conflict.word_id}';`
      ),
      '0'
    )
    assert.equal(
      await db.sql(
        'SELECT jsonb_agg(to_jsonb(r) ORDER BY operation_id) FROM private.dictionary_import_receipts r;'
      ),
      receipts
    )
  })
})

for (const nextOwner of [owner, other]) {
  test(`recovery backfill rejects ambiguous successful roots atomically (${nextOwner === owner ? 'same' : 'different'} owner)`, async () => {
    await baseline(async db => {
      const f = await importFixture(db)
      await f.apply()
      await db.sql(
        `DELETE FROM public.words WHERE word_id = '${f.intent.word_id}';`
      )
      const g = await importFixture(db, nextOwner)
      await g.apply({
        ...f.intent,
        operation_id: randomUUID(),
        collection_id: g.targets[0],
      })
      await assert.rejects(
        db.sql(migration),
        /ambiguous-import-provenance: 1 personal IDs/
      )
      assert.equal(
        await db.sql(
          `SELECT to_regclass('private.dictionary_import_origins') IS NULL;`
        ),
        't'
      )
      assert.equal(
        await db.sql(
          'SELECT count(*) FROM private.dictionary_import_receipts;'
        ),
        '2'
      )
    })
  })
}
