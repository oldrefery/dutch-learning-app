import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal, owner, other, seedUsers } from './fixtures.mjs'

const admin = '33333333-3333-4333-8333-333333333333'
const digest = 'a'.repeat(64)
const UNKNOWN = 'provider-outcome-unknown'
const FAILED = 'provider-failed'
const REVOKED = 'authorization-revoked'
const busy = { protocol_version: 2, outcome: 'analysis-in-progress' }
let db
const json = text =>
  db.sql(text).then(value => (value === '' ? null : JSON.parse(value)))
const service = sql => `SET ROLE service_role; ${sql}`
const command = fixture => ({
  protocol_version: 2,
  operation_id: randomUUID(),
  entry_id: fixture.entry,
  expected_revision_id: fixture.revision,
  expected_head_sequence: fixture.sequence,
})
const accept = (request, user = owner) =>
  json(
    asUser(
      user,
      `SELECT public.accept_dictionary_analysis_v2(${literal(JSON.stringify(request))}::JSONB);`
    )
  )
const get = (id, user = owner) =>
  json(
    asUser(user, `SELECT public.get_dictionary_analysis_operation_v2('${id}');`)
  )
const start = (request, fence = '1', user = owner, hash = digest) =>
  json(
    service(`SELECT public.start_dictionary_analysis_dispatch_v1(
  '${user}', '${request.operation_id}', ${literal(fence)}, 'synthetic-provider', 'synthetic-model', '${hash}');`)
  )
const journal = (
  request,
  fence = '1',
  result = { synthetic: 'returned result' },
  requestId = 'fixture-request',
  user = owner
) =>
  json(
    service(`SELECT public.journal_dictionary_analysis_result_v1('${user}', '${request.operation_id}', ${literal(fence)},
    ${literal(JSON.stringify(result))}::JSONB, ${literal(requestId)});`)
  )
const failure = (
  request,
  outcome,
  evidence = null,
  fence = '1',
  user = owner
) =>
  json(
    service(`SELECT public.record_dictionary_analysis_failure_v1(
  '${user}', '${request.operation_id}', '${fence}', '${outcome}', ${literal(evidence)});`)
  )
const count = (user = owner) =>
  db
    .sql(
      `SELECT COALESCE((SELECT request_count FROM public.edge_function_rate_limits WHERE user_id='${user}' AND capability='gemini-analysis'), 0);`
    )
    .then(Number)
const expire = entry =>
  db.sql(
    `UPDATE private.dictionary_analysis_leases SET expires_at=NOW()-INTERVAL '1 second' WHERE entry_id='${entry}';`
  )

async function fixture({ anchor = true } = {}) {
  await db.sql(`DELETE FROM public.edge_function_rate_limits;
    UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=TRUE, analysis_quota_limit=10, analysis_quota_window_seconds=60 WHERE singleton;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';
    UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id IN ('${other}', '${admin}');
    INSERT INTO private.dictionary_administrators(user_id, granted_by, audit_reference) VALUES ('${admin}', '${owner}', 'fixture://grant')
      ON CONFLICT (user_id) DO UPDATE SET enabled=TRUE;`)
  const entry = randomUUID()
  const revision = randomUUID()
  const source = randomUUID()
  const anchorId = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator, review_state,
      reviewed_by, reviewed_at, approved_content_sha256) VALUES ('${source}', 'editorial', 'fixture://human/${source}', 'approved', '${owner}', NOW(), '${digest}');
    INSERT INTO public.dictionary_entries(entry_id, language_code, lemma, part_of_speech, article, sense_key)
      VALUES ('${entry}', 'nl', 'bank', 'noun', 'de', 'financial-institution');
    INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, content, content_sha256,
      cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
      VALUES ('${revision}', '${entry}', 1, '{}', '${digest}', '${digest}', '${source}', 'published', NOW(), NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id, revision_id) VALUES ('${entry}', '${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';`)
  if (anchor) await addAnchor(entry, source, anchorId)
  return {
    entry,
    revision,
    source,
    anchor: anchorId,
    sequence: await db.sql(
      `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND change_kind='revision-head';`
    ),
  }
}
async function addAnchor(entry, source, id = randomUUID()) {
  await db.sql(
    service(`INSERT INTO private.dictionary_meaning_anchors(anchor_id, entry_id, source_id, gloss, examples,
    verified_by, verified_at, audit_reference, anchor_sha256) VALUES ('${id}', '${entry}', '${source}',
    'A financial institution that holds money.', '["Ik heb geld bij de bank."]', '${owner}', NOW(), 'fixture://human-anchor', '${digest}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id, anchor_id) VALUES ('${entry}', '${id}')
      ON CONFLICT (entry_id) DO UPDATE SET anchor_id=EXCLUDED.anchor_id;`)
  )
  return id
}
async function advanceAndRollback(f) {
  const revision = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, content, content_sha256,
    cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
    VALUES ('${revision}', '${f.entry}', 2, '{}', '${digest}', '${digest}', '${f.source}', 'published', NOW(), NOW());
    UPDATE public.dictionary_entry_heads SET revision_id='${revision}' WHERE entry_id='${f.entry}';
    UPDATE public.dictionary_entry_heads SET revision_id='${f.revision}' WHERE entry_id='${f.entry}';`)
}
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${admin}', 'admin-fixture@example.invalid');`
  )
})
after(async () => {
  await db?.close()
})

