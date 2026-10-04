import { createHash, randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import {
  canonicalizeJson,
  canonicalizeCefrInput,
} from '../../packages/domain/src/shared-dictionary.ts'
import { literal, owner } from './fixtures.mjs'

export const json = value => `${literal(JSON.stringify(value))}::jsonb`
export const hash = value => createHash('sha256').update(value).digest('hex')
export const asService = sql => `SET ROLE service_role; ${sql}`
export const call = async (db, sql) => JSON.parse(await db.sql(asService(sql)))
export const enqueue = (db, method) =>
  call(db, `SELECT public.enqueue_dictionary_cefr_jobs_v1('${method}');`)
export const claim = (db, method) =>
  call(db, `SELECT public.claim_dictionary_cefr_jobs_v1('${method}');`)
export const settleSql = (job, outcome = 'estimated', patch = {}) => {
  const p = { level: 'A2', confidence: 0.9, retry: null, ...patch }
  return `SELECT public.settle_dictionary_cefr_job_v1('${job.job_id}', '${job.lease_token}', ${job.attempt},
    '${job.input_sha256}', '${job.qualification_sha256}', ${literal(outcome)},
    ${p.level === null ? 'NULL' : literal(p.level)}, ${p.confidence ?? 'NULL'}, ${p.retry ?? 'NULL'});`
}
export const settle = (db, job, outcome, patch) =>
  call(db, settleSql(job, outcome, patch))

export const sourceSql = (
  id,
  kind,
  digest
) => `INSERT INTO private.dictionary_sources
  (source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
  VALUES('${id}', '${kind}', 'fixture://${id}', 'approved', '${owner}', now(), '${digest}');`

export async function methodFixture(
  db,
  { enabled = true, concurrency = 2, attempts = 3, worker } = {}
) {
  const id = randomUUID()
  const source = randomUUID()
  const qualification =
    worker?.qualified.qualification_sha256 ?? hash(`synthetic-${id}`)
  const profile = worker?.inputs.profile ?? {
    namespace: 'dictionary-cefr-method-v1',
    input_schema_version: 1,
    provider: 'synthetic',
    requested_model: 'synthetic-v1',
    resolved_model_version: null,
    method_revision: id,
    prompt_revision: 'TEST-ONLY',
    generation_config: { temperature: 0 },
  }
  const digest = hash(canonicalizeJson(profile))
  await db.sql(`${sourceSql(source, 'provider', qualification)}
    INSERT INTO private.dictionary_cefr_methods(method_id,profile,profile_sha256,qualification_sha256,
      fixture_sha256,report_sha256,policy_sha256,provider_source_id,provider_reuse_policy_ref,review_ref,
      approved_by,approved_at,confidence_threshold,batch_size,max_concurrency,max_attempts,lease_seconds,retry_seconds,enabled)
    VALUES('${id}',${json(profile)},'${digest}','${qualification}','${worker?.report.fixture_sha256 ?? 'a'.repeat(64)}','${worker?.report.sha256 ?? 'b'.repeat(64)}','${worker?.report.policy_sha256 ?? 'c'.repeat(64)}',
      '${source}','TEST-ONLY-reuse','TEST-ONLY-review','${owner}',now(),0.8,100,${concurrency},${attempts},10,1,${enabled});`)
  return { id, source, qualification, profile }
}

export async function entryFixture(
  db,
  { state = 'published', badHash = false } = {}
) {
  const entry = randomUUID()
  const content = JSON.parse(
    await db.sql(
      `SELECT private.official_dictionary_content_v1(${json({
        dutch_lemma: `synthetic-${entry}`,
        part_of_speech: 'noun',
        article: 'de',
        translations: { en: ['synthetic meaning'] },
      })})`
    )
  )
  const revision = randomUUID()
  const source = randomUUID()
  const contentHash = hash(canonicalizeJson(content))
  const inputHash = badHash
    ? 'f'.repeat(64)
    : hash(canonicalizeCefrInput(content))
  await db.sql(`${sourceSql(source, 'editorial', contentHash)}
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
      VALUES('${entry}','nl',${literal(content.dutch_lemma)},'noun','de','synthetic');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,
      source_id,review_status,reviewed_at,published_at)
      VALUES('${revision}','${entry}',1,${json(content)},'${contentHash}','${inputHash}','${source}','published',now(),now());
    INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES('${entry}','${revision}');
    UPDATE public.dictionary_entries SET state='${state}' WHERE entry_id='${entry}';`)
  return { entry, revision, source, content, inputHash }
}

export async function replaceRevision(db, fixture, { mediaOnly = false } = {}) {
  const content = structuredClone(fixture.content)
  if (mediaOnly) content.image_url = 'https://example.invalid/synthetic.png'
  else content.translations.en = ['changed synthetic meaning']
  const revision = randomUUID(),
    source = randomUUID()
  const contentHash = hash(canonicalizeJson(content)),
    inputHash = hash(canonicalizeCefrInput(content))
  await db.sql(`${sourceSql(source, 'editorial', contentHash)}
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,
      source_id,review_status,reviewed_at,published_at)
      SELECT '${revision}','${fixture.entry}',max(revision_no)+1,${json(content)},'${contentHash}','${inputHash}',
        '${source}','published',now(),now() FROM public.dictionary_revisions WHERE entry_id='${fixture.entry}';
    UPDATE public.dictionary_entry_heads SET revision_id='${revision}' WHERE entry_id='${fixture.entry}';`)
  return revision
}

export const reviewerSql = (
  fixture,
  id = randomUUID(),
  status = 'reviewed'
) => `
  INSERT INTO public.dictionary_cefr_assessments(assessment_id,entry_id,input_sha256,cefr_level,status,
    method,method_version,source_id,locked)
  VALUES('${id}','${fixture.entry}','${fixture.inputHash}',${status === 'unknown' ? 'NULL' : "'B2'"},
    '${status}','editorial','TEST-ONLY','${fixture.source}',${status === 'reviewed'});
  INSERT INTO public.dictionary_cefr_heads(entry_id,input_sha256,assessment_id)
    VALUES('${fixture.entry}','${fixture.inputHash}','${id}')
    ON CONFLICT(entry_id,input_sha256) DO UPDATE SET assessment_id=EXCLUDED.assessment_id;`

export async function until(predicate) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await setTimeout(20)
  }
  throw new Error('CEFR concurrency barrier was not reached')
}

export async function holdTransaction(db, sql) {
  const session = db.connect()
  session.child.stdin.write(
    `SET statement_timeout='10s'; SET idle_in_transaction_session_timeout='10s'; BEGIN; ${sql}\n\\echo CEFR_HELD\n`
  )
  await until(() => session.output().includes('CEFR_HELD'))
  return {
    session,
    finish: async () => {
      session.child.stdin.end('COMMIT;\n')
      await session.completed
    },
  }
}
