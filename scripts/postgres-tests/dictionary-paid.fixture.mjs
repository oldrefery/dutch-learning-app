import { randomUUID, createHash } from 'node:crypto'
import { literal, owner, other, asUser } from './fixtures.mjs'
import {
  configure,
  ready,
  start,
} from './dictionary-creation-dispatch.fixture.mjs'

export const GENERATOR = 'gemini-generator-fixture'
export const JUDGE = 'gemini-judge-fixture'
export const BINDING = 'd'.repeat(64)
export const PAID_POLICY = 'b'.repeat(64)
export const modelLimits = (version, fields = {}) => ({
  model_version: version,
  max_request_bytes: '100',
  max_input_tokens: '100',
  max_output_tokens: '8192',
  input_nanousd_per_token: '1',
  cached_nanousd_per_token: '0',
  output_nanousd_per_token: '1',
  ...fields,
})
export async function paidRelease(db, options = {}) {
  const id = randomUUID()
  const models = options.models ?? {
    [GENERATOR]: modelLimits(GENERATOR),
    [JUDGE]: modelLimits(JUDGE),
  }
  await db.sql(`DELETE FROM public.edge_function_rate_limits;
    UPDATE private.dictionary_paid_releases SET enabled=FALSE;
    UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=TRUE,analysis_publication_enabled=TRUE,semantic_checks_enabled=TRUE,
      creation_resolution_enabled=TRUE,creation_operations_enabled=TRUE,creation_dispatch_enabled=TRUE,creation_judgement_enabled=TRUE,creation_publication_enabled=TRUE;
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model)
      VALUES('paid-ledger-fixture','${PAID_POLICY}',TRUE,'fixture://paid-policy','independent-gemini-v1','${JUDGE}','${'c'.repeat(64)}','${GENERATOR}')
      ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id IN ('${owner}','${other}');
    INSERT INTO private.dictionary_paid_releases(release_id,binding_sha256,enabled,valid_from,valid_until,limit_nanousd,call_limit,models,credential_revision,audit_reference)
    VALUES('${id}',${literal(options.binding ?? createHash('sha256').update(id).digest('hex'))},${options.enabled ?? true},
      ${options.from ? literal(options.from) : "CLOCK_TIMESTAMP()-INTERVAL '1 day'"},
      ${options.until ? literal(options.until) : "CLOCK_TIMESTAMP()+INTERVAL '1 day'"},
      ${literal(options.limit ?? '100000')},${options.calls ?? 100},${literal(JSON.stringify(models))}::JSONB,'fixture-only','fixture://paid-release');`)
  for (const actor of options.actors ?? [owner])
    await db.sql(`INSERT INTO private.dictionary_paid_cohort(release_id,user_id,enabled,expires_at,audit_reference)
      VALUES('${id}',${literal(actor)},TRUE,CLOCK_TIMESTAMP()+INTERVAL '2 days','fixture://paid-cohort');`)
  return id
}
export const paidState = (db, release) =>
  db
    .sql(
      `SELECT JSONB_BUILD_OBJECT('held',held_nanousd::TEXT,'settled',settled_nanousd::TEXT,'calls',calls_issued,'enabled',enabled)
      FROM private.dictionary_paid_releases WHERE release_id=${literal(release)};`
    )
    .then(JSON.parse)
