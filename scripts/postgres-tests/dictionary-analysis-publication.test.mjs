import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import {
  canonicalizeJson,
  canonicalizeCefrInput,
  parseDictionaryContent,
} from '../../packages/domain/src/shared-dictionary.ts'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  literal,
  owner,
  other,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'

const admin = '33333333-3333-4333-8333-333333333333'
const digest = 'a'.repeat(64)
const policy = 'b'.repeat(64)
const VERSION = 'synthetic-validator-v1'
const UNKNOWN = 'provider-outcome-unknown'
const REVOKED = 'authorization-revoked'
const REJECTED = 'rejected'
const SCHEMA_INVALID = 'schema-invalid'
const UNSAFE_MEDIA = 'unsafe-media'
const content = (notes = 'Initial reviewed analysis') => ({
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
let db
const json = text =>
  db.sql(text).then(value => (value === '' ? null : JSON.parse(value)))
const service = text => `SET ROLE service_role; ${text}`
const quota = actor =>
  db
    .sql(
      `SELECT request_count FROM public.edge_function_rate_limits WHERE user_id='${actor}' AND capability='gemini-analysis';`
    )
    .then(Number)
const command = f => ({
  protocol_version: 2,
  operation_id: randomUUID(),
  entry_id: f.entry,
  expected_revision_id: f.revision,
  expected_head_sequence: f.sequence,
})
const accept = (request, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.accept_dictionary_analysis_v2(${literal(JSON.stringify(request))});`
    )
  )
const get = (request, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.get_dictionary_analysis_operation_v2('${request.operation_id}');`
    )
  )
const validate = (run, packet = run.packet) =>
  json(
    service(
      `SELECT public.record_dictionary_analysis_validation_v1('${run.actor}', '${run.request.operation_id}', '${run.fence}', ${literal(JSON.stringify(packet))});`
    )
  )
const publicationSql = (
  run,
  id = run.validation?.validation_id,
  fence = run.fence
) =>
  `SELECT public.publish_dictionary_analysis_v1('${run.actor}', '${run.request.operation_id}', ${literal(fence)}, ${literal(id)});`
const publish = (run, id, fence) =>
  json(service(publicationSql(run, id, fence)))
const provenance = (ids, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.get_dictionary_revision_provenance_v2(ARRAY[${ids.map(literal).join(',')}]::UUID[]);`
    )
  )
const reconcile = (run, evidence = digest) =>
  json(
    service(
      `SELECT public.reconcile_dictionary_analysis_result_v1('${run.actor}', '${run.request.operation_id}', '${run.fence}', '${run.result.result_sha256}', ${literal(evidence)});`
    )
  )

async function fixture() {
  await db.sql(`DELETE FROM public.edge_function_rate_limits;
    UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=TRUE, analysis_publication_enabled=TRUE,
      operations_enabled=TRUE, reads_enabled=TRUE, following_reads_enabled=TRUE WHERE singleton;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';
    UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id IN ('${other}', '${admin}');
    INSERT INTO private.dictionary_administrators(user_id, granted_by, audit_reference) VALUES ('${admin}', '${owner}', 'fixture://grant')
      ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version, policy_sha256, enabled, media_url_prefixes, audit_reference)
      VALUES ('${VERSION}', '${policy}', TRUE, ARRAY['https://media.example.invalid/public/dictionary/'], 'fixture://qualified-policy')
      ON CONFLICT(validator_version, policy_sha256) DO UPDATE SET enabled=TRUE;`)
  const entry = randomUUID(),
    revision = randomUUID(),
    source = randomUUID(),
    anchor = randomUUID()
  const original = content()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator, review_state, reviewed_by, reviewed_at, approved_content_sha256)
      VALUES ('${source}', 'editorial', 'fixture://human/${source}', 'approved', '${owner}', NOW(), '${hash(original)}');
    INSERT INTO public.dictionary_entries(entry_id, language_code, lemma, part_of_speech, article, sense_key)
      VALUES ('${entry}', 'nl', 'bank', 'noun', 'de', 'financial-institution');
    INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, content, content_sha256, cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
      VALUES ('${revision}', '${entry}', 1, ${literal(JSON.stringify(original))}, '${hash(original)}', '${cefrHash(original)}', '${source}', 'published', NOW(), NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id, revision_id) VALUES ('${entry}', '${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';
    INSERT INTO private.dictionary_meaning_anchors(anchor_id, entry_id, source_id, gloss, examples, verified_by, verified_at, audit_reference, anchor_sha256)
      VALUES ('${anchor}', '${entry}', '${source}', 'A financial institution that holds money.', '["Ik heb geld bij de bank."]', '${owner}', NOW(), 'fixture://human-anchor', '${digest}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id, anchor_id) VALUES ('${entry}', '${anchor}');`)
  return {
    entry,
    revision,
    source,
    anchor,
    original,
    anchorHash: await db.sql(
      `SELECT anchor_sha256 FROM private.dictionary_meaning_anchors WHERE anchor_id='${anchor}';`
    ),
    sequence: await db.sql(
      `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND change_kind='revision-head';`
    ),
  }
}
async function run(
  f,
  candidate = content('Updated shared analysis'),
  actor = owner,
  late = false
) {
  const request = command(f)
  const receipt = await accept(request, actor)
  await db.sql(
    service(
      `SELECT public.start_dictionary_analysis_dispatch_v1('${actor}', '${request.operation_id}', '${receipt.fence}', 'synthetic-provider', 'synthetic-model', '${digest}');`
    )
  )
  if (late)
    await db.sql(
      `UPDATE private.dictionary_analysis_leases SET expires_at=NOW()-INTERVAL '1 second' WHERE entry_id='${f.entry}';`
    )
  const result = await json(
    service(
      `SELECT public.journal_dictionary_analysis_result_v1('${actor}', '${request.operation_id}', '${receipt.fence}', ${literal(JSON.stringify({ content: candidate }))}, 'synthetic-provider-receipt');`
    )
  )
  const packet = {
    validator_version: VERSION,
    policy_sha256: policy,
    anchor_sha256: f.anchorHash,
    input_sha256: digest,
    result_sha256: result.result_sha256,
    meaning_evidence_sha256: digest,
    outcome: 'accepted',
    decision_code: 'same-meaning',
    content: candidate,
    content_sha256: hash(candidate),
    cefr_input_sha256: cefrHash(candidate),
  }
  return { f, request, actor, fence: receipt.fence, result, packet }
}
async function ready(f, candidate, actor) {
  const result = await run(f, candidate, actor)
  result.validation = await validate(result)
  return result
}
async function effects(f) {
  return json(`SELECT JSONB_BUILD_OBJECT('head', (SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${f.entry}'),
    'revisions', (SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.entry}'),
    'events', (SELECT COUNT(*) FROM private.dictionary_content_changes WHERE entry_id='${f.entry}'),
    'publications', (SELECT COUNT(*) FROM private.dictionary_analysis_publications WHERE entry_id='${f.entry}'));`)
}
async function waitFor(connection, marker) {
  for (let n = 0; n < 500; n++) {
    if (connection.output().includes(marker)) return
    await setTimeout(10)
  }
  throw new Error(`Synthetic transaction did not reach ${marker}`)
}
before(async () => {
  db = await createCluster({
    // Historical core contract; current paid containment uses all migrations in dictionary-paid-* and the endpoint suite.
    throughMigration:
      '20261025093000_add_dictionary_capability_release_gate.sql',
  })
  await seedUsers(db)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${admin}','admin-fixture@example.invalid');`
  )
})
after(async () => {
  await db?.close()
})

