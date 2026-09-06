import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  literal,
  owner,
  other,
  review,
  rpc,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('RLS tests run as a non-owner role without superuser or BYPASSRLS privileges', async () => {
  assert.equal(
    await db.sql("SELECT current_setting('listen_addresses') = '';"),
    't'
  )
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT current_user, rolsuper, rolbypassrls,
    current_user = pg_get_userbyid(c.relowner), c.relrowsecurity
    FROM pg_roles JOIN pg_class c ON c.oid = 'public.words'::regclass
    WHERE rolname = current_user;`
      )
    ),
    'authenticated|f|f|f|t'
  )
  assert.equal(
    await db.sql(`SELECT prosecdef FROM pg_proc
    WHERE oid = 'public.record_review_assessment(uuid,uuid,text,text,boolean,integer,timestamptz,date)'::regprocedure;`),
    'f'
  )
})

test('anonymous callers cannot execute the RPC even with a claimed user ID', async () => {
  const word = await seedWord(db)
  await assert.rejects(
    db.sql(
      `SET ROLE anon; SET request.jwt.claim.sub = '${owner}'; ${rpc(assessment(word))}`
    ),
    /42501.*permission denied for function/s
  )
})

test('a missing authenticated subject cannot review', async () => {
  const word = await seedWord(db)
  await assert.rejects(
    review(db, assessment(word), null),
    /Authentication required/
  )
})

test('private words and events are invisible to another user and cannot be updated', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  const before = await state(db, word)
  assert.equal(
    await db.sql(
      asUser(
        other,
        `SELECT count(*) FROM words WHERE word_id = '${word}';
    SELECT count(*) FROM review_events WHERE word_id = '${word}';
    UPDATE words SET repetition_count = 99 WHERE word_id = '${word}' RETURNING word_id;`
      )
    ),
    '0\n0'
  )
  await assert.rejects(
    review(db, assessment(word), other),
    /Review word not found/
  )
  assert.deepEqual(await state(db, word), before)
})

test('sharing permits reading but not reviewing or stealing another users word', async () => {
  const collection =
    await db.sql(`INSERT INTO collections(user_id, name, is_shared)
    VALUES ('${owner}', 'Shared fixture', true) RETURNING collection_id;`)
  const word = await seedWord(db)
  await db.sql(
    `UPDATE words SET collection_id = '${collection}' WHERE word_id = '${word}';`
  )
  assert.equal(
    await db.sql(
      asUser(other, `SELECT count(*) FROM words WHERE word_id = '${word}';`)
    ),
    '1'
  )
  await assert.rejects(
    review(db, assessment(word), other),
    /Review word not found/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE words SET user_id = '${other}' WHERE word_id = '${word}';`
      )
    ),
    /42501.*row-level security/s
  )
})

test('read-only product access can review existing owned words', async () => {
  assert.equal(
    await db.sql(asUser(owner, `SELECT get_user_access_level('${owner}');`)),
    'read_only'
  )
  const word = await seedWord(db)
  assert.equal((await review(db, assessment(word))).repetition_count, 1)
})

test('review event RLS rejects both a forged owner and a foreign word', async () => {
  const word = await seedWord(db)
  const input = assessment(word)
  await review(db, input)
  for (const user of [owner, other]) {
    await assert.rejects(
      db.sql(
        asUser(
          other,
          `INSERT INTO review_events
      SELECT gen_random_uuid(), '${user}'::uuid, word_id, assessment, review_mode,
        answered_correctly, response_time_ms, previous_interval_days, next_interval_days,
        previous_easiness_factor, next_easiness_factor, reviewed_at, created_at
      FROM json_populate_record(NULL::review_events, ${literal(JSON.stringify((await state(db, word)).events[0]))}::json);`
        )
      ),
      /42501.*row-level security/s
    )
  }
})

test('identical event upsert is allowed but material changes and deletion are denied', async () => {
  const word = await seedWord(db)
  const input = assessment(word)
  await review(db, input)
  const before = await state(db, word)
  await db.sql(
    asUser(
      owner,
      `INSERT INTO review_events SELECT * FROM review_events WHERE event_id = '${input.event}'
    ON CONFLICT(event_id) DO UPDATE SET assessment = EXCLUDED.assessment;
    UPDATE review_events SET created_at = '2000-01-01' WHERE event_id = '${input.event}';`
    )
  )
  assert.deepEqual(await state(db, word), before)
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE review_events SET assessment = 'easy' WHERE event_id = '${input.event}';`
      )
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `DELETE FROM review_events WHERE event_id = '${input.event}';`
      )
    ),
    /42501/
  )
  assert.deepEqual(await state(db, word), before)
})

test('event deletion stays blocked by RLS even with a permissive table grant', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  const before = await state(db, word)
  await db.sql('GRANT DELETE ON review_events TO authenticated;')
  try {
    assert.equal(
      await db.sql(
        asUser(
          owner,
          `DELETE FROM review_events WHERE word_id = '${word}' RETURNING event_id;`
        )
      ),
      ''
    )
    assert.deepEqual(await state(db, word), before)
  } finally {
    await db.sql('REVOKE DELETE ON review_events FROM authenticated;')
  }
})

test('soft deletion removes history, prevents review and cannot be undone by a stale write', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  await db.sql(
    asUser(
      owner,
      `UPDATE words SET deleted_at = '2026-09-05T13:00:00Z' WHERE word_id = '${word}';`
    )
  )
  const before = await state(db, word)
  assert.equal(before.events.length, 0)
  await assert.rejects(review(db, assessment(word)), /Review word not found/)
  await db.sql(
    asUser(
      owner,
      `UPDATE words SET deleted_at = NULL WHERE word_id = '${word}';`
    )
  )
  assert.equal((await state(db, word)).word.deleted_at, before.word.deleted_at)
})
