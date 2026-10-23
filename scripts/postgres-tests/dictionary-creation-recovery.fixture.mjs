import { randomUUID } from 'node:crypto'
import { asUser, literal, owner, other } from './fixtures.mjs'
import {
  EVIDENCE,
  json,
  checked,
  service,
  ready,
  start,
  fail,
} from './dictionary-creation-dispatch.fixture.mjs'
import {
  configure as configurePublication,
  generated,
  judge,
  record,
  verdict,
  validate,
} from './dictionary-creation-publication.fixture.mjs'

export async function configure(db) {
  await configurePublication(db)
  await db.sql(`UPDATE private.dictionary_content_runtime SET creation_recovery_enabled=TRUE;
    INSERT INTO private.dictionary_administrators(user_id,audit_reference) VALUES('${other}','fixture://recovery-reviewer')
    ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;`)
}
export async function definitive(db, kind = 'generation-failed') {
  await configure(db)
  if (kind === 'generation-failed') {
    const f = await ready(db)
    const dispatch = (await start(db, f)).dispatch
    await fail(db, f, dispatch, true, EVIDENCE)
    return { ...f, dispatch }
  }
  const f = await generated(db)
  const dispatch = (await judge(db, f)).dispatch
  if (kind === 'judge-failed') {
    await json(
      db,
      service(
        `SELECT public.fail_dictionary_creation_judgement_v1('${f.run}','1',${literal(dispatch.input_sha256)},TRUE,${literal(EVIDENCE)});`
      )
    )
  } else {
    await record(db, f, dispatch, verdict(dispatch, kind))
    await validate(db, f)
  }
  return { ...f, dispatch }
}
export async function resolution(db, f, actor = f.actor) {
  const request = {
    protocol_version: 2,
    resolution_id: randomUUID(),
    original_query: ' BANK ',
    meaning_hint: 'Retained private recovery original 19',
  }
  await json(
    db,
    asUser(
      actor,
      `SELECT public.request_dictionary_meaning_resolution_v2(${literal(JSON.stringify(request))}::JSONB);`
    )
  )
  const hash = await db.sql(
    `SELECT request_sha256 FROM private.dictionary_meaning_requests WHERE actor_id='${actor}' AND resolution_id='${request.resolution_id}';`
  )
  await json(
    db,
    service(
      `SELECT public.resolve_dictionary_meaning_request_v1('${actor}','${request.resolution_id}','${hash}','${f.identity.identity_id}',NULL);`
    )
  )
  return request.resolution_id
}
export async function request(db, f, overrides = {}) {
  return {
    review_id: randomUUID(),
    prior_run_id: f.run,
    expected_fence: f.receipt.fence,
    actor_id: f.actor,
    operation_id: randomUUID(),
    resolution_id: await resolution(db, f),
    audit_reference: 'fixture://explicit-known-outcome-recovery',
    audit_evidence_sha256: EVIDENCE,
    ...overrides,
  }
}
export const reviewSQL = r =>
  `SELECT public.review_dictionary_creation_recovery_v2(${literal(JSON.stringify(r))}::JSONB);`
export const review = (db, r, reviewer = other) =>
  json(db, asUser(reviewer, reviewSQL(r)))
export const command = r => ({
  protocol_version: 2,
  operation_id: r.operation_id,
  resolution_id: r.resolution_id,
  recovery_id: r.review_id,
})
export const acceptSQL = c =>
  `SELECT public.accept_dictionary_creation_recovery_v2(${literal(JSON.stringify(c))}::JSONB);`
export const accept = (db, c, actor = owner) =>
  json(db, asUser(actor, acceptSQL(c))).then(checked)
export async function approved(db, f, overrides = {}) {
  const r = await request(db, f, overrides)
  const receipt = await review(db, r)
  return { r, receipt, cmd: command(r) }
}
export const accounting = (db, f) =>
  json(
    db,
    `SELECT JSONB_BUILD_OBJECT('run',TO_JSONB(r),'generation',TO_JSONB(g),'judge',TO_JSONB(j),
      'validation',TO_JSONB(v),'command',TO_JSONB(c),'operation',TO_JSONB(o))
      FROM private.dictionary_creation_runs r
      LEFT JOIN private.dictionary_creation_generation_attempts g USING(run_id)
      LEFT JOIN private.dictionary_creation_judge_attempts j USING(run_id)
      LEFT JOIN private.dictionary_creation_validations v USING(run_id)
      LEFT JOIN private.dictionary_creation_commands c ON c.actor_id=r.actor_id AND c.operation_id=r.operation_id
      LEFT JOIN private.dictionary_creation_operations o ON o.actor_id=r.actor_id AND o.operation_id=r.operation_id
      WHERE r.run_id='${f.run}';`
  )
export const counts = (db, f) =>
  json(
    db,
    `SELECT JSONB_BUILD_OBJECT('runs',(SELECT COUNT(*) FROM private.dictionary_creation_runs WHERE entry_id='${f.identity.entry_id}'),
      'recoveries',(SELECT COUNT(*) FROM private.dictionary_creation_recoveries WHERE prior_run_id='${f.run}'),
      'lease',(SELECT TO_JSONB(l) FROM private.dictionary_creation_leases l WHERE entry_id='${f.identity.entry_id}'),
      'revisions',(SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.identity.entry_id}'),
      'head',(SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.identity.entry_id}'));`
  )

// Seed a synthetic immutable frontier at a BIGINT boundary. Production acceptance
// always starts at1; this fixture does not change immutable run bindings in place.
export async function frontier(db, f, fence) {
  const resolutionId = await resolution(db, f)
  const operationId = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_creation_operations(actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,
    evidence_sha256,planned_generation_model,planned_validator_version,planned_policy_sha256,fence)
    SELECT actor_id,'${operationId}','${resolutionId}',identity_id,entry_id,anchor_id,evidence_sha256,
    planned_generation_model,planned_validator_version,planned_policy_sha256,${literal(fence)}::BIGINT
    FROM private.dictionary_creation_operations WHERE actor_id='${f.actor}' AND operation_id='${f.cmd.operation_id}';
    DELETE FROM private.dictionary_creation_leases WHERE run_id='${f.run}';
    INSERT INTO private.dictionary_creation_leases(entry_id,identity_id,actor_id,operation_id,fence)
    VALUES('${f.identity.entry_id}','${f.identity.identity_id}','${f.actor}','${operationId}',${literal(fence)}::BIGINT);`)
  const work = await json(
    db,
    service(
      `SELECT public.get_dictionary_creation_work_v1('${f.actor}','${operationId}');`
    )
  )
  const next = {
    ...f,
    run: work.run_id,
    receipt: work.receipt,
    cmd: {
      protocol_version: 2,
      operation_id: operationId,
      resolution_id: resolutionId,
    },
  }
  const dispatch = (await start(db, next, fence)).dispatch
  await json(
    db,
    service(`SELECT public.record_dictionary_creation_failure_v1('${next.run}',${literal(fence)},
    ${literal(dispatch.input_sha256)},TRUE,${literal(EVIDENCE)});`)
  )
  return next
}
