import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  literal,
  owner,
  other,
  seedUsers,
  seedWord,
  state,
  review,
  assessment,
} from './fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'

let db
const digest = 'a'.repeat(64),
  policy = 'b'.repeat(64),
  VERSION = 'synthetic-history-validator'
const REVERTED = 'reverted',
  CONFLICT = 'head-conflict',
  UNAVAILABLE = 'dictionary-entry-unavailable'
const content = (notes = 'Reviewed common content') => ({
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: ['банк'] },
  examples: [
    {
      nl: 'Ik heb geld bij de bank.',
      en: 'I have money at the bank.',
      ru: null,
    },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'banken',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: notes,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})
const hash = value =>
  createHash('sha256').update(canonicalizeJson(value)).digest('hex')
const cefrHash = value =>
  hash({
    assessment_schema_version: 1,
    content: Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => !['image_url', 'tts_url'].includes(key)
      )
    ),
  })
const json = value => `${literal(JSON.stringify(value))}::JSONB`
const query = sql =>
  db.sql(sql).then(value => (value === '' ? null : JSON.parse(value)))
const rollbackSql = command =>
  `SELECT public.rollback_dictionary_entry_v2(${json(command)});`
const rollback = (command, actor = owner) =>
  query(asUser(actor, rollbackSql(command)))
const sequence = f =>
  db.sql(
    `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${f.entry}' AND change_kind='revision-head';`
  )
const history = (f, before = null, limit = 50, actor = other) =>
  query(
    asUser(
      actor,
      `SELECT public.get_dictionary_entry_history_v2('${f.entry}',${literal(before)},${limit});`
    )
  )
const diff = (f, from = f.original, to = f.current, actor = other) =>
  query(
    asUser(
      actor,
      `SELECT public.get_dictionary_revision_diff_v2('${f.entry}','${from}','${to}');`
    )
  )
const audit = (f, actor = owner) =>
  query(
    asUser(actor, `SELECT public.list_dictionary_rollbacks_v2('${f.entry}');`)
  )