test('publication defaults off, no policy is seeded and raw or unvalidated work cannot publish', async () => {
  assert.equal(
    await db.sql(
      'SELECT analysis_publication_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      'SELECT COUNT(*) FROM private.dictionary_analysis_validator_policies;'
    ),
    '0'
  )
  const f = await fixture(),
    r = await run(f)
  await assert.rejects(publish(r, randomUUID()), /validation-evidence-mismatch/)
  r.validation = await validate(r)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_publication_enabled=FALSE;'
  )
  await assert.rejects(publish(r), /shared-publication-disabled/)
  assert.equal((await get(r.request)).status, 'validating')
  assert.equal((await effects(f)).revisions, 1)
})

test('canonical content and CEFR hashes match the existing domain serializer including Unicode and nested fields', async () => {
  const c = content('Quoted "text", café, fiets 🚲 and\nline break')
  c.usage_notes = {
    summary: 'Financial meaning',
    contrasts: [
      {
        term: 'zitbank',
        distinction: 'A bench, not a financial institution.',
        example: null,
      },
    ],
  }
  assert.equal(parseDictionaryContent(c).success, true)
  assert.equal(
    await db.sql(
      `SELECT private.dictionary_canonical_json(${literal(JSON.stringify(c))});`
    ),
    canonicalizeJson(c)
  )
  assert.equal(
    await db.sql(
      `SELECT private.dictionary_canonical_sha256(${literal(JSON.stringify(c))});`
    ),
    hash(c)
  )
  assert.equal(
    await db.sql(
      `SELECT private.dictionary_cefr_content_sha256(${literal(JSON.stringify(c))});`
    ),
    createHash('sha256').update(canonicalizeCefrInput(c)).digest('hex')
  )
  assert.equal(
    await db.sql(`SELECT private.dictionary_utf16_length('🚲');`),
    '2'
  )
  assert.equal(await db.sql(`SELECT private.dictionary_utf16_length('');`), '0')
})

