import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  owner,
  other,
  seedUsers,
  seedWord,
  asUser,
  literal,
} from './fixtures.mjs'
import {
  GENERATOR,
  JUDGE,
  paidRelease,
  paidState,
  grantPair,
  claimPaid,
  settlePaid,
  usage,
  modelLimits,
} from './dictionary-paid.fixture.mjs'
import {
  ready,
  start,
  journal,
  json,
  service,
  snapshots,
} from './dictionary-creation-dispatch.fixture.mjs'
import {
  configure,
  content,
  judge,
  verdict,
} from './dictionary-creation-publication.fixture.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('cohort is an AND gate and never grants full_access or administrator membership', async () => {
  await paidRelease(db)
  const signal = actor =>
    json(db, asUser(actor, 'SELECT public.dictionary_analysis_actor_v1();'))
  assert.equal((await signal(owner)).may_analyze, true)
  assert.equal(
    await db.sql(`SELECT private.may_analyze_dictionary('${other}');`),
    't'
  )
  assert.equal((await signal(other)).may_analyze, false)
  await assert.rejects(
    grantPair(db, { actor: other }),
    /analysis-permission-required/
  )
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.equal((await signal(owner)).may_analyze, false)
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM private.dictionary_administrators;'),
    '0'
  )
})
test('new monetary RPCs and private relations deny anonymous/client execution', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      await db.sql(
        `SELECT has_function_privilege('${role}','public.claim_dictionary_paid_attempt_v1(uuid,text,text,text,text,integer,integer)','EXECUTE');`
      ),
      'f'
    )
    assert.equal(
      await db.sql(
        `SELECT has_table_privilege('${role}','private.dictionary_paid_attempts','SELECT');`
      ),
      'f'
    )
  }
  assert.equal(
    await db.sql(
      "SELECT has_table_privilege('service_role','private.dictionary_paid_releases','UPDATE');"
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      "SELECT has_function_privilege('service_role','private.settle_dictionary_paid_attempt_v1(uuid,text,jsonb)','EXECUTE');"
    ),
    'f'
  )
})
test('paid capability narrows to the selected actor while following reads stay available', async () => {
  const release = await paidRelease(db)
  const flags = [
    'reads_enabled',
    'operations_enabled',
    'legacy_guard_enabled',
    'following_reads_enabled',
    'following_imports_enabled',
    'following_cache_enabled',
    'analysis_operations_enabled',
    'analysis_publication_enabled',
    'analysis_history_enabled',
    'administrator_rollback_enabled',
    'semantic_checks_enabled',
    'creation_resolution_enabled',
    'creation_operations_enabled',
    'creation_dispatch_enabled',
    'creation_judgement_enabled',
    'creation_publication_enabled',
    'creation_recovery_enabled',
    'shared_analysis_capability_enabled',
  ]
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET ' +
      flags.map(flag => flag + '=TRUE').join(',') +
      ';'
  )
  const cap = actor =>
    json(db, asUser(actor, 'SELECT public.dictionary_content_capability_v2();'))
  assert.equal((await cap(owner)).shared_analysis_enabled, true)
  assert.equal((await cap(other)).shared_analysis_enabled, false)
  assert.equal((await cap(other)).following_enabled, true)
  await db.sql(
    `UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id='${release}';`
  )
  assert.equal((await cap(owner)).shared_analysis_enabled, false)
  assert.equal((await cap(owner)).following_enabled, true)
})
test('revocation stops new claims while committed accounting can still close', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    claim = await claimPaid(db, f)
  await db.sql(
    `UPDATE private.dictionary_paid_cohort SET enabled=FALSE WHERE release_id='${release}';`
  )
  await assert.rejects(grantPair(db), /analysis-permission-required/)
  assert.deepEqual(await settlePaid(db, claim.attempt_id, usage()), {
    state: 'settled',
  })
  assert.equal((await paidState(db, release)).settled, '25')
})
test('a fully reserved budget does not revoke the actor signal needed to resume already-funded work', async () => {
  await paidRelease(db, { limit: '16584' })
  await grantPair(db)
  const signal = await json(
    db,
    asUser(owner, 'SELECT public.dictionary_analysis_actor_v1();')
  )
  assert.equal(signal.may_analyze, true)
  await assert.rejects(grantPair(db), /rate-limit-exceeded/)
})
test('creation uses real acceptance/grant/journal/publish SQL for both paid phases', async () => {
  await configure(db)
  const release = await paidRelease(db, {
    limit: '1000000',
    models: {
      [GENERATOR]: modelLimits(GENERATOR, {
        max_request_bytes: '32768',
        max_input_tokens: '32768',
      }),
      [JUDGE]: modelLimits(JUDGE, {
        max_request_bytes: '32768',
        max_input_tokens: '32768',
      }),
    },
  })
  const f = await ready(db),
    g = (await start(db, f)).dispatch
  await seedWord(db, owner, { intervalDays: 12, repetitionCount: 7 })
  await seedWord(db, other, { intervalDays: 4, repetitionCount: 2 })
  const personalBefore = await snapshots(db)
  const generationKey = `${f.run}:generation:1`
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_paid_attempts WHERE release_id='${release}';`
    ),
    '2'
  )
  const c = await claimPaid(
    db,
    { actor: owner, key: generationKey },
    { bytes: 100 }
  )
  assert.equal(c.allowed, true)
  await journal(
    db,
    f,
    g,
    {
      content: content(),
      provider_response: {
        modelVersion: GENERATOR,
        usageMetadata: { ...usage(), modelVersion: undefined },
      },
    },
    'paid-generation:' + randomUUID()
  )
  const j = await judge(db, f)
  assert.ok(j.dispatch)
  assert.equal(
    (
      await claimPaid(
        db,
        { actor: owner, key: `${f.run}:judgement:1` },
        { model: JUDGE }
      )
    ).allowed,
    true
  )
  const raw = verdict(j.dispatch)
  raw.provider_response = {
    modelVersion: JUDGE,
    usageMetadata: { ...usage(), modelVersion: undefined },
  }
  await json(
    db,
    service(
      `SELECT public.record_dictionary_creation_judgement_v1('${f.run}','1',${literal(j.dispatch.input_sha256)},${literal(JSON.stringify(raw))}::JSONB,${literal('paid-judge:' + randomUUID())});`
    )
  )
  const valid = await json(
    db,
    service(`SELECT public.validate_dictionary_creation_v1('${f.run}','1');`)
  )
  assert.equal(valid.outcome, 'accepted')
  const published = await json(
    db,
    service(
      `SELECT public.publish_dictionary_creation_v1('${f.run}','1','${valid.validation_id}');`
    )
  )
  assert.equal(published.status, 'published')
  assert.deepEqual(await paidState(db, release), {
    held: '0',
    settled: '50',
    calls: 2,
    enabled: true,
  })
  assert.deepEqual(
    await json(
      db,
      asUser(
        owner,
        `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(f.cmd))}::JSONB);`
      )
    ),
    published
  )
  assert.equal((await paidState(db, release)).calls, 2)
  assert.deepEqual(await snapshots(db), personalBefore)
})
test('missing generation accounting blocks the judge even if old worker RPC is called directly', async () => {
  await configure(db)
  await paidRelease(db)
  const f = await ready(db),
    g = (await start(db, f)).dispatch
  await claimPaid(db, { actor: owner, key: `${f.run}:generation:1` })
  await journal(db, f, g, { content: content() }, 'no-usage:' + randomUUID())
  await assert.rejects(judge(db, f), /paid-generation-accounting-required/)
})
test('direct generic analysis grants cannot bypass planned profile or reservation', async () => {
  await paidRelease(db)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('z_paid_generation_grant','z_paid_semantic_grant','z_paid_creation_generation','z_paid_creation_judgement') AND NOT tgisinternal;`
    ),
    '4'
  )
  await assert.rejects(
    db.sql(
      `SET ROLE authenticated; SELECT public.start_dictionary_analysis_dispatch_v1('${owner}','${randomUUID()}','1','gemini',${literal(GENERATOR)},'${'a'.repeat(64)}');`
    ),
    /permission denied/
  )
})