test('acceptance defaults off and the existing 10/60 quota and capability remain unchanged', async () => {
  assert.equal(
    await db.sql(
      'SELECT analysis_operations_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  const config = await readFile('packages/domain/src/app-config.ts', 'utf8')
  const configuredLimit = Number(
    /GEMINI_ANALYSIS_LIMIT:\s*(\d+)/.exec(config)[1]
  )
  const configuredWindow = Number(/WINDOW_SECONDS:\s*(\d+)/.exec(config)[1])
  assert.equal(
    Number(
      await db.sql(
        'SELECT analysis_quota_limit FROM private.dictionary_content_runtime;'
      )
    ),
    configuredLimit
  )
  assert.equal(
    Number(
      await db.sql(
        'SELECT analysis_quota_window_seconds FROM private.dictionary_content_runtime;'
      )
    ),
    configuredWindow
  )
  const f = await fixture()
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=FALSE;'
  )
  await assert.rejects(accept(command(f)), /shared-analysis-disabled/)
  assert.equal(await count(), 0)
  assert.equal(
    (
      await json(
        asUser(owner, 'SELECT public.dictionary_content_capability_v2();')
      )
    ).shared_analysis_enabled,
    false
  )
})

test('verified full_access or trusted read_only administrator qualify; ordinary read_only and unknown actors fail', async () => {
  const f = await fixture()
  await assert.rejects(
    accept(command(f), other),
    /analysis-permission-required/
  )
  await assert.rejects(accept(command(f), null), /authentication-required/)
  await assert.rejects(
    accept(command(f), randomUUID()),
    /authentication-required/
  )
  assert.equal(await count(other), 0)
  assert.equal((await accept(command(f), admin)).status, 'accepted')
  assert.equal(await count(admin), 1)
  await assert.rejects(
    db.sql(
      asUser(
        other,
        `INSERT INTO private.dictionary_administrators(user_id, audit_reference) VALUES ('${other}', 'forged');`
      )
    ),
    /permission denied/
  )
})

test('command rejects injected actor, private prompts, malformed IDs and noncanonical sequence before charging quota', async () => {
  const f = await fixture()
  for (const bad of [
    { ...command(f), actor_id: other },
    { ...command(f), prompt: 'private original' },
    { ...command(f), expected_head_sequence: 1 },
    { ...command(f), expected_head_sequence: '01' },
    { ...command(f), expected_head_sequence: '9223372036854775808' },
    { ...command(f), operation_id: 'bad-id' },
    { ...command(f), protocol_version: 1 },
  ])
    await assert.rejects(accept(bad), /invalid-analysis-command/)
  assert.equal(await count(), 0)
})

test('missing meaning anchor denies reanalysis without altering the existing published head', async () => {
  const f = await fixture({ anchor: false })
  await assert.rejects(accept(command(f)), /meaning-anchor-required/)
  assert.equal(
    await db.sql(
      `SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${f.entry}';`
    ),
    f.revision
  )
  assert.equal(await count(), 0)
})

test('anchors require explicit human source evidence and freeze both anchor and referenced provenance', async () => {
  const f = await fixture()
  await assert.rejects(
    db.sql(
      service(
        `UPDATE private.dictionary_meaning_anchors SET gloss='generated replacement' WHERE anchor_id='${f.anchor}';`
      )
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_meaning_anchors SET gloss='replacement' WHERE anchor_id='${f.anchor}';`
    ),
    /immutable/
  )
  assert.notEqual(
    await db.sql(
      `SELECT anchor_sha256 FROM private.dictionary_meaning_anchors WHERE anchor_id='${f.anchor}';`
    ),
    digest
  )
  const source = randomUUID()
  await db.sql(
    `INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator) VALUES ('${source}', 'provider', 'fixture://unapproved');`
  )
  await assert.rejects(addAnchor(f.entry, source), /unverified-meaning-anchor/)
  await db.sql(
    `UPDATE private.dictionary_sources SET review_state='approved', reviewed_by='${owner}', reviewed_at=NOW(), approved_content_sha256='${digest}' WHERE source_id='${source}';`
  )
  await addAnchor(f.entry, source)
  await assert.rejects(
    db.sql(
      service(
        `UPDATE private.dictionary_sources SET provenance_locator='fixture://changed' WHERE source_id='${source}';`
      )
    ),
    /immutable/
  )
})

test('concurrent exact retries reserve one operation, fence and quota; changed request conflicts', async () => {
  const f = await fixture()
  const request = command(f)
  const receipts = await Promise.all([
    accept(request),
    accept(request),
    accept(request),
  ])
  assert.deepEqual(receipts[0], receipts[1])
  assert.deepEqual(receipts[1], receipts[2])
  assert.equal(receipts[0].fence, '1')
  assert.equal(receipts[0].quota_charged, true)
  assert.equal(await count(), 1)
  await assert.rejects(
    accept({ ...request, expected_head_sequence: '0' }),
    /operation-payload-conflict/
  )
  assert.equal(await count(), 1)
})

test('different concurrent actors on one entry yield one accepted attempt and one busy outcome without extra quota', async () => {
  const f = await fixture()
  const receipts = await Promise.all([
    accept(command(f)),
    accept(command(f), admin),
  ])
  assert.equal(
    receipts.filter(receipt => receipt.status === 'accepted').length,
    1
  )
  assert.deepEqual(
    receipts.find(receipt => receipt.outcome),
    busy
  )
  assert.equal((await count()) + (await count(admin)), 1)
})

test('quota denial rolls back operation and lease reservation atomically', async () => {
  const f = await fixture()
  const request = command(f)
  await db.sql(
    `INSERT INTO public.edge_function_rate_limits(user_id,capability,request_count) VALUES ('${owner}','gemini-analysis',10);`
  )
  await assert.rejects(accept(request), /rate-limit-exceeded/)
  assert.equal(await get(request.operation_id), null)
  assert.equal(await count(), 10)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_analysis_leases WHERE entry_id='${f.entry}';`
    ),
    '0'
  )
})