test('validated publication commits one immutable revision/source/head/event and preserves both owners learning and adoption', async () => {
  const f = await fixture(),
    r = await ready(f)
  const words = [await seedWord(db), await seedWord(db, other)]
  for (const [i, word] of words.entries())
    await db.sql(`BEGIN; UPDATE public.words SET dictionary_entry_id='${f.entry}', dictionary_revision_id='${f.revision}', dictionary_content_mode='follow' WHERE word_id='${word}';
    INSERT INTO public.word_content_state(word_id,user_id,overrides) VALUES ('${word}','${i ? other : owner}','{}'); COMMIT;`)
  const beforeWords = await Promise.all(words.map(word => state(db, word)))
  const human = await json(
    `SELECT TO_JSONB(s) FROM private.dictionary_sources s WHERE source_id='${f.source}';`
  )
  const beforeEffects = await effects(f)
  const receipt = await publish(r)
  assert.equal(receipt.status, 'published')
  assert.equal(BigInt(receipt.published_head_sequence), BigInt(f.sequence) + 1n)
  const afterEffects = await effects(f)
  assert.equal(afterEffects.revisions, beforeEffects.revisions + 1)
  assert.equal(afterEffects.events, beforeEffects.events + 1)
  assert.equal(afterEffects.publications, 1)
  assert.equal(afterEffects.head, receipt.published_revision_id)
  assert.deepEqual(
    await Promise.all(words.map(word => state(db, word))),
    beforeWords
  )
  assert.deepEqual(
    await json(
      `SELECT TO_JSONB(s) FROM private.dictionary_sources s WHERE source_id='${f.source}';`
    ),
    human
  )
  const evidence =
    await json(`SELECT JSONB_BUILD_OBJECT('reviewed_by',s.reviewed_by,'source_reviewed_at',s.reviewed_at,'revision_reviewed_at',v.reviewed_at,'review_state',s.review_state)
    FROM public.dictionary_revisions v JOIN private.dictionary_sources s USING(source_id) WHERE v.revision_id='${receipt.published_revision_id}';`)
  assert.deepEqual(evidence, {
    reviewed_by: null,
    source_reviewed_at: null,
    revision_reviewed_at: null,
    review_state: 'machine_validated',
  })
  for (const [i, word] of words.entries()) {
    const read = await json(
      asUser(
        i ? other : owner,
        `SELECT public.get_dictionary_effective_content_v2(ARRAY['${word}']::UUID[]);`
      )
    )
    assert.equal(
      read.cards[0].reference.revision_id,
      receipt.published_revision_id
    )
    assert.equal(read.cards[0].adopted_revision_id, f.revision)
    assert.equal(
      read.revisions[0].content.analysis_notes,
      r.packet.content.analysis_notes
    )
  }
  assert.equal(await quota(owner), 1)
})

test('no-change and lost publication reply replay create no new revision/event and charge no extra quota', async () => {
  const f = await fixture(),
    r = await ready(f, content())
  const beforeEffects = await effects(f)
  const receipt = await publish(r)
  assert.equal(receipt.status, 'no-change')
  assert.equal(receipt.published_revision_id, f.revision)
  assert.equal(receipt.published_head_sequence, f.sequence)
  assert.deepEqual(await effects(f), beforeEffects)
  await db.sql(`UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';
    UPDATE private.dictionary_content_runtime SET analysis_publication_enabled=FALSE;
    UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;`)
  assert.deepEqual(await publish(r), receipt)
  assert.equal(await quota(owner), 1)
  await assert.rejects(publish(r, randomUUID()), /validation-evidence-mismatch/)
})

