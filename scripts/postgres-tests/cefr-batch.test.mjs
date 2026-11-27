import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import {
  asService,
  call,
  entryFixture,
  json,
  replaceRevision,
  reviewerSql,
} from './cefr-queue-fixtures.mjs'
import { createCluster } from './cluster.mjs'
import { asUser, other, owner, seedUsers, seedWord } from './fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => db?.close())

const next = () => call(db, 'SELECT public.next_dictionary_cefr_batch_v1()')
const estimate = { outcome: 'estimated', level: 'B1', confidence: 0.9 }

async function linkWord(user, { entry, revision }) {
  const word = await seedWord(db, user)
  const command = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: word,
    expected_content_version: 0,
    kind: 'link',
    reference: { entry_id: entry, revision_id: revision },
    overrides: {},
  }
  await db.sql(
    asUser(
      user,
      `SELECT public.apply_dictionary_content_command_v1(${json(command)})`
    )
  )
  return word
}

test('publishes a shared estimate once, skips stale meanings and preserves reviewed levels', async () => {
  assert.deepEqual(await next(), { action: 'disabled' })
  await assert.rejects(
    db.sql(
      'SET ROLE authenticated; SELECT public.next_dictionary_cefr_batch_v1()'
    ),
    /permission denied/
  )
  const providerSource = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources
    (source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES('${providerSource}','provider','gemini-batch:cefr-estimate-v1','approved','${owner}',now(),repeat('a',64));`)
  const current = await entryFixture(db)
  const changed = await entryFixture(db)
  const reviewed = await entryFixture(db)
  const draft = await entryFixture(db, { state: 'draft' })
  const unknown = await entryFixture(db)
  await entryFixture(db)
  await db.sql(`UPDATE private.dictionary_content_runtime
    SET operations_enabled=true, reads_enabled=true WHERE singleton`)
  const ownerWord = await linkWord(owner, current)
  const otherWord = await linkWord(other, current)
  const privateWord = await seedWord(db, owner)
  const pilot = [current, changed, reviewed, draft, unknown]
  await db.sql(`UPDATE private.dictionary_cefr_batch_settings
    SET enabled=true, source_id='${providerSource}', remaining_batches=1,
      pilot_entry_ids=ARRAY[${pilot.map(({ entry }) => `'${entry}'`).join(',')}]::uuid[]`)
  const task = await next()
  assert.equal(task.action, 'submit')
  const ids = task.requests.map(item => item.entry_id)
  assert.deepEqual(
    ids,
    [current.entry, changed.entry, reviewed.entry, unknown.entry].sort()
  )
  assert.ok(
    task.requests.every(item => !Object.hasOwn(item.meaning, 'image_url'))
  )
  assert.equal((await next()).action, 'awaiting_receipt')
  await db.sql(
    asService(
      `SELECT public.record_dictionary_cefr_batch_v1('${task.batch_id}','batches/example');`
    )
  )
  assert.equal((await next()).action, 'poll')
  await replaceRevision(db, changed)
  await db.sql(reviewerSql(reviewed))
  const results = Object.fromEntries(
    ids.map(id => [
      id,
      id === unknown.entry ? { outcome: 'unknown' } : estimate,
    ])
  )
  const finish = asService(
    `SELECT public.finish_dictionary_cefr_batch_v1('${task.batch_id}',${json(results)});`
  )
  await db.sql(finish)
  await db.sql(finish)
  const outcomes = JSON.parse(
    await db.sql(`SELECT jsonb_object_agg(entry_id, outcome)
    FROM private.dictionary_cefr_batch_items WHERE batch_id='${task.batch_id}'`)
  )
  assert.deepEqual(outcomes, {
    [current.entry]: 'estimated',
    [changed.entry]: 'obsolete',
    [reviewed.entry]: 'obsolete',
    [unknown.entry]: 'unknown',
  })
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.dictionary_cefr_assessments
    WHERE entry_id IN ('${current.entry}','${changed.entry}','${reviewed.entry}','${draft.entry}') AND status='estimated'`),
    '1'
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM private.dictionary_content_changes
    WHERE entry_id='${current.entry}' AND change_kind='cefr-head'`),
    '1'
  )
  assert.equal(
    await db.sql(
      asService(`SELECT cefr_level, cefr_status FROM public.readable_dictionary_content
      WHERE entry_id='${current.entry}'`)
    ),
    'B1|estimated'
  )
  assert.equal(
    await db.sql(
      asService(`SELECT cefr_level, cefr_status FROM public.readable_dictionary_content
      WHERE entry_id='${reviewed.entry}'`)
    ),
    'B2|reviewed'
  )
  for (const [user, word] of [
    [owner, ownerWord],
    [other, otherWord],
  ]) {
    const data = JSON.parse(
      await db.sql(
        asUser(
          user,
          `SELECT public.get_dictionary_effective_content_v1(ARRAY['${word}','${privateWord}']::uuid[])`
        )
      )
    )
    assert.deepEqual(data.cards.find(card => card.word_id === word)?.cefr, {
      level: 'B1',
      status: 'estimated',
      confidence: 0.9,
    })
    assert.ok(
      !data.cards.find(card => card.word_id === privateWord)?.cefr?.level
    )
  }
  await db.sql(
    `UPDATE private.dictionary_cefr_batches SET created_at=now()-interval '2 hours'`
  )
  assert.equal((await next()).action, 'idle')
})
