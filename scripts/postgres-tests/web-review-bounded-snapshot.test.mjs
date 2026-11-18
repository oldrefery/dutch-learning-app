import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, owner, other, seedUsers, seedWord } from './fixtures.mjs'

let db
let words
const base = 'public.get_web_review_snapshot_v3()'
const bounded = (limit = 2) =>
  `public.get_web_review_bounded_snapshot('2026-11-14','all-due',NULL,${limit})`
const snapshot = async (user, rpc) =>
  JSON.parse(await db.sql(asUser(user, `SELECT ${rpc};`)))

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  words = await Promise.all(Array.from({ length: 4 }, () => seedWord(db)))
  await seedWord(db, other)
  await db.sql(`
    UPDATE private.dictionary_content_runtime SET reads_enabled=true, following_reads_enabled=true WHERE singleton;
    UPDATE public.words SET next_review_date='2026-11-14' WHERE user_id='${owner}';
    UPDATE public.words SET next_review_date='2026-11-15' WHERE word_id='${words[3]}';
  `)
})
after(async () => {
  await db?.close()
})

test('counts the full queue before limiting the ordered owner snapshot', async () => {
  const current = await snapshot(owner, base)
  const next = await snapshot(owner, bounded())
  const expected = [...words.slice(0, 3)].sort().slice(0, 2)
  assert.equal(next.dueCount, 3)
  assert.deepEqual(
    next.words.map(word => word.word_id),
    expected
  )
  assert.deepEqual(next.events, current.events)
  assert.deepEqual(
    next.dictionaryContent.cards,
    current.dictionaryContent.cards.filter(card =>
      expected.includes(card.word_id)
    )
  )
  const foreign = await snapshot(other, bounded())
  assert.ok(foreign.words.every(word => !words.includes(word.word_id)))
})

test('rejects unauthenticated and oversized reads', async () => {
  await assert.rejects(db.sql(asUser(null, `SELECT ${bounded()};`)), /42501/)
  await assert.rejects(db.sql(`SET ROLE anon; SELECT ${bounded()};`), /42501/)
  await assert.rejects(
    db.sql(asUser(owner, `SELECT ${bounded(101)};`)),
    /22023/
  )
})