test('a lost changed-publication reply returns the exact durable receipt after authority and policy revocation', async () => {
  const f = await fixture(),
    r = await ready(f)
  const receipt = await publish(r),
    beforeEffects = await effects(f)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}'; UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;`
  )
  assert.deepEqual(await publish(r), receipt)
  assert.deepEqual(await effects(f), beforeEffects)
  assert.equal(await quota(owner), 1)
})

test('validator request, protected input/result, content hash and journal candidate are bound and immutable', async () => {
  const f = await fixture(),
    r = await run(f)
  for (const key of ['anchor_sha256', 'input_sha256', 'result_sha256'])
    await assert.rejects(
      validate(r, { ...r.packet, [key]: policy }),
      /validation-evidence-mismatch/
    )
  await assert.rejects(
    validate(r, { ...r.packet, content_sha256: digest }),
    /validation-content-hash-mismatch/
  )
  await assert.rejects(
    validate(r, {
      ...r.packet,
      content: content('Substituted private candidate'),
    }),
    /validation-result-content-mismatch/
  )
  await assert.rejects(
    validate(r, { ...r.packet, actor_id: other }),
    /invalid-analysis-validation/
  )
  await assert.rejects(
    validate(r, { ...r.packet, outcome: null }),
    /invalid-analysis-validation/
  )
  r.validation = await validate(r)
  assert.deepEqual(await validate(r), r.validation)
  await assert.rejects(
    validate(r, { ...r.packet, meaning_evidence_sha256: policy }),
    /operation-payload-conflict/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_analysis_validations SET provider='forged' WHERE validation_id='${r.validation.validation_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    publish(r, r.validation.validation_id, '0'),
    /stale-analysis-fence/
  )
  assert.equal((await effects(f)).revisions, 1)
})

test('disabled or unqualified validator policy cannot validate or publish accepted evidence', async () => {
  const f = await fixture(),
    r = await run(f)
  await assert.rejects(
    validate(r, { ...r.packet, validator_version: 'unqualified' }),
    /validator-policy-unavailable/
  )
  await db.sql(
    'UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;'
  )
  await assert.rejects(validate(r), /validator-policy-unavailable/)
  await db.sql(
    'UPDATE private.dictionary_analysis_validator_policies SET enabled=TRUE;'
  )
  r.validation = await validate(r)
  await db.sql(
    'UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;'
  )
  assert.equal((await publish(r)).error_code, 'validator-policy-revoked')
  assert.equal((await effects(f)).revisions, 1)
})

test('meaning mismatch and uncertain results persist explicit rejected/review evidence and leave the head unchanged', async () => {
  for (const [outcome, decision] of [
    ['rejected', 'meaning-mismatch'],
    ['review-required', 'meaning-uncertain'],
  ]) {
    const f = await fixture(),
      r = await run(f)
    r.packet = {
      ...r.packet,
      outcome,
      decision_code: decision,
      content: null,
      content_sha256: null,
      cefr_input_sha256: null,
    }
    r.validation = await validate(r)
    assert.equal(r.validation.outcome, outcome)
    assert.equal(r.validation.receipt.status, REJECTED)
    assert.equal((await publish(r)).status, REJECTED)
    assert.equal((await effects(f)).head, f.revision)
    assert.equal((await accept(command(f))).fence, '2')
  }
})

