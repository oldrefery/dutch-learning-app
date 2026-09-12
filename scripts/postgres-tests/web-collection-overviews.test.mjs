import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, owner, other, seedUsers, seedWord } from './fixtures.mjs'

let db
let newestCollection

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(`INSERT INTO public.collections(user_id, name, created_at)
    VALUES ('${owner}', 'Oldest', '2026-09-10T09:00:00Z') RETURNING collection_id;`)
  newestCollection =
    await db.sql(`INSERT INTO public.collections(user_id, name, is_shared, created_at)
    VALUES ('${owner}', 'Newest', true, '2026-09-11T09:00:00Z') RETURNING collection_id;`)
  await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${other}', 'Other user');`)

  const dueNew = await seedWord(db, owner, { repetitionCount: 0 })
  const mastered = await seedWord(db, owner, {
    repetitionCount: 3,
    easinessFactor: 2.1,
  })
  const future = await seedWord(db, owner, { repetitionCount: 1 })
  const deleted = await seedWord(db, owner, { repetitionCount: 3 })
  const unassigned = await seedWord(db, owner, { repetitionCount: 3 })
  const foreign = await seedWord(db, other, { repetitionCount: 3 })

  await db.sql(`UPDATE public.words SET
    collection_id = '${newestCollection}', next_review_date = '2026-09-12'
    WHERE word_id = '${dueNew}';
    UPDATE public.words SET
    collection_id = '${newestCollection}', next_review_date = '2026-09-11'
    WHERE word_id = '${mastered}';
    UPDATE public.words SET
    collection_id = '${newestCollection}', next_review_date = '2026-09-13'
    WHERE word_id = '${future}';
    UPDATE public.words SET
    collection_id = '${newestCollection}', deleted_at = '2026-09-12T10:00:00Z'
    WHERE word_id = '${deleted}';
    UPDATE public.words SET collection_id = '${newestCollection}'
    WHERE word_id = '${foreign}';
    UPDATE public.words SET collection_id = NULL
    WHERE word_id = '${unassigned}';`)
})
after(async () => {
  await db?.close()
})

test('collection overview RPC preserves empty collections and calculates active owned counts', async () => {
  const output = await db.sql(
    asUser(
      owner,
      `SELECT name, is_shared, total_words, mastered_words, due_words,
        difficult_words, new_words
       FROM public.get_web_collection_overviews_v1('2026-09-12');`
    )
  )

  assert.equal(
    output,
    'My Words|f|0|0|0|0|0\nNewest|t|3|1|2|1|1\nOldest|f|0|0|0|0|0'
  )
})

test('collection overview RPC is invoker-secure and rejects anonymous execution', async () => {
  assert.equal(
    await db.sql(`SELECT prosecdef FROM pg_proc
      WHERE oid = 'public.get_web_collection_overviews_v1(date)'::regprocedure;`),
    'f'
  )
  assert.equal(
    await db.sql(
      asUser(
        other,
        `SELECT count(*) FROM public.get_web_collection_overviews_v1('2026-09-12');`
      )
    ),
    '2'
  )
  await assert.rejects(
    db.sql(`SET ROLE anon; SET request.jwt.claim.sub = '${owner}';
      SELECT * FROM public.get_web_collection_overviews_v1('2026-09-12');`),
    /42501.*permission denied for function/s
  )
})
