import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { owner, other, seedUsers, asUser } from './fixtures.mjs'
import { paidRelease } from './dictionary-paid.fixture.mjs'

let db
const ACTOR = 'public.dictionary_analysis_actor_v1()'
const actor = async (user = owner) =>
  JSON.parse(await db.sql(asUser(user, `SELECT ${ACTOR};`)))
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('read_only actor receives only their own permission and no ability to select another actor', async () => {
  await db.sql(`UPDATE public.user_access_levels SET access_level='read_only';`)
  assert.deepEqual(await actor(), {
    protocol_version: 1,
    actor_id: owner,
    may_analyze: false,
  })
  assert.deepEqual(await actor(other), {
    protocol_version: 1,
    actor_id: other,
    may_analyze: false,
  })
  await assert.rejects(
    db.sql(
      asUser(owner, `SELECT public.dictionary_analysis_actor_v1('${other}');`)
    ),
    /does not exist/
  )
})
test('current full_access grant and revocation change the self signal immediately', async () => {
  await paidRelease(db)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';`
  )
  assert.equal((await actor()).may_analyze, true)
  assert.equal((await actor(other)).may_analyze, false)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.equal((await actor()).may_analyze, false)
})
test('private administrator is allowed with read_only; disabling membership revokes the signal', async () => {
  await paidRelease(db, { actors: [other] })
  await db.sql("UPDATE public.user_access_levels SET access_level='read_only';")
  await db.sql(
    `INSERT INTO private.dictionary_administrators(user_id,audit_reference) VALUES ('${other}','synthetic-actor-test');`
  )
  assert.equal((await actor(other)).may_analyze, true)
  assert.equal((await actor()).may_analyze, false)
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${other}';`
  )
  assert.equal((await actor(other)).may_analyze, false)
  await assert.rejects(
    db.sql(asUser(other, 'SELECT * FROM private.dictionary_administrators;')),
    /permission denied/
  )
})
test('missing, foreign and deleted identities cannot read a signal', async () => {
  await assert.rejects(actor(null), /authentication-required/)
  await assert.rejects(
    actor('33333333-3333-4333-8333-333333333333'),
    /authentication-required/
  )
  const id = '44444444-4444-4444-8444-444444444444'
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${id}','deleted@example.invalid'); DELETE FROM auth.users WHERE id='${id}';`
  )
  await assert.rejects(actor(id), /authentication-required/)
})
test('signal is authenticated-only STABLE security definer with an empty search path', async () => {
  const meta = JSON.parse(
    await db.sql(`SELECT json_build_object('volatile',provolatile,'definer',prosecdef,'settings',proconfig,
    'anon',has_function_privilege('anon','${ACTOR}','EXECUTE'),
    'authenticated',has_function_privilege('authenticated','${ACTOR}','EXECUTE'),
    'service',has_function_privilege('service_role','${ACTOR}','EXECUTE')) FROM pg_proc WHERE oid='${ACTOR}'::regprocedure;`)
  )
  assert.deepEqual(meta, {
    volatile: 's',
    definer: true,
    settings: ['search_path=""'],
    anon: false,
    authenticated: true,
    service: false,
  })
  await assert.rejects(
    db.sql(`SET ROLE anon; SELECT ${ACTOR};`),
    /permission denied/
  )
  await assert.rejects(
    db.sql(`SET ROLE service_role; SELECT ${ACTOR};`),
    /permission denied/
  )
})
test('reading permissions does not enable capability, grant membership, spend quota or create operations', async () => {
  const snapshot = async () =>
    await db.sql(`SELECT jsonb_build_object('runtime',(SELECT to_jsonb(r) FROM private.dictionary_content_runtime r),
    'quota',(SELECT count(*) FROM public.edge_function_rate_limits),
    'operations',(SELECT count(*) FROM private.dictionary_analysis_operations),
    'roles',(SELECT jsonb_agg(to_jsonb(a) ORDER BY user_id) FROM private.dictionary_administrators a));`)
  const before = await snapshot()
  for (let i = 0; i < 3; i++) await actor()
  assert.equal(await snapshot(), before)
  const capability = JSON.parse(
    await db.sql(
      asUser(owner, 'SELECT public.dictionary_content_capability_v2();')
    )
  )
  assert.equal(capability.shared_analysis_enabled, false)
  assert.ok(!capability.command_protocol_versions.includes(2))
})
