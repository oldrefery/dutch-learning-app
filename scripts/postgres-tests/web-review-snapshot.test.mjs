import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  owner,
  other,
  review,
  seedUsers,
  seedWord,
} from './fixtures.mjs'

let db
let word
let event

const snapshotFor = async user =>
  JSON.parse(
    await db.sql(asUser(user, 'SELECT public.get_web_review_snapshot_v1();'))
  )

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  const collection = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${owner}', 'Alphabetical') RETURNING collection_id;`)
  word = await seedWord(db, owner, { repetitionCount: 0 })
  const deleted = await seedWord(db, owner, { repetitionCount: 0 })
  await db.sql(`UPDATE public.words SET collection_id = '${collection}',
    article = 'de', dutch_lemma = 'fiets', dutch_original = 'fiets',
    part_of_speech = 'noun', image_url = NULL, tts_url = '',
    next_review_date = '2026-09-12' WHERE word_id = '${word}';
    UPDATE public.words SET deleted_at = '2026-09-12T12:00:00Z'
    WHERE word_id = '${deleted}';`)
  event = assessment(word)
  await review(db, event)
  await db.sql(
    asUser(
      owner,
      `SELECT public.correct_review_assessment(
        '${word}', '${event.event}', '${randomUUID()}', 0, 'again'
      );`
    )
  )
})
after(async () => {
  await db?.close()
})

test('review snapshot exposes one complete, ordered and corrected active workspace', async () => {
  const snapshot = await snapshotFor(owner)

  assert.equal(snapshot.protocolVersion, 1)
  assert.equal(snapshot.correctionsAvailable, true)
  assert.equal(snapshot.words.length, 1)
  assert.deepEqual(snapshot.words[0], {
    article: 'de',
    collection_id: snapshot.collections.find(
      collection => collection.name === 'Alphabetical'
    ).collection_id,
    dutch_lemma: 'fiets',
    dutch_original: 'fiets',
    easiness_factor: 2.3,
    image_url: null,
    interval_days: 0,
    last_reviewed_at: event.at,
    next_review_date: event.date,
    part_of_speech: 'noun',
    repetition_count: 0,
    translations: {},
    tts_url: '',
    word_id: word,
  })
  assert.deepEqual(snapshot.events, [
    {
      answered_correctly: true,
      assessment: 'again',
      event_id: event.event,
      review_mode: 'meaning-recall',
      reviewed_at: event.at,
      word_id: word,
    },
  ])
  assert.deepEqual(
    snapshot.words.map(value => value.word_id),
    [word]
  )
})

test('review snapshot is invoker-secure and never crosses account boundaries', async () => {
  const foreignWord = await seedWord(db, other)
  const foreignSnapshot = await snapshotFor(other)

  assert.deepEqual(
    foreignSnapshot.words.map(value => value.word_id),
    [foreignWord]
  )
  assert.equal(
    await db.sql(`SELECT prosecdef FROM pg_proc
      WHERE oid = 'public.get_web_review_snapshot_v1()'::regprocedure;`),
    'f'
  )
  await assert.rejects(
    db.sql(`SET ROLE anon; SET request.jwt.claim.sub = '${owner}';
      SELECT public.get_web_review_snapshot_v1();`),
    /42501.*permission denied for function/s
  )
})
