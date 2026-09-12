import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createCluster } from '../postgres-tests/cluster.mjs'
import {
  asUser,
  owner,
  other,
  seedUsers,
  literal,
} from '../postgres-tests/fixtures.mjs'

// Reuse the disposable migration-test cluster, never application connection
// strings or PG* credentials. The cluster accepts Unix-socket connections only.
const output = fileURLToPath(
  new URL(
    `../../apps/web/output/performance/sql/${Date.now()}/`,
    import.meta.url
  )
)
await mkdir(output, { recursive: true })
const results = []

async function seed(db, user, wordCount, eventCount) {
  const collection = `md5(${literal(`${user}-collection`)})::uuid`
  await db.sql(`INSERT INTO public.collections(collection_id, user_id, name)
    VALUES (${collection}, '${user}', 'Performance fixture');
    INSERT INTO public.words(word_id, user_id, collection_id, dutch_lemma,
      translations, tts_url, next_review_date)
    SELECT md5('${user}-word-' || n)::uuid, '${user}', ${collection},
      'woord-' || n, jsonb_build_object('en', jsonb_build_array('meaning-' || n)), '', '2020-01-01'
    FROM generate_series(0, ${wordCount - 1}) n;`)
  if (eventCount === 0) return
  // Exercise the real assessment/checkpoint triggers while populating synthetic
  // history. Timing starts only after fixture setup and ANALYZE have completed.
  for (let from = 1; from <= eventCount; from += 500) {
    await db.sql(
      asUser(
        user,
        `SELECT count(*) FROM generate_series(${from}, ${Math.min(from + 499, eventCount)}) n
    CROSS JOIN LATERAL public.record_review_assessment(
      md5('${user}-word-' || ((n - 1) % ${wordCount}))::uuid,
      md5('${user}-event-' || n)::uuid, 'good', 'recognition', true, 500,
      '2026-09-01T12:00:00Z'::timestamptz + ((n - 1) / 2) * interval '1 second', '2026-09-01'
    ) r;`
      )
    )
  }
  await db.sql(
    asUser(
      user,
      `SELECT count(*) FROM (
    SELECT h.word_id, h.event_id FROM public.review_progress_heads h
    WHERE h.user_id = '${user}' ORDER BY h.word_id LIMIT ${Math.floor(wordCount / 10)}
  ) h CROSS JOIN LATERAL public.correct_review_assessment(
    h.word_id, h.event_id, md5(h.event_id::text || '-correction')::uuid, 0, 'hard'
  ) r;`
    )
  )
}

for (const scenario of [
  { words: 500, events: 0 },
  { words: 2500, events: 501 },
  { words: 5000, events: 5001 },
]) {
  const db = await createCluster()
  try {
    await seedUsers(db)
    await seed(db, owner, scenario.words, scenario.events)
    await seed(db, other, scenario.words, scenario.events)
    await db.sql('ANALYZE;')
    const functionBody = await db.sql(`SELECT prosrc FROM pg_proc
      WHERE oid = 'public.get_web_review_snapshot_v1()'::regprocedure;`)
    const run = query =>
      db.sql(
        asUser(
          owner,
          `SET search_path = ''; EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
        )
      )
    const validation = JSON.parse(
      await db.sql(
        asUser(
          owner,
          `SELECT jsonb_build_object(
      'words', jsonb_array_length(s->'words'), 'events', jsonb_array_length(s->'events'),
      'collections', jsonb_array_length(s->'collections'), 'bytes', octet_length(s::text),
      'corrected', (SELECT count(*) FROM public.effective_review_events WHERE revision > 0),
      'eventOrderMatches', jsonb_path_query_array(s, '$.events[*].event_id') = (
        SELECT COALESCE(jsonb_agg(e.event_id ORDER BY e.reviewed_at DESC, e.event_id DESC), '[]'::jsonb)
        FROM (SELECT event_id, reviewed_at FROM public.effective_review_events
          WHERE user_id = (SELECT auth.uid()) ORDER BY reviewed_at DESC, event_id DESC LIMIT 5000) e
      )
    ) FROM (SELECT public.get_web_review_snapshot_v1() s) q;`
        )
      )
    )
    assert.equal(validation.words, scenario.words)
    assert.equal(validation.events, Math.min(5000, scenario.events))
    assert.equal(
      validation.eventOrderMatches,
      true,
      'Newest-event cutoff and tie ordering must match'
    )
    // Signup creates My Words in addition to the explicitly seeded collection.
    assert.equal(
      validation.collections,
      2,
      'RLS must exclude both collections of the second fixture owner'
    )
    if (scenario.events > 0) assert.ok(validation.corrected > 0)
    await run('SELECT public.get_web_review_snapshot_v1();')
    const samples = []
    for (let sample = 0; sample < 5; sample++) {
      const functionPlan = JSON.parse(
        await run('SELECT public.get_web_review_snapshot_v1();')
      )[0]
      const bodyPlan = JSON.parse(await run(functionBody))[0]
      samples.push({ functionPlan, bodyPlan })
    }
    const indexes = JSON.parse(
      await db.sql(`SELECT jsonb_agg(indexdef) FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('words', 'review_events', 'review_assessment_corrections');`)
    )
    const result = {
      ...scenario,
      secondOwnerWords: scenario.words,
      validation,
      indexes,
      samples,
    }
    results.push(result)
    await writeFile(
      `${output}/${scenario.words}.json`,
      JSON.stringify(result, null, 2)
    )
    const times = samples
      .map(sample => sample.functionPlan['Execution Time'])
      .sort((a, b) => a - b)
    console.log(
      `${scenario.words} words / ${scenario.events} events: SQL median=${times[2]}ms range=${times[0]}..${times[4]}ms bytes=${validation.bytes}`
    )
  } finally {
    await db.close()
  }
}
await writeFile(
  `${output}/summary.json`,
  JSON.stringify(
    {
      environment:
        'Disposable local PostgreSQL; authenticated role, real migrations, two synthetic owners, warm buffers; not hosted latency.',
      results,
    },
    null,
    2
  )
)
console.log(`Results: ${output}`)
