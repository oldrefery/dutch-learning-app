import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { fetchAllRows } from '../../apps/web/src/lib/supabase/fetch-all-rows.ts'
import {
  startFixtureBackend,
  createFixture,
  snapshot,
  dictionarySnapshot,
  createFollowingFixture,
  followingSnapshot,
  FOLLOWING_HEAD,
  PUBLIC_KEY,
  USER_ID,
} from './fixture-backend.mjs'

test('following fixtures deduplicate shared revisions and preserve paired vocabulary, learning and bulk boundaries', async t => {
  const backend = await startFixtureBackend()
  t.after(() => backend.close())
  const client = createClient(backend.url, PUBLIC_KEY, {
    auth: { persistSession: false },
  })
  for (const scenario of [
    { words: 500, events: 0, selected: 500 },
    { words: 2500, events: 501, selected: 2500 },
    { words: 5000, events: 5000, selected: 5000 },
    { words: 5000, events: 5000, selected: 20 },
  ]) {
    const fixture = createFollowingFixture(scenario)
    backend.configure(fixture, 'following', 'following-contract')
    const result = await client.rpc('get_web_review_snapshot_v3')
    assert.equal(result.error, null)
    assert.deepEqual(result.data, followingSnapshot(fixture))
    const { dictionaryContent, words, events, collections } = result.data
    assert.deepEqual(
      { words, events, collections },
      {
        words: snapshot(fixture).words,
        events: snapshot(fixture).events,
        collections: snapshot(fixture).collections,
      }
    )
    assert.equal(dictionaryContent.watermark, FOLLOWING_HEAD)
    assert.equal(dictionaryContent.cards.length, scenario.words)
    assert.equal(dictionaryContent.revisions.length, scenario.words / 4)
    for (const card of dictionaryContent.cards) {
      const revision = dictionaryContent.revisions.find(
        r => r.revision_id === card.reference.revision_id
      )
      assert.ok(revision)
      assert.equal(revision.entry_id, card.reference.entry_id)
      assert.equal(card.head_sequence, FOLLOWING_HEAD)
      assert.equal(card.content_version, '9007199254740993')
      assert.match(revision.content_sha256, /^[a-f0-9]{64}$/)
    }
    assert.equal(backend.requests.length, 1)
  }
  assert.deepEqual(backend.errors, [])
})

test('following detail batch, read failure retry and changed owner remain read-only and bounded', async t => {
  const backend = await startFixtureBackend()
  t.after(() => backend.close())
  const ownerId = '00000000-0000-4000-8000-000000000003'
  const fixture = createFollowingFixture(
    { words: 500, events: 501, selected: 20 },
    { ownerId, updated: true }
  )
  backend.configure(fixture, 'following', 'following-detail')
  const client = createClient(backend.url, PUBLIC_KEY, {
    auth: { persistSession: false },
  })
  const ids = [fixture.words[0].word_id, fixture.words[4].word_id]
  backend.setUnavailable(true)
  assert.ok(
    (
      await client.rpc('get_dictionary_effective_content_v2', {
        p_word_ids: ids,
      })
    ).error
  )
  backend.setUnavailable(false)
  const result = await client.rpc('get_dictionary_effective_content_v2', {
    p_word_ids: ids,
  })
  assert.equal(result.error, null)
  assert.deepEqual(
    result.data.cards.map(card => card.word_id),
    ids
  )
  assert.equal(result.data.revisions.length, 2)
  assert.equal(result.data.watermark, '9007199254740995')
  const complete = await client.rpc('get_web_review_snapshot_v3')
  assert.equal(complete.error, null)
  assert.equal(complete.data.dictionaryContent.cards.length, 500)
  assert.equal(complete.data.dictionaryContent.revisions.length, 125)
  const own = await client
    .from('words')
    .select('*')
    .eq('user_id', ownerId)
    .eq('word_id', ids[0])
    .is('deleted_at', null)
    .maybeSingle()
  assert.equal(own.error, null)
  assert.deepEqual(own.data, fixture.words[0])
  assert.deepEqual(backend.errors, [])
  assert.ok(
    (
      await client
        .from('words')
        .select('*')
        .eq('user_id', USER_ID)
        .is('deleted_at', null)
    ).error
  )
  assert.equal(backend.errors.length, 1)
})