test('database schema/limits, identity and media guards override an accepted worker claim', async () => {
  const cases = [
    [{ ...content(), translations: { en: [], ru: [] } }, SCHEMA_INVALID],
    [{ ...content(), synonyms: Array(51).fill('synonym') }, SCHEMA_INVALID],
    [
      { ...content(), translations: { en: ['\t\uFEFF'], ru: [] } },
      SCHEMA_INVALID,
    ],
    [
      {
        ...content(),
        usage_notes: {
          summary: 'summary',
          contrasts: [
            {
              term: 'term',
              distinction: 'difference',
              example: { nl: '', en: 'example', ru: null },
            },
          ],
        },
      },
      SCHEMA_INVALID,
    ],
    [
      { ...content(), conjugation: { arbitrary: 'nested shape' } },
      SCHEMA_INVALID,
    ],
    [{ ...content(), analysis_notes: '🚲'.repeat(2001) }, SCHEMA_INVALID],
    [{ ...content(), dutch_lemma: 'zitbank' }, 'identity-mismatch'],
    [{ ...content(), article: 'het' }, 'identity-mismatch'],
    [
      {
        ...content(),
        image_url: 'http://media.example.invalid/public/dictionary/a.png',
      },
      UNSAFE_MEDIA,
    ],
    [
      {
        ...content(),
        image_url: 'https://media.example.invalid/private/a.png',
      },
      UNSAFE_MEDIA,
    ],
    [
      {
        ...content(),
        image_url:
          'https://media.example.invalid/public/dictionary/../private/a.png',
      },
      UNSAFE_MEDIA,
    ],
    [
      {
        ...content(),
        image_url:
          'https://media.example.invalid/public/dictionary/a.png?token=private',
      },
      UNSAFE_MEDIA,
    ],
  ]
  for (const [candidate, decision] of cases) {
    const f = await fixture(),
      r = await ready(f, candidate)
    assert.equal(r.validation.outcome, REJECTED)
    assert.equal(r.validation.decision_code, decision)
    assert.equal((await effects(f)).head, f.revision)
  }
})

test('approved public media prefixes accept safe shared assets', async () => {
  const f = await fixture(),
    r = await ready(f, {
      ...content('Safe media'),
      image_url: 'https://media.example.invalid/public/dictionary/bank.png',
    })
  assert.equal(r.validation.outcome, 'accepted')
  assert.equal((await publish(r)).status, 'published')
})

test('revoked full_access and revoked read_only administrator cannot publish previously accepted validation', async () => {
  for (const actor of [owner, admin]) {
    const f = await fixture(),
      r = await ready(f, undefined, actor)
    if (actor === owner)
      await db.sql(
        `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
      )
    else
      await db.sql(
        `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${admin}';`
      )
    assert.equal((await publish(r)).status, REVOKED)
    assert.equal((await effects(f)).revisions, 1)
    assert.equal(await quota(actor), 1)
  }
})

test('ABA restoration and anchor replacement invalidate accepted evidence before publication', async () => {
  const f = await fixture(),
    r = await ready(f),
    revision = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    VALUES ('${revision}','${f.entry}',2,${literal(JSON.stringify(f.original))},'${hash(f.original)}','${cefrHash(f.original)}','${f.source}','published',NOW(),NOW());
    UPDATE public.dictionary_entry_heads SET revision_id='${revision}' WHERE entry_id='${f.entry}';
    UPDATE public.dictionary_entry_heads SET revision_id='${f.revision}' WHERE entry_id='${f.entry}';`)
  assert.equal((await publish(r)).status, 'head-conflict')
  assert.equal((await effects(f)).revisions, 2)
  const second = await fixture(),
    s = await ready(second)
  await db.sql(
    `DELETE FROM private.dictionary_meaning_anchor_heads WHERE entry_id='${second.entry}';`
  )
  assert.equal((await publish(s)).error_code, 'meaning-anchor-changed')
  assert.equal((await effects(second)).revisions, 1)
})

test('unknown/late journaled results require explicit hash-bound reconciliation and never redispatch or recharge', async () => {
  const f = await fixture(),
    r = await run(f, content('Late response'), owner, true)
  assert.equal(r.result.status, UNKNOWN)
  await assert.rejects(validate(r), /invalid-analysis-transition/)
  await assert.rejects(reconcile(r, null), /invalid-reconciliation-evidence/)
  assert.equal((await reconcile(r)).status, 'validating')
  assert.equal((await reconcile(r)).status, 'validating')
  await assert.rejects(reconcile(r, policy), /operation-payload-conflict/)
  r.validation = await validate(r)
  assert.equal((await publish(r)).status, 'published')
  assert.equal(await quota(owner), 1)
  assert.equal(
    (
      await json(
        service(
          `SELECT public.start_dictionary_analysis_dispatch_v1('${owner}','${r.request.operation_id}','${r.fence}','synthetic-provider','synthetic-model','${digest}');`
        )
      )
    ).dispatch,
    null
  )
})

test('delivery failure rolls back source, permit, revision, head and receipt; retry uses the stored result without another quota', async () => {
  const f = await fixture(),
    r = await ready(f),
    beforeEffects = await effects(f)
  await db.sql(`CREATE FUNCTION private.reject_synthetic_delivery() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.entry_id='${f.entry}'::UUID THEN RAISE EXCEPTION 'synthetic-delivery-failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER reject_synthetic_delivery AFTER INSERT ON private.dictionary_content_changes FOR EACH ROW EXECUTE FUNCTION private.reject_synthetic_delivery();`)
  await assert.rejects(publish(r), /synthetic-delivery-failure/)
  assert.deepEqual(await effects(f), beforeEffects)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_sources WHERE automated_validation_id='${r.validation.validation_id}';`
    ),
    '0'
  )
  assert.equal((await get(r.request)).status, 'validating')
  await db.sql(
    'DROP TRIGGER reject_synthetic_delivery ON private.dictionary_content_changes; DROP FUNCTION private.reject_synthetic_delivery();'
  )
  assert.equal((await publish(r)).status, 'published')
  assert.equal(await quota(owner), 1)
})

test('overlapping publication retries commit one revision/event and identical receipt', async () => {
  const f = await fixture(),
    r = await ready(f)
  const receipts = await Promise.all([publish(r), publish(r)])
  assert.deepEqual(receipts[0], receipts[1])
  assert.equal((await effects(f)).revisions, 2)
  assert.equal((await effects(f)).events, 2)
})

test('revocation winning the row lock prevents publication with current trusted access', async () => {
  const f = await fixture(),
    r = await ready(f),
    revoker = db.connect()
  revoker.child.stdin.write(
    `BEGIN; UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}'; SELECT 'revocation-held';\n`
  )
  await waitFor(revoker, 'revocation-held')
  const pending = publish(r)
  await setTimeout(100)
  revoker.child.stdin.end('COMMIT;\n')
  await revoker.completed
  assert.equal((await pending).status, REVOKED)
  assert.equal((await effects(f)).revisions, 1)
})

