import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { asUser, literal, owner } from './fixtures.mjs'

registerHooks({
  resolve(specifier, context, next) {
    if (
      context.parentURL?.includes('/packages/domain/src/') &&
      specifier.startsWith('./') &&
      !specifier.endsWith('.ts')
    )
      return next(`${specifier}.ts`, context)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context)
    return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), {
        mode: 'transform',
      }),
    }
  },
})
const { parseDictionaryCreationResponseV2 } =
  await import('../../packages/domain/src/dictionary-creation.ts')
export const POLICY = 'b'.repeat(64)
export const VERSION = 'creation-dispatch-fixture-v1'
export const EVIDENCE = 'e'.repeat(64)
export const result = {
  content: { dutch_lemma: 'bank' },
  usage: { total_tokens: 12 },
}
export const json = (db, sql) =>
  db.sql(sql).then(text => (text ? JSON.parse(text) : null))
export const service = sql => `SET ROLE service_role; ${sql}`
export const checked = receipt => {
  assert.equal(
    parseDictionaryCreationResponseV2(receipt).success,
    true,
    JSON.stringify(receipt)
  )
  return receipt
}
export async function configure(db) {
  await db.sql(`DELETE FROM public.edge_function_rate_limits;
    UPDATE public.user_access_levels SET access_level='full_access';
    UPDATE private.dictionary_content_runtime SET creation_resolution_enabled=TRUE,creation_operations_enabled=TRUE,
      creation_dispatch_enabled=TRUE,analysis_operations_enabled=TRUE,analysis_publication_enabled=TRUE,
      semantic_checks_enabled=TRUE,analysis_quota_limit=100,analysis_quota_window_seconds=3600;
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,
      semantic_method,semantic_model,semantic_prompt_sha256,generation_model) VALUES('${VERSION}','${POLICY}',TRUE,
      'fixture://creation-dispatch','independent-gemini-v1','gemini-judge-fixture','${'c'.repeat(64)}','gemini-generator-fixture')
      ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;
    INSERT INTO private.dictionary_creation_profile(singleton,validator_version,policy_sha256) VALUES(TRUE,'${VERSION}','${POLICY}')
      ON CONFLICT(singleton) DO UPDATE SET validator_version=EXCLUDED.validator_version,policy_sha256=EXCLUDED.policy_sha256;`)
}
export async function ready(db, actor = owner) {
  const identity = {
    identity_id: randomUUID(),
    entry_id: randomUUID(),
    language_code: 'nl',
    lemma: 'bank',
    part_of_speech: 'noun',
    article: 'de',
    sense_key: randomUUID(),
    source_id: randomUUID(),
    gloss: 'A financial institution.',
    examples: ['Ik ga naar de bank.'],
    verified_by: owner,
    verified_at: '2026-10-10T01:00:00+00:00',
    audit_reference: 'fixture://creation-dispatch-identity',
  }
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES('${identity.source_id}','editorial','fixture://creation-dispatch-source','approved','${owner}','2026-10-10T00:00:00Z','${'a'.repeat(64)}');`)
  await json(
    db,
    service(
      `SELECT TO_JSONB(public.register_dictionary_creation_identity_v1(${literal(JSON.stringify(identity))}::JSONB));`
    )
  )
  const req = {
    protocol_version: 2,
    resolution_id: randomUUID(),
    original_query: ' BANK ',
    meaning_hint: 'Private owner hint 7: financial bank',
  }
  await json(
    db,
    asUser(
      actor,
      `SELECT public.request_dictionary_meaning_resolution_v2(${literal(JSON.stringify(req))}::JSONB);`
    )
  )
  const hash = await db.sql(
    `SELECT request_sha256 FROM private.dictionary_meaning_requests WHERE actor_id='${actor}' AND resolution_id='${req.resolution_id}';`
  )
  await json(
    db,
    service(
      `SELECT public.resolve_dictionary_meaning_request_v1('${actor}','${req.resolution_id}','${hash}','${identity.identity_id}',NULL);`
    )
  )
  const cmd = {
    protocol_version: 2,
    operation_id: randomUUID(),
    resolution_id: req.resolution_id,
  }
  const receipt = checked(
    await json(
      db,
      asUser(
        actor,
        `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(cmd))}::JSONB);`
      )
    )
  )
  const work = await json(
    db,
    service(
      `SELECT public.get_dictionary_creation_work_v1('${actor}','${cmd.operation_id}');`
    )
  )
  return { identity, req, cmd, receipt, run: work.run_id, actor }
}
export const start = (db, f, fence = '1') =>
  json(
    db,
    service(
      `SELECT public.start_dictionary_creation_dispatch_v1('${f.run}',${literal(fence)});`
    )
  )
export const journal = (db, f, dispatch, raw = result, id = null) =>
  json(
    db,
    service(`SELECT public.record_dictionary_creation_result_v1(
  '${f.run}','1',${literal(dispatch.input_sha256)},${literal(JSON.stringify(raw))}::JSONB,${literal(id)});`)
  ).then(checked)
export const fail = (db, f, dispatch, known = false, evidence = null) =>
  json(
    db,
    service(`SELECT public.record_dictionary_creation_failure_v1(
  '${f.run}','1',${literal(dispatch.input_sha256)},${known},${literal(evidence)});`)
  ).then(checked)
export const reconcile = (db, f, hash, evidence = EVIDENCE) =>
  json(
    db,
    service(`SELECT public.reconcile_dictionary_creation_result_v1(
  '${f.run}','1',${literal(hash)},${literal(evidence)});`)
  ).then(checked)
export const read = (db, f, actor = f.actor) =>
  json(
    db,
    asUser(
      actor,
      `SELECT public.get_dictionary_creation_operation_v2('${f.cmd.operation_id}');`
    )
  )
export const replay = (db, f) =>
  json(
    db,
    asUser(
      f.actor,
      `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(f.cmd))}::JSONB);`
    )
  )
export const quota = (db, actor = owner) =>
  db
    .sql(
      `SELECT COALESCE((SELECT request_count FROM public.edge_function_rate_limits WHERE user_id='${actor}' AND capability='gemini-analysis'),0);`
    )
    .then(Number)
export async function snapshots(db) {
  const tables = await json(
    db,
    `SELECT JSON_AGG(tablename ORDER BY tablename) FROM pg_catalog.pg_tables WHERE schemaname='public'
    AND tablename NOT LIKE 'dictionary_%' AND tablename<>'edge_function_rate_limits';`
  )
  const values = {}
  for (const table of tables) {
    assert.match(table, /^[a-z_]+$/)
    values[table] = await db.sql(
      `SELECT COALESCE(JSONB_AGG(TO_JSONB(t) ORDER BY TO_JSONB(t)::TEXT),'[]') FROM public.${table} t;`
    )
  }
  return values
}