test('dictionary fixture supplies the real v2 envelope in one owned snapshot', async t => {
  const backend = await startFixtureBackend()
  t.after(() => backend.close())
  const fixture = createFixture({ words: 2500, events: 501 })
  backend.configure(fixture, 'dictionary', 'dictionary-contract')
  const client = createClient(backend.url, PUBLIC_KEY, {
    auth: { persistSession: false },
  })
  const result = await client.rpc('get_web_review_snapshot_v2')
  assert.equal(result.error, null)
  assert.deepEqual(result.data, dictionarySnapshot(fixture))
  assert.deepEqual(
    result.data.effectiveContent.map(card => card.word_id),
    result.data.words.map(word => word.word_id)
  )
  assert.equal(backend.requests.length, 1)
  assert.equal(backend.errors.length, 0)
})

test('snapshot and actual paginated client reads have identical fixture data at boundaries', async t => {
  const backend = await startFixtureBackend()
  t.after(() => backend.close())
  const client = createClient(backend.url, PUBLIC_KEY, {
    auth: { persistSession: false },
  })
  for (const [words, events] of [
    [500, 0],
    [2500, 501],
    [5000, 5000],
  ]) {
    const fixture = createFixture({ words, events, selected: 20 })
    const expected = snapshot(fixture)
    backend.configure(fixture, 'snapshot', 'snapshot')
    const rpc = await client.rpc('get_web_review_snapshot_v1')
    assert.equal(rpc.error, null)
    assert.deepEqual(rpc.data, expected)
    backend.configure(fixture, 'legacy', 'legacy')
    const missing = await client.rpc('get_web_review_snapshot_v1')
    assert.equal(missing.error.code, 'PGRST202')
    for (const [table, field, maxRows] of [
      ['words', 'words', Infinity],
      ['effective_review_events', 'events', 5000],
    ]) {
      const columns = Object.keys(
        expected[field][0] ?? {
          answered_correctly: null,
          assessment: null,
          event_id: null,
          review_mode: null,
          reviewed_at: null,
          word_id: null,
        }
      ).join(',')
      const result = await fetchAllRows(
        (from, to) => {
          const query = client
            .from(table)
            .select(columns)
            .eq('user_id', USER_ID)
            .range(from, to)
          return table === 'words' ? query.is('deleted_at', null) : query
        },
        { maxRows }
      )
      assert.equal(result.error, null)
      assert.deepEqual(result.data, expected[field])
      const count = expected[field].length
      const pages =
        count === maxRows ? count / 500 : Math.floor(count / 500) + 1
      assert.equal(
        backend.requests.filter(request => request.path.endsWith(`/${table}`))
          .length,
        pages
      )
    }
    assert.equal(
      fixture.words.filter(word => word.next_review_date === '2020-01-01')
        .length,
      20
    )
    assert.equal(backend.errors.length, 0)
  }
})

test('fixture backend rejects unscoped reads, unknown RPCs and table writes', async t => {
  const backend = await startFixtureBackend()
  t.after(() => backend.close())
  const client = createClient(backend.url, PUBLIC_KEY, {
    auth: { persistSession: false },
  })
  const unscoped = await client.from('words').select('word_id')
  assert.ok(unscoped.error)
  const write = await client.from('words').insert({ dutch_lemma: 'blocked' })
  assert.ok(write.error)
  const unknown = await client.rpc('unknown_rpc')
  assert.ok(unknown.error)
  assert.equal(backend.errors.length, 3)
  assert.ok(backend.requests.every(request => request.status === 500))
})

test('fixture auth cookies are generated by the installed SSR client', async t => {
  const backend = await startFixtureBackend()
  t.after(() => backend.close())
  const cookies = await backend.cookies('http://127.0.0.1:3000')
  assert.ok(cookies.length > 0)
  assert.ok(
    cookies.every(
      cookie => cookie.name.startsWith('sb-') && cookie.value.length > 0
    )
  )
  assert.equal(backend.errors.length, 0)
})