// Pure ledger fixture for rollback/overflow tests; claims require real business work.
export const reservePair = (db, fields = {}) => {
  const entry = fields.entry ?? randomUUID()
  const operation = fields.operation ?? randomUUID()
  const actor = fields.actor ?? owner
  const fence = fields.fence ?? '1'
  const key = `${operation}:${fence}`
  return db
    .sql(
      `SELECT private.grant_dictionary_paid_phase(${literal(fields.workflow ?? 'analysis')},${literal(actor)},${literal(operation)},${literal(entry)},${literal(fence)},
      'generation','${PAID_POLICY}','paid-ledger-fixture','${GENERATOR}','${JUDGE}',${literal(key)},${literal('semantic:' + key)});`
    )
    .then(() => ({ actor, entry, operation, key, fence }))
}
export async function preparePaidAnalysis(db, fields = {}) {
  const actor = fields.actor ?? owner
  const entry = fields.entry ?? randomUUID()
  const operation = fields.operation ?? randomUUID()
  const revision = randomUUID(),
    source = randomUUID(),
    anchor = randomUUID()
  const digest = 'a'.repeat(64)
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES('${source}','editorial','fixture://paid-analysis','approved','${actor}',NOW(),'${digest}');
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
      VALUES('${entry}','nl','bank','noun','de','${entry}');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
      VALUES('${revision}','${entry}',1,'{}','${digest}','${digest}','${source}','published',NOW(),NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES('${entry}','${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';
    INSERT INTO private.dictionary_meaning_anchors(anchor_id,entry_id,source_id,gloss,examples,verified_by,verified_at,audit_reference,anchor_sha256)
      VALUES('${anchor}','${entry}','${source}','A financial institution.','["Ik ga naar de bank."]','${actor}',NOW(),'fixture://paid-anchor','${digest}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id,anchor_id) VALUES('${entry}','${anchor}');`)
  const sequence = await db.sql(
    `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND change_kind='revision-head';`
  )
  return {
    actor,
    entry,
    operation,
    key: `${operation}:1`,
    fence: '1',
    command: {
      protocol_version: 2,
      operation_id: operation,
      entry_id: entry,
      expected_revision_id: revision,
      expected_head_sequence: sequence,
    },
  }
}
export const acceptPaidAnalysis = (db, f) =>
  db
    .sql(
      asUser(
        f.actor,
        `SELECT public.accept_dictionary_independent_analysis_v2(
  ${literal(JSON.stringify(f.command))}::JSONB,'${GENERATOR}','paid-ledger-fixture','${PAID_POLICY}','${JUDGE}','${'c'.repeat(64)}',ARRAY[]::TEXT[]);`
      )
    )
    .then(JSON.parse)
export const dispatchPaidAnalysis = (db, f) =>
  db
    .sql(
      `SET ROLE service_role; SELECT public.start_dictionary_analysis_dispatch_v1(
  '${f.actor}','${f.operation}','${f.fence}','gemini','${GENERATOR}','${'a'.repeat(64)}');`
    )
    .then(JSON.parse)
export async function grantPair(db, fields = {}) {
  if (fields.workflow === 'creation') {
    await configure(db)
    const f = await ready(db, fields.actor ?? owner)
    const granted = await start(db, f)
    if (!granted.dispatch) throw new Error('fixture-generation-grant-required')
    return {
      actor: f.actor,
      entry: f.identity.entry_id,
      operation: f.cmd.operation_id,
      run: f.run,
      fence: '1',
      key: `${f.run}:generation:1`,
    }
  }
  const f = await preparePaidAnalysis(db, fields)
  await acceptPaidAnalysis(db, f)
  const granted = await dispatchPaidAnalysis(db, f)
  if (!granted.dispatch) throw new Error('fixture-generation-grant-required')
  return f
}
export const finishPaidAnalysis = (db, f) =>
  db.sql(`SET ROLE service_role; SELECT public.record_dictionary_analysis_failure_v1(
  '${f.actor}','${f.operation}','${f.fence}','provider-failed','${'e'.repeat(64)}');`)
export const claimPaid = async (db, f, fields = {}) => {
  const binding =
    fields.binding ??
    (await db.sql(`SELECT r.binding_sha256 FROM private.dictionary_paid_releases r JOIN private.dictionary_paid_attempts a USING(release_id)
    WHERE a.actor_id=${literal(f.actor)} AND a.invocation_key=${literal(fields.key ?? f.key)};`))
  return db
    .sql(
      `SET ROLE service_role; SELECT public.claim_dictionary_paid_attempt_v1(${literal(f.actor)},${literal(fields.key ?? f.key)},
      ${literal(fields.model ?? GENERATOR)},${literal(binding)},${literal(fields.hash ?? 'a'.repeat(64))},
      ${fields.bytes ?? 100},${fields.output ?? 8192});`
    )
    .then(JSON.parse)
}
export const usage = (model = GENERATOR, fields = {}) => ({
  modelVersion: model,
  promptTokenCount: 20,
  cachedContentTokenCount: 5,
  candidatesTokenCount: 6,
  thoughtsTokenCount: 4,
  totalTokenCount: 30,
  ...fields,
})
export const settlePaid = (db, attempt, value, evidence = 'c'.repeat(64)) =>
  db
    .sql(
      `SELECT private.settle_dictionary_paid_attempt_v1(${literal(attempt)},${literal(evidence)},
      ${value === null ? 'NULL' : literal(JSON.stringify(value)) + '::JSONB'});`
    )
    .then(JSON.parse)