test('publication winning authority locks completes atomically before concurrent revocation', async () => {
  const f = await fixture(),
    r = await ready(f),
    publisher = db.connect(),
    revoker = db.connect()
  publisher.child.stdin.write(
    `SET ROLE service_role; BEGIN; ${publicationSql(r)} SELECT 'publication-held';\n`
  )
  await waitFor(publisher, 'publication-held')
  revoker.child.stdin.end(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';\n`
  )
  await setTimeout(100)
  assert.equal(revoker.output(), '')
  publisher.child.stdin.end('COMMIT;\n')
  await publisher.completed
  await revoker.completed
  assert.equal((await get(r.request)).status, 'published')
  assert.equal((await effects(f)).revisions, 2)
})

test('redacted public provenance distinguishes human and automated review and rejects anonymous/unbounded access', async () => {
  const f = await fixture(),
    r = await ready(f),
    receipt = await publish(r)
  const rows = await provenance(
    [f.revision, receipt.published_revision_id, receipt.published_revision_id],
    other
  )
  assert.equal(rows.length, 2)
  const human = rows.find(row => row.method === 'human'),
    machine = rows.find(row => row.method === 'automated')
  assert.equal(human.validator_version, null)
  assert.equal(machine.validator_version, VERSION)
  assert.equal(machine.provider, 'synthetic-provider')
  for (const row of rows)
    for (const key of [
      'actor_id',
      'operation_id',
      'source_id',
      'input_sha256',
      'meaning_evidence_sha256',
      'result',
      'prompt',
    ])
      assert.equal(Object.hasOwn(row, key), false)
  await assert.rejects(
    db.sql(
      'SET ROLE anon; SELECT public.get_dictionary_revision_provenance_v2(ARRAY[]::UUID[]);'
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        'SELECT public.get_dictionary_revision_provenance_v2(NULL);'
      )
    ),
    /invalid-provenance-batch/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `SELECT public.get_dictionary_revision_provenance_v2(ARRAY_FILL('${f.revision}'::UUID,ARRAY[501]));`
      )
    ),
    /invalid-provenance-batch/
  )
})