test('ABA change rejects stale acceptance and stale dispatch even when the revision ID is restored', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await advanceAndRollback(f)
  await assert.rejects(accept(command(f)), /head-conflict/)
  const response = await start(request)
  assert.equal(response.receipt.status, 'head-conflict')
  assert.equal(response.dispatch, null)
  assert.equal(await count(), 1)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.entry}';`
    ),
    '2'
  )
})

test('dispatch exposes only protected shared input once; retries never redispatch and metadata conflicts fail', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  const response = await start(request)
  assert.equal(response.receipt.status, 'dispatching')
  assert.equal(response.dispatch.entry.sense_key, 'financial-institution')
  assert.equal(response.dispatch.anchor.anchor_id, f.anchor)
  assert.equal(Object.hasOwn(response.dispatch, 'private_content'), false)
  assert.equal((await start(request)).dispatch, null)
  await assert.rejects(
    start(request, '1', owner, 'b'.repeat(64)),
    /operation-payload-conflict/
  )
  assert.equal(await count(), 1)
})

test('revoked full_access or revoked administrator abort dispatch durably while preserving receipts', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.equal((await start(request)).receipt.status, REVOKED)
  assert.equal((await accept(request)).status, REVOKED)
  const adminRequest = command(f)
  await accept(adminRequest, admin)
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${admin}';`
  )
  assert.equal((await start(adminRequest, '2', admin)).receipt.status, REVOKED)
  assert.equal((await count()) + (await count(admin)), 2)
})