const command = f => ({
  protocol_version: 2,
  operation_id: randomUUID(),
  entry_id: f.entry,
  expected_revision_id: f.current,
  expected_head_sequence: f.sequence,
  target_revision_id: f.original,
  reason: 'Restore prior reviewed content after regression.',
})
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})
async function revision(
  f,
  value = content('Updated analysis'),
  status = 'published'
) {
  const id = randomUUID(),
    source = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES ('${source}','editorial','fixture://human/${source}','approved','${owner}',NOW(),'${hash(value)}');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    VALUES ('${id}','${f.entry}',(SELECT COALESCE(MAX(revision_no),0)+1 FROM public.dictionary_revisions WHERE entry_id='${f.entry}'),${json(value)},'${hash(value)}','${cefrHash(value)}','${source}','${status}',${status === 'draft' ? 'NULL' : 'NOW()'},${status === 'draft' ? 'NULL' : 'NOW()'});`)
  return { id, source, value }
}
async function fixture() {
  await db.sql(`UPDATE private.dictionary_content_runtime SET reads_enabled=TRUE,operations_enabled=TRUE,legacy_guard_enabled=TRUE,
    following_reads_enabled=TRUE,analysis_history_enabled=TRUE,administrator_rollback_enabled=TRUE,
    analysis_operations_enabled=TRUE,analysis_publication_enabled=TRUE;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id IN ('${owner}','${other}');
    INSERT INTO private.dictionary_administrators(user_id,audit_reference) VALUES ('${owner}','fixture://administrator') ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;`)
  const f = { entry: randomUUID() }
  await db.sql(`INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
    VALUES ('${f.entry}','nl','bank','noun','de','financial-institution');`)
  const first = await revision(f, content()),
    second = await revision(f, {
      ...content('Updated reviewed content'),
      image_url: 'https://media.example.invalid/public/dictionary/bank.jpg',
      synonyms: ['geldbank'],
      usage_notes: {
        summary: 'Used for financial institutions.',
        contrasts: [],
      },
    })
  f.original = first.id
  f.current = second.id
  f.source = first.source
  await db.sql(`INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES ('${f.entry}','${first.id}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${f.entry}';
    UPDATE public.dictionary_entry_heads SET revision_id='${second.id}' WHERE entry_id='${f.entry}';`)
  f.sequence = await sequence(f)
  return f
}
async function effects(f) {
  return query(`SELECT JSONB_BUILD_OBJECT('head',(SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${f.entry}'),
    'sequence',(SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${f.entry}' AND change_kind='revision-head'),
    'revisions',(SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.entry}'),
    'audit',(SELECT COUNT(*) FROM private.dictionary_head_rollbacks WHERE entry_id='${f.entry}'),
    'quota',(SELECT COALESCE(SUM(request_count),0) FROM public.edge_function_rate_limits));`)
}
async function following(f, actor = owner) {
  const word = await seedWord(db, actor, {
    intervalDays: 9,
    repetitionCount: 4,
    easinessFactor: 2.8,
  })
  await db.sql(`UPDATE public.words SET dictionary_entry_id='${f.entry}',dictionary_revision_id='${f.current}',dictionary_content_mode='follow' WHERE word_id='${word}';
    INSERT INTO public.word_content_state(word_id,user_id,content_version,overrides) VALUES ('${word}','${actor}',1,'{}');`)
  return word
}
async function ready(f) {
  const anchor = randomUUID(),
    op = randomUUID(),
    candidate = content('Validated publication racing rollback')
  await db.sql(`INSERT INTO private.dictionary_meaning_anchors(anchor_id,entry_id,source_id,gloss,examples,verified_by,verified_at,audit_reference,anchor_sha256)
    VALUES ('${anchor}','${f.entry}','${f.source}','A financial institution that holds money.','["Ik heb geld bij de bank."]','${owner}',NOW(),'fixture://anchor','${digest}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id,anchor_id) VALUES ('${f.entry}','${anchor}');
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,media_url_prefixes,audit_reference)
    VALUES ('${VERSION}','${policy}',TRUE,ARRAY['https://media.example.invalid/public/dictionary/'],'fixture://policy') ON CONFLICT DO NOTHING;`)
  const input = {
    protocol_version: 2,
    operation_id: op,
    entry_id: f.entry,
    expected_revision_id: f.current,
    expected_head_sequence: f.sequence,
  }
  const receipt = await query(
    asUser(
      other,
      `SELECT public.accept_dictionary_analysis_v2(${json(input)});`
    )
  )
  await db.sql(
    `SET ROLE service_role; SELECT public.start_dictionary_analysis_dispatch_v1('${other}','${op}','${receipt.fence}','synthetic-provider','synthetic-model','${digest}');`
  )
  const result = await query(
    `SET ROLE service_role; SELECT public.journal_dictionary_analysis_result_v1('${other}','${op}','${receipt.fence}',${json({ content: candidate })},'synthetic-result');`
  )
  const anchorHash = await db.sql(
    `SELECT anchor_sha256 FROM private.dictionary_meaning_anchors WHERE anchor_id='${anchor}';`
  )
  const packet = {
    validator_version: VERSION,
    policy_sha256: policy,
    anchor_sha256: anchorHash,
    input_sha256: digest,
    result_sha256: result.result_sha256,
    meaning_evidence_sha256: digest,
    outcome: 'accepted',
    decision_code: 'same-meaning',
    content: candidate,
    content_sha256: hash(candidate),
    cefr_input_sha256: cefrHash(candidate),
  }
  const validation = await query(
    `SET ROLE service_role; SELECT public.record_dictionary_analysis_validation_v1('${other}','${op}','${receipt.fence}',${json(packet)});`
  )
  return `SET ROLE service_role; SELECT public.publish_dictionary_analysis_v1('${other}','${op}','${receipt.fence}','${validation.validation_id}');`
}

test('history/rollback flags default off and do not grant roles, link cards or fabricate audit/provider work', async () => {
  assert.deepEqual(
    await query(
      "SELECT JSONB_BUILD_OBJECT('history',analysis_history_enabled,'rollback',administrator_rollback_enabled) FROM private.dictionary_content_runtime;"
    ),
    { history: false, rollback: false }
  )
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM private.dictionary_head_rollbacks;'),
    '0'
  )
  const f = await fixture(),
    request = command(f)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_history_enabled=FALSE,administrator_rollback_enabled=FALSE;'
  )
  await assert.rejects(history(f), /dictionary-history-disabled/)
  await assert.rejects(rollback(request), /administrator-rollback-disabled/)
  assert.equal((await effects(f)).audit, 0)
})
test('administrator rollback emits one newer event, returns current content to both followers and preserves all learning/adoption', async () => {
  const f = await fixture(),
    a = await following(f),
    b = await following(f, other)
  await review(db, assessment(a))
  await review(db, assessment(b), other)
  const before = [await state(db, a), await state(db, b)],
    effect = await effects(f),
    request = command(f)
  const receipt = await rollback(request)
  assert.equal(receipt.outcome, REVERTED)
  assert.equal(receipt.applied_revision_id, f.original)
  assert(BigInt(receipt.applied_head_sequence) > BigInt(f.sequence))
  assert.deepEqual([await state(db, a), await state(db, b)], before)
  const after = await effects(f)
  assert.equal(after.revisions, effect.revisions)
  assert.equal(after.quota, effect.quota)
  for (const actor of [owner, other]) {
    const ids = actor === owner ? [a] : [b]
    const response = await query(
      asUser(
        actor,
        `SELECT public.get_dictionary_effective_content_v2(ARRAY[${ids.map(literal).join(',')}]::UUID[]);`
      )
    )
    assert(
      response.revisions.some(
        r =>
          r.revision_id === f.original &&
          r.content.analysis_notes === 'Reviewed common content'
      )
    )
  }
  const page = await history(f)
  assert.equal(page.events[0].kind, 'rollback')
  assert.equal(page.events[0].revision_no, 1)
  assert.equal(page.events[0].head_sequence, receipt.applied_head_sequence)
})
test('lost rollback replies replay after later head/moves/learning and role/flag revocation without another event', async () => {
  const f = await fixture(),
    word = await following(f),
    request = command(f),
    saved = await rollback(request)
  await review(db, assessment(word))
  await db.sql(`UPDATE public.dictionary_entry_heads SET revision_id='${f.current}' WHERE entry_id='${f.entry}';
    UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${owner}';
    UPDATE private.dictionary_content_runtime SET administrator_rollback_enabled=FALSE;`)
  const before = await effects(f),
    learning = await state(db, word)
  assert.deepEqual(await rollback(request), { ...saved, idempotent: true })
  assert.deepEqual(await effects(f), before)
  assert.deepEqual(await state(db, word), learning)
  await assert.rejects(
    rollback({ ...request, reason: 'Changed reason' }),
    /rollback-operation-payload-conflict/
  )
})
test('ordinary full_access, read_only and unverified identities cannot rollback; read_only administrators can', async () => {
  const f = await fixture(),
    request = command(f)
  await assert.rejects(rollback(request, other), /administrator-required/)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id IN ('${owner}','${other}');`
  )
  await assert.rejects(rollback(request, other), /administrator-required/)
  await assert.rejects(rollback(request, null), /authentication-required/)
  await assert.rejects(
    rollback(request, randomUUID()),
    /authentication-required/
  )
  assert.equal((await rollback(request)).outcome, REVERTED)
})
test('nonce payload, injected actor/learning, numeric/overflow sequences and invalid reasons fail before mutation', async () => {
  const f = await fixture(),
    request = command(f)
  for (const patch of [
    { actor_id: other },
    { repetition_count: 0 },
    { protocol_version: 1 },
    { reason: ' ' },
    { reason: '😀'.repeat(501) },
    { expected_head_sequence: Number(f.sequence) },
    { expected_head_sequence: '01' },
    { expected_head_sequence: '9223372036854775808' },
  ]) {
    await assert.rejects(
      rollback({ ...request, ...patch }),
      /invalid-rollback-command/
    )
  }
  assert.equal((await effects(f)).audit, 0)
  const saved = await rollback(request)
  await assert.rejects(
    rollback({ ...request, target_revision_id: f.current }),
    /rollback-operation-payload-conflict/
  )
  assert.deepEqual(await rollback(request), { ...saved, idempotent: true })
})
test('same-entry published targets only; drafts, retired revisions, foreign entries and missing IDs cannot become heads', async () => {
  const f = await fixture(),
    g = await fixture(),
    draft = await revision(f, content('Draft'), 'draft'),
    retired = await revision(f, content('Retired'), 'retired'),
    before = await effects(f)
  for (const target of [draft.id, retired.id, g.original, randomUUID()])
    await assert.rejects(
      rollback({ ...command(f), target_revision_id: target }),
      /invalid-rollback-target/
    )
  assert.deepEqual(await effects(f), before)
})
test('stale/ABA head sequences yield durable conflicts; same-head no-change creates audit but no delivery event', async () => {
  const f = await fixture(),
    stale = command(f)
  await db.sql(`UPDATE public.dictionary_entry_heads SET revision_id='${f.original}' WHERE entry_id='${f.entry}';
    UPDATE public.dictionary_entry_heads SET revision_id='${f.current}' WHERE entry_id='${f.entry}';`)
  const saved = await rollback(stale)
  assert.equal(saved.outcome, CONFLICT)
  assert.equal(saved.applied_revision_id, f.current)
  assert.notEqual(saved.applied_head_sequence, f.sequence)
  assert.deepEqual(await rollback(stale), { ...saved, idempotent: true })
  const current = await sequence(f),
    before = await effects(f)
  const noChange = await rollback({
    ...command(f),
    expected_head_sequence: current,
    target_revision_id: f.current,
  })
  assert.equal(noChange.outcome, 'no-change')
  assert.equal((await effects(f)).sequence, before.sequence)
})
test('retired entries reject new head changes and hide new common history/diff; old follow reads retain content', async () => {
  const f = await fixture(),
    word = await following(f)
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${f.entry}';`
  )
  const response = await rollback(command(f))
  assert.equal(response.outcome, 'entry-unavailable')
  assert.equal(response.applied_revision_id, null)
  await assert.rejects(history(f), new RegExp(UNAVAILABLE))
  await assert.rejects(diff(f), new RegExp(UNAVAILABLE))
  const result = await query(
    asUser(
      owner,
      `SELECT public.get_dictionary_effective_content_v2(ARRAY['${word}']::UUID[]);`
    )
  )
  assert(result.revisions.some(r => r.revision_id === f.current))
})
test('history pages order by event sequence rather than revision number, keep ABA events and redact private audit reasons/actors', async () => {
  const f = await fixture(),
    saved = await rollback(command(f)),
    first = await history(f, null, 1)
  assert.equal(first.events.length, 1)
  assert.equal(first.next_before, saved.applied_head_sequence)
  const second = await history(f, first.next_before, 1),
    last = await history(f, second.next_before, 1)
  assert.equal(second.events[0].revision_id, f.current)
  assert.equal(last.events[0].revision_id, f.original)
  assert.equal(last.next_before, null)
  const publicJson = JSON.stringify(await history(f))
  assert(!publicJson.includes('actor_id'))
  assert(!publicJson.includes('Restore prior'))
  assert(!publicJson.includes('source_id'))
  assert(!publicJson.includes('provider_request_id'))
  const page = await audit(f)
  assert.equal(page[0].actor_id, owner)
  assert.equal(page[0].receipt.reason, command(f).reason)
  await assert.rejects(audit(f, other), /administrator-required/)
  await assert.rejects(history(f, '01'), /invalid-history-page/)
  await assert.rejects(history(f, null, 101), /invalid-history-page/)
  await assert.rejects(
    query(
      asUser(
        owner,
        `SELECT public.list_dictionary_rollbacks_v2('${f.entry}',50,NOW(),NULL);`
      )
    ),
    /invalid-rollback-audit-page/
  )
})
test('full field-level diff preserves nested values, explicit null and media; foreign/draft IDs and private content stay unavailable', async () => {
  const f = await fixture(),
    result = await diff(f)
  assert.deepEqual(
    result.changes.map(c => c.field),
    ['analysis_notes', 'image_url', 'synonyms', 'usage_notes']
  )
  assert.equal(result.changes[1].before, null)
  assert.equal(result.changes[1].after, result.to_content.image_url)
  assert.deepEqual(result.changes[3].after, result.to_content.usage_notes)
  assert.deepEqual((await diff(f, f.original, f.original)).changes, [])
  const foreign = await fixture(),
    draft = await revision(f, content('Unpublished'), 'draft')
  for (const id of [foreign.current, draft.id, randomUUID()])
    await assert.rejects(
      diff(f, f.original, id),
      /dictionary-revision-unavailable/
    )
  assert(!JSON.stringify(result).includes('source_id'))
})
test('client/service direct audit access and service/anonymous rollback/history wrappers are denied', async () => {
  const f = await fixture()
  for (const role of ['authenticated', 'anon', 'service_role'])
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT * FROM private.dictionary_head_rollbacks;`
      ),
      /permission denied/
    )
  for (const role of ['anon', 'service_role']) {
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${rollbackSql(command(f))}`),
      /permission denied/
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.get_dictionary_entry_history_v2('${f.entry}');`
      ),
      /permission denied/
    )
  }
})
test('an audit insertion failure atomically rolls back the changed head, event, cursor and receipt; retry applies once', async () => {
  const f = await fixture(),
    request = command(f),
    before = await effects(f),
    cursor = await db.sql(
      'SELECT committed_version FROM private.dictionary_delivery_cursor;'
    )
  await db.sql(`CREATE FUNCTION private.reject_fixture_rollback() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-audit-failure'; END; $$;
    CREATE TRIGGER reject_fixture_rollback BEFORE INSERT ON private.dictionary_head_rollbacks FOR EACH ROW EXECUTE FUNCTION private.reject_fixture_rollback();`)
  try {
    await assert.rejects(rollback(request), /fixture-audit-failure/)
  } finally {
    await db.sql(
      'DROP TRIGGER reject_fixture_rollback ON private.dictionary_head_rollbacks; DROP FUNCTION private.reject_fixture_rollback();'
    )
  }
  assert.deepEqual(await effects(f), before)
  assert.equal(
    await db.sql(
      'SELECT committed_version FROM private.dictionary_delivery_cursor;'
    ),
    cursor
  )
  assert.equal((await rollback(request)).outcome, REVERTED)
})
test('real overlap: identical rollback replays once; concurrent distinct choices cannot overwrite the winning head', async () => {
  const f = await fixture(),
    request = command(f)
  assert.equal(
    JSON.parse(await overlap(db, rollbackSql(request), rollbackSql(request)))
      .idempotent,
    true
  )
  assert.equal((await effects(f)).audit, 1)
  const g = await fixture(),
    a = command(g),
    b = { ...command(g), target_revision_id: g.current }
  assert.equal(
    JSON.parse(await overlap(db, rollbackSql(a), rollbackSql(b))).outcome,
    CONFLICT
  )
  assert.equal((await effects(g)).head, g.original)
})
test('real overlap: validated publication-first conflicts rollback; rollback-first fences waiting validated publication without extra quota', async () => {
  const f = await fixture(),
    publish = await ready(f)
  assert.equal(
    JSON.parse(await overlap(db, publish, rollbackSql(command(f)))).outcome,
    CONFLICT
  )
  const g = await fixture(),
    waiting = await ready(g),
    request = command(g),
    before = await effects(g)
  assert.equal(
    JSON.parse(await overlap(db, rollbackSql(request), waiting)).status,
    CONFLICT
  )
  assert.equal((await effects(g)).head, g.original)
  assert.equal((await effects(g)).quota, before.quota)
  assert.equal((await effects(g)).revisions, before.revisions)
})
test('real overlap: administrator revocation wins before rollback authorization; rollback holds authority through its commit', async () => {
  const f = await fixture(),
    request = command(f)
  await assert.rejects(
    overlap(
      db,
      `SET ROLE service_role; UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${owner}';`,
      rollbackSql(request)
    ),
    /administrator-required/
  )
  assert.equal((await effects(f)).audit, 0)
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=TRUE WHERE user_id='${owner}';`
  )
  await overlap(
    db,
    rollbackSql(request),
    `SET ROLE service_role; UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${owner}';`
  )
  assert.equal((await effects(f)).head, f.original)
})
test('audit cannot be mutated/deleted; Auth deletion redacts only actor and preserves head/history and other owners learning', async () => {
  const f = await fixture(),
    actor = randomUUID(),
    word = await following(f, other),
    before = await state(db, word)
  await db.sql(`INSERT INTO auth.users(id,email) VALUES ('${actor}','${actor}@example.invalid');
    INSERT INTO private.dictionary_administrators(user_id,audit_reference) VALUES ('${actor}','fixture://temporary-admin');`)
  await rollback(command(f), actor)
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_head_rollbacks SET actor_id=NULL WHERE actor_id='${actor}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_head_rollbacks WHERE actor_id='${actor}';`
    ),
    /immutable/
  )
  await db.sql(`DELETE FROM auth.users WHERE id='${actor}';`)
  assert.equal((await audit(f))[0].actor_id, null)
  assert.equal((await effects(f)).head, f.original)
  assert.equal((await history(f)).events[0].kind, 'rollback')
  assert.deepEqual(await state(db, word), before)
})

test('emergency rollback works with provider/publication gates disabled and audit tuple pagination does not repeat entries', async () => {
  const f = await fixture(),
    request = command(f)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=FALSE,analysis_publication_enabled=FALSE;'
  )
  const saved = await rollback(request)
  assert.equal(saved.outcome, REVERTED)
  const second = {
    ...command(f),
    expected_revision_id: f.original,
    expected_head_sequence: saved.applied_head_sequence,
    target_revision_id: f.original,
  }
  assert.equal((await rollback(second)).outcome, 'no-change')
  const first = await query(
    asUser(owner, `SELECT public.list_dictionary_rollbacks_v2('${f.entry}',1);`)
  )
  assert.equal(first[0].receipt.operation_id, second.operation_id)
  const following = await query(
    asUser(
      owner,
      `SELECT public.list_dictionary_rollbacks_v2('${f.entry}',1,${literal(first[0].created_at)}::TIMESTAMPTZ,'${first[0].audit_id}');`
    )
  )
  assert.equal(following[0].receipt.operation_id, request.operation_id)
  assert.equal((await audit(f)).length, 2)
})