test('client and worker table ACLs prevent forged validation/permits or machine provenance outside the guarded wrapper', async () => {
  const f = await fixture(),
    r = await ready(f)
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${publicationSql(r)}`),
      /permission denied/
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.record_dictionary_analysis_validation_v1('${owner}','${r.request.operation_id}','${r.fence}','{}');`
      ),
      /permission denied/
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.reconcile_dictionary_analysis_result_v1('${owner}','${r.request.operation_id}','${r.fence}','${digest}','${digest}');`
      ),
      /permission denied/
    )
    for (const table of [
      'dictionary_analysis_validator_policies',
      'dictionary_analysis_validations',
      'dictionary_analysis_publications',
    ])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; SELECT * FROM private.${table};`),
        /permission denied/
      )
  }
  await assert.rejects(
    db.sql(
      service(
        `INSERT INTO private.dictionary_analysis_publications(validation_id,entry_id,revision_id,source_id) VALUES ('${r.validation.validation_id}','${f.entry}','${randomUUID()}','${randomUUID()}');`
      )
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      service(
        `INSERT INTO private.dictionary_sources(source_kind,provenance_locator,review_state,automated_validation_id) VALUES ('provider','fixture://forged','machine_validated','${r.validation.validation_id}');`
      )
    ),
    /guarded-machine-publication-required/
  )
  await assert.rejects(
    db.sql(
      service(
        `UPDATE private.dictionary_analysis_validator_policies SET media_url_prefixes=ARRAY['https://forged.invalid/'] WHERE validator_version='${VERSION}';`
      )
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(`INSERT INTO public.dictionary_revisions(entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,published_at)
    VALUES ('${f.entry}',2,${literal(JSON.stringify(f.original))},'${hash(f.original)}','${cefrHash(f.original)}','${f.source}','published',NOW());`),
    /Human dictionary revisions require reviewed_at/
  )
})

test('Auth deletion redacts immutable machine actor evidence while preserving shared history and public provenance', async () => {
  const f = await fixture(),
    actor = randomUUID()
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${actor}','ephemeral-fixture@example.invalid'); UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${actor}';`
  )
  const r = await ready(f, undefined, actor),
    receipt = await publish(r)
  const beforeEffects = await effects(f),
    beforeProvenance = await provenance([receipt.published_revision_id])
  await db.sql(`DELETE FROM auth.users WHERE id='${actor}';`)
  assert.equal(
    await db.sql(
      `SELECT actor_id IS NULL FROM private.dictionary_analysis_validations WHERE validation_id='${r.validation.validation_id}';`
    ),
    't'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_analysis_operations WHERE actor_id='${actor}';`
    ),
    '0'
  )
  assert.deepEqual(await effects(f), beforeEffects)
  assert.deepEqual(
    await provenance([receipt.published_revision_id]),
    beforeProvenance
  )
})

test('retired entry provenance is owner-pinned only; retired, draft and unknown unpinned revisions stay hidden', async () => {
  const f = await fixture(),
    retired = randomUUID(),
    draft = randomUUID(),
    word = await seedWord(db)
  await db.sql(`INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    VALUES ('${retired}','${f.entry}',2,${literal(JSON.stringify(f.original))},'${hash(f.original)}','${cefrHash(f.original)}','${f.source}','retired',NOW(),NOW());
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id)
    VALUES ('${draft}','${f.entry}',3,${literal(JSON.stringify(f.original))},'${hash(f.original)}','${cefrHash(f.original)}','${f.source}');
    UPDATE public.words SET dictionary_entry_id='${f.entry}',dictionary_revision_id='${f.revision}' WHERE word_id='${word}';
    UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${f.entry}';`)
  assert.equal((await provenance([f.revision])).length, 1)
  assert.deepEqual(await provenance([f.revision], other), [])
  assert.deepEqual(await provenance([retired, draft, randomUUID()]), [])
})

test('automated published revisions, sources and publication evidence remain immutable', async () => {
  const f = await fixture(),
    r = await ready(f),
    receipt = await publish(r)
  await assert.rejects(
    db.sql(
      `UPDATE public.dictionary_revisions SET reviewed_at=NOW() WHERE revision_id='${receipt.published_revision_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM public.dictionary_revisions WHERE revision_id='${receipt.published_revision_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_sources SET provenance_locator='fixture://forged' WHERE automated_validation_id='${r.validation.validation_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_analysis_publications WHERE validation_id='${r.validation.validation_id}';`
    ),
    /immutable/
  )
})