test('a changed verified anchor aborts dispatch rather than changing the protected input', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await addAnchor(f.entry, f.source)
  assert.equal(
    (await start(request)).receipt.error_code,
    'meaning-anchor-changed'
  )
})

test('pre-dispatch lease expiry permits an explicit new operation with a higher fence and no old dispatch', async () => {
  const f = await fixture()
  const oldRequest = command(f)
  await accept(oldRequest)
  await expire(f.entry)
  const next = command(f)
  assert.equal((await accept(next)).fence, '2')
  assert.equal(
    (await get(oldRequest.operation_id)).error_code,
    'lease-expired-before-dispatch'
  )
  assert.equal((await start(oldRequest)).dispatch, null)
  await assert.rejects(start(next, '1'), /stale-analysis-fence/)
  assert.equal(await count(), 2)
})

test('result journal is immutable and idempotent; request/result changes fail without touching heads', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await assert.rejects(journal(request), /invalid-analysis-transition/)
  await start(request)
  const first = await journal(request)
  assert.equal(first.status, 'validating')
  assert.match(first.result_sha256, /^[0-9a-f]{64}$/)
  assert.deepEqual(await journal(request), first)
  assert.equal((await start(request)).dispatch, null)
  await assert.rejects(
    journal(request, '1', { synthetic: 'changed' }),
    /operation-payload-conflict/
  )
  await assert.rejects(
    journal(request, '1', undefined, 'different-request'),
    /operation-payload-conflict/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_analysis_results SET result='{}' WHERE operation_id='${request.operation_id}';`
    ),
    /immutable/
  )
  assert.equal(
    await db.sql(
      `SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${f.entry}';`
    ),
    f.revision
  )
  assert.equal(await count(), 1)
})

test('unknown provider outcome is quarantined; expiry cannot authorize retry, explicit known failure evidence can', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await start(request)
  await expire(f.entry)
  assert.deepEqual(await accept(command(f)), busy)
  assert.equal((await get(request.operation_id)).status, UNKNOWN)
  assert.equal((await start(request)).dispatch, null)
  assert.deepEqual(await accept(command(f)), busy)
  await assert.rejects(failure(request, FAILED), /invalid-provider-outcome/)
  assert.equal(await count(), 1)
  const resolved = await failure(request, FAILED, digest)
  assert.deepEqual(await failure(request, FAILED, digest), resolved)
  await assert.rejects(
    failure(request, FAILED, 'b'.repeat(64)),
    /operation-payload-conflict/
  )
  assert.equal((await accept(command(f))).fence, '2')
  await assert.rejects(journal(request), /invalid-analysis-transition/)
  assert.equal(await count(), 2)
})

test('late returned results are journaled but quarantined instead of silently validated', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await start(request)
  await expire(f.entry)
  const receipt = await journal(request)
  assert.equal(receipt.status, UNKNOWN)
  assert.equal(receipt.error_code, 'late-provider-result')
  assert.deepEqual(await journal(request), receipt)
  assert.deepEqual(await accept(command(f)), busy)
  await assert.rejects(
    failure(request, FAILED, digest),
    /invalid-analysis-transition/
  )
  assert.equal(await count(), 1)
})

