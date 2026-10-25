import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, owner, seedUsers, seedWord } from './fixtures.mjs'

const migration = new URL(
  '../../supabase/migrations/20261025093000_add_dictionary_capability_release_gate.sql',
  import.meta.url
)
const capability = 'public.dictionary_content_capability_v2()'
const advertisement = 'shared_analysis_capability_enabled'
const prerequisites = [
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
]
let db
const read = async () =>
  JSON.parse(await db.sql(asUser(owner, `SELECT ${capability};`)))
const enable = async () =>
  db.sql(`UPDATE private.dictionary_content_runtime SET
    ${[advertisement, ...prerequisites].map(name => `${name}=TRUE`).join(',')}
    WHERE singleton;`)
const expected = ({
  reads = true,
  operations = true,
  following = true,
  shared = false,
} = {}) => ({
  dictionary_content_protocol: 2,
  read_protocol_versions: following ? [1, 2] : reads ? [1] : [],
  command_protocol_versions: shared ? [1, 2] : operations ? [1] : [],
  following_enabled: following,
  shared_analysis_enabled: shared,
})

before(async () => {
  db = await createCluster({
    throughMigration:
      '20261011220000_bind_dictionary_observed_model_versions.sql',
  })
  await seedUsers(db)
  await seedWord(db, owner, { intervalDays: 12, repetitionCount: 7 })
})
after(async () => {
  await db?.close()
})

test('install preserves legacy settings, personal rows and dormant v2 behavior', async () => {
  await db.sql(`UPDATE private.dictionary_content_runtime SET
    reads_enabled=TRUE,operations_enabled=TRUE,legacy_guard_enabled=TRUE WHERE singleton;`)
  // Managed production defaults already grant this metadata RPC to service_role.
  await db.sql(`GRANT EXECUTE ON FUNCTION ${capability} TO service_role;`)
  const acl = () =>
    db.sql(`SELECT proacl::TEXT FROM pg_proc
    WHERE oid='${capability}'::regprocedure;`)
  const previousAcl = await acl()
  const snapshot = () =>
    db.sql(`SELECT jsonb_build_object(
    'runtime',(SELECT to_jsonb(r)-'${advertisement}' FROM private.dictionary_content_runtime r),
    'words',(SELECT jsonb_agg(to_jsonb(w) ORDER BY word_id) FROM public.words w),
    'reviews',(SELECT jsonb_agg(to_jsonb(e) ORDER BY event_id) FROM public.review_events e),
    'administrators',(SELECT jsonb_agg(to_jsonb(a) ORDER BY user_id) FROM private.dictionary_administrators a),
    'quota',(SELECT count(*) FROM public.edge_function_rate_limits));`)
  const baseline = await snapshot()
  const legacy = await db.sql(
    asUser(owner, 'SELECT public.dictionary_content_capability_v1();')
  )
  assert.deepEqual(await read(), expected({ following: false }))
  await db.sql(await readFile(migration, 'utf8'))
  assert.equal(await snapshot(), baseline)
  assert.equal(await acl(), previousAcl)
  assert.equal(
    await db.sql(
      `SELECT ${advertisement} FROM private.dictionary_content_runtime;`
    ),
    'f'
  )
  assert.deepEqual(await read(), expected({ following: false }))
  assert.equal(
    await db.sql(
      asUser(owner, 'SELECT public.dictionary_content_capability_v1();')
    ),
    legacy
  )
})

test('all previous flags alone cannot advertise shared analysis or command protocol 2', async () => {
  await enable()
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET ${advertisement}=FALSE;`
  )
  assert.deepEqual(await read(), expected())
})

test('the complete explicitly enabled profile advertises the existing exact v2 contract', async () => {
  await enable()
  assert.deepEqual(await read(), expected({ shared: true }))
})

for (const name of prerequisites) {
  test(`advertisement cannot bypass the ${name} prerequisite`, async () => {
    await enable()
    await db.sql(`UPDATE private.dictionary_content_runtime SET ${name}=FALSE;`)
    assert.deepEqual(
      await read(),
      expected({
        reads: name !== 'reads_enabled',
        operations: name !== 'operations_enabled',
        following: !['reads_enabled', 'following_reads_enabled'].includes(name),
      })
    )
  })
}

test('reading or withdrawing advertisement does not mutate learning, quota or dispatch gates', async () => {
  await enable()
  const snapshot = () =>
    db.sql(`SELECT jsonb_build_object(
    'runtime',(SELECT to_jsonb(r)-'${advertisement}' FROM private.dictionary_content_runtime r),
    'words',(SELECT jsonb_agg(to_jsonb(w) ORDER BY word_id) FROM public.words w),
    'quota',(SELECT count(*) FROM public.edge_function_rate_limits),
    'analysis',(SELECT count(*) FROM private.dictionary_analysis_operations),
    'creation',(SELECT count(*) FROM private.dictionary_creation_operations));`)
  const baseline = await snapshot()
  await read()
  await read()
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET ${advertisement}=FALSE;`
  )
  assert.deepEqual(await read(), expected())
  assert.equal(await snapshot(), baseline)
})

test('the function retains its read-only contract and existing managed service grant without permitting private writes', async () => {
  const meta = JSON.parse(
    await db.sql(`SELECT jsonb_build_object(
    'volatile',provolatile,'definer',prosecdef,'settings',proconfig,
    'anon',has_function_privilege('anon','${capability}','EXECUTE'),
    'authenticated',has_function_privilege('authenticated','${capability}','EXECUTE'),
    'service',has_function_privilege('service_role','${capability}','EXECUTE'))
    FROM pg_proc WHERE oid='${capability}'::regprocedure;`)
  )
  assert.deepEqual(meta, {
    volatile: 's',
    definer: true,
    settings: ['search_path=""'],
    anon: false,
    authenticated: true,
    service: true,
  })
  await assert.rejects(
    db.sql(`SET ROLE anon; SELECT ${capability};`),
    /permission denied/
  )
  assert.deepEqual(
    JSON.parse(await db.sql(`SET ROLE service_role; SELECT ${capability};`)),
    expected()
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE private.dictionary_content_runtime SET ${advertisement}=TRUE;`
      )
    ),
    /permission denied/
  )
})