test('receipts and bounded owner/admin history redact actor and provider results; clients cannot call worker RPCs or tables', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await start(request)
  await journal(request)
  const receipt = await get(request.operation_id)
  assert.equal(Object.hasOwn(receipt, 'actor_id'), false)
  assert.equal(Object.hasOwn(receipt, 'result'), false)
  assert.equal(Object.hasOwn(receipt, 'provider'), false)
  assert.equal(await get(request.operation_id, other), null)
  const page = await json(
    asUser(owner, 'SELECT public.list_dictionary_analysis_operations_v2(1);')
  )
  assert.equal(page.length, 1)
  assert.equal(page[0].receipt.operation_id, request.operation_id)
  const nextPage = await json(
    asUser(
      owner,
      `SELECT public.list_dictionary_analysis_operations_v2(100, ${literal(page[0].created_at)}::TIMESTAMPTZ, '${request.operation_id}');`
    )
  )
  assert.ok(
    nextPage.every(item => item.receipt.operation_id !== request.operation_id)
  )
  await assert.rejects(
    db.sql(
      asUser(
        other,
        `SELECT public.list_dictionary_analysis_operations_v2(1, NULL, NULL, '${owner}');`
      )
    ),
    /administrator-required/
  )
  assert.equal(
    (
      await json(
        asUser(
          admin,
          `SELECT public.list_dictionary_analysis_operations_v2(1, NULL, NULL, '${owner}');`
        )
      )
    )[0].receipt.operation_id,
    request.operation_id
  )
  for (const limit of [0, 101])
    await assert.rejects(
      db.sql(
        asUser(
          owner,
          `SELECT public.list_dictionary_analysis_operations_v2(${limit});`
        )
      ),
      /invalid-analysis-page/
    )
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.start_dictionary_analysis_dispatch_v1('${owner}', '${request.operation_id}', '1', 'fake', 'fake', '${digest}');`
      ),
      /permission denied/
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.journal_dictionary_analysis_result_v1('${owner}', '${request.operation_id}', '1', '{}', 'fake');`
      ),
      /permission denied/
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.record_dictionary_analysis_failure_v1('${owner}', '${request.operation_id}', '1', ${literal(FAILED)}, '${digest}');`
      ),
      /permission denied/
    )
    for (const table of [
      'dictionary_administrators',
      'dictionary_meaning_anchors',
      'dictionary_meaning_anchor_heads',
      'dictionary_analysis_operations',
      'dictionary_analysis_leases',
      'dictionary_analysis_results',
    ])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; SELECT * FROM private.${table};`),
        /permission denied/
      )
  }
  await assert.rejects(
    db.sql(
      service(
        `UPDATE private.dictionary_analysis_operations SET status='published' WHERE operation_id='${request.operation_id}';`
      )
    ),
    /permission denied/
  )
})

test('Auth deletion removes private result/receipt state and leaves the entry lease reusable', async () => {
  const f = await fixture()
  const actor = randomUUID()
  await db.sql(`INSERT INTO auth.users(id,email) VALUES ('${actor}', 'temporary-fixture@example.invalid');
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${actor}';`)
  const request = command(f)
  await accept(request, actor)
  await start(request, '1', actor)
  await journal(request, '1', undefined, 'fixture-request', actor)
  await db.sql(`DELETE FROM auth.users WHERE id='${actor}';`)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_analysis_operations WHERE actor_id='${actor}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_analysis_results WHERE actor_id='${actor}';`
    ),
    '0'
  )
  assert.equal((await accept(command(f))).fence, '2')
})

test('a response arriving after durable unknown status is still journaled and remains quarantined', async () => {
  const f = await fixture()
  const request = command(f)
  await accept(request)
  await start(request)
  await failure(request, UNKNOWN)
  const receipt = await journal(request)
  assert.equal(receipt.status, UNKNOWN)
  assert.match(receipt.result_sha256, /^[0-9a-f]{64}$/)
  assert.deepEqual(await accept(command(f)), busy)
  assert.equal(await count(), 1)
})
