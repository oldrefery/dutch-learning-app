import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { createCluster } from './cluster.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import {
  asUser,
  literal,
  other,
  owner,
  seedUsers,
  seedWord,
} from './fixtures.mjs'

const digest = value => value.repeat(64)
const sourceId = randomUUID()
const REVIEW_SNAPSHOT_V1_SQL = 'SELECT public.get_web_review_snapshot_v1();'

const content = (lemma = 'fiets') => ({
  dutch_lemma: lemma,
  dutch_original: lemma,
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['bicycle'], ru: ['велосипед'] },
  examples: [{ nl: `De ${lemma}.`, en: `The ${lemma}.`, ru: null }],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: `${lemma}en`,
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})

const commandSql = command =>
  `SELECT public.apply_dictionary_content_command_v1(${literal(
    JSON.stringify(command)
  )}::JSONB);`

const privateCommand = ({
  word,
  operation = randomUUID(),
  value,
  version = 0,
}) => ({
  protocol_version: 1,
  operation_id: operation,
  word_id: word,
  expected_content_version: version,
  kind: 'create-private',
  content: value,
})

const referenceCommand = ({
  word,
  entry,
  revision,
  operation = randomUUID(),
  version = 0,
  overrides = {},
  kind = 'link',
}) => ({
  protocol_version: 1,
  operation_id: operation,
  word_id: word,
  expected_content_version: version,
  kind,
  reference: { entry_id: entry, revision_id: revision },
  overrides,
})

const persistSql = ({
  resolution = randomUUID(),
  value = content(),
  sense = randomUUID(),
  cache = null,
}) => `SET ROLE service_role;
  SELECT public.persist_canonical_dictionary_analysis_v1(
    '${resolution}', 'nl', '${sense}', ${literal(JSON.stringify(value))}::JSONB,
    '${digest('a')}', '${digest('b')}', '${sourceId}',
    ${cache ? `'${cache}'` : 'NULL'}
  );`

let db
let canonical
let linkedWord

const until = async predicate => {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await setTimeout(20)
  }
  throw new Error('Expected PostgreSQL lock barrier was not reached')
}

const overlapServiceRole = async (first, second) => {
  const connection = db.connect()
  const application = `qa-dictionary-${randomUUID()}`
  let waiting
  try {
    connection.child.stdin.write(`SET statement_timeout = '10s';
      SET idle_in_transaction_session_timeout = '10s'; BEGIN;
      ${first}
      \\echo DICTIONARY_CHANGE_HELD
    `)
    await until(() => connection.output().includes('DICTIONARY_CHANGE_HELD'))
    waiting = db.sql(`SET application_name = '${application}'; ${second}`)
    void waiting.catch(() => {})
    await until(
      async () =>
        (await db.sql(`SELECT count(*) FROM pg_stat_activity
          WHERE application_name = '${application}'
            AND wait_event_type = 'Lock';`)) === '1'
    )
    connection.child.stdin.end('COMMIT;\n')
    await connection.completed
    return await waiting
  } finally {
    if (!connection.child.stdin.writableEnded) {
      connection.child.stdin.end('ROLLBACK;\n')
    }
    await connection.completed.catch(() => {})
    await waiting?.catch(() => {})
  }
}

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(`INSERT INTO private.dictionary_sources (
    source_id, source_kind, provenance_locator, review_state,
    reviewed_by, reviewed_at, approved_content_sha256
  ) VALUES (
    '${sourceId}', 'editorial', 'fixture://${sourceId}', 'approved',
    '${owner}', NOW(), '${digest('a')}'
  );`)
})

after(async () => {
  await db?.close()
})

test('runtime flags default off while review snapshot v1 remains available', async () => {
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        asUser(owner, 'SELECT public.dictionary_content_capability_v1();')
      )
    ),
    { dictionary_content_protocol: 0 }
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        commandSql(
          privateCommand({ word: randomUUID(), value: content('slot') })
        )
      )
    ),
    /unsupported-protocol/
  )
  await assert.rejects(
    db.sql(
      asUser(owner, 'SELECT public.get_dictionary_effective_content_v1(NULL);')
    ),
    /unsupported-protocol/
  )
  assert.equal(
    JSON.parse(await db.sql(asUser(owner, REVIEW_SNAPSHOT_V1_SQL)))
      .protocolVersion,
    1
  )

  await db.sql(`UPDATE private.dictionary_content_runtime
    SET operations_enabled = TRUE, reads_enabled = TRUE,
        legacy_guard_enabled = TRUE WHERE singleton;`)
})

test('trusted canonical persistence is idempotent without semantic-key merging', async () => {
  const cacheId = randomUUID()
  const resolution = randomUUID()
  const sense = randomUUID()
  await db.sql(`INSERT INTO public.word_analysis_cache(
    cache_id, dutch_lemma, dutch_original, part_of_speech, article,
    translations, examples, tts_url
  ) VALUES (
    '${cacheId}', 'fiets', 'fiets', 'noun', 'de',
    '{"en":["bicycle"],"ru":["велосипед"]}', '{}', ''
  );`)

  const first = JSON.parse(
    await db.sql(persistSql({ resolution, cache: cacheId, sense }))
  )
  const retry = JSON.parse(
    await db.sql(persistSql({ resolution, cache: cacheId, sense }))
  )
  assert.equal(first.idempotent, false)
  assert.deepEqual(retry, { ...first, idempotent: true })
  assert.equal(
    await db.sql(`SELECT dictionary_entry_id || '|' || dictionary_revision_id
      FROM public.word_analysis_cache WHERE cache_id = '${cacheId}';`),
    `${first.entry_id}|${first.revision_id}`
  )
  await db.sql(`UPDATE public.word_analysis_cache
    SET image_url = 'https://example.invalid/media-only.png'
    WHERE cache_id = '${cacheId}';`)
  assert.equal(
    await db.sql(`SELECT dictionary_entry_id || '|' || dictionary_revision_id
      FROM public.word_analysis_cache WHERE cache_id = '${cacheId}';`),
    `${first.entry_id}|${first.revision_id}`
  )

  await assert.rejects(
    db.sql(
      persistSql({
        resolution,
        cache: cacheId,
        sense,
        value: { ...content(), analysis_notes: 'changed intent' },
      })
    ),
    /operation-intent-mismatch/
  )
  await db.sql(`UPDATE public.word_analysis_cache
    SET analysis_notes = 'linguistic refresh'
    WHERE cache_id = '${cacheId}';`)
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.word_analysis_cache
      WHERE cache_id = '${cacheId}'
        AND dictionary_entry_id IS NULL
        AND dictionary_revision_id IS NULL;`),
    '1'
  )

  const distinct = JSON.parse(
    await db.sql(persistSql({ value: content(), sense: randomUUID() }))
  )
  assert.notEqual(distinct.entry_id, first.entry_id)
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.dictionary_entries
      WHERE language_code = 'nl' AND lemma = 'fiets'
        AND part_of_speech = 'noun' AND article = 'de';`),
    '2'
  )
  canonical = first
})

test('private content command is atomic, idempotent, and preserves learning state', async () => {
  const word = await seedWord(db, owner, {
    intervalDays: 9,
    repetitionCount: 4,
    easinessFactor: 2.2,
  })
  const operation = randomUUID()
  const command = privateCommand({
    word,
    operation,
    value: content('privaat'),
  })
  const first = JSON.parse(await db.sql(asUser(owner, commandSql(command))))
  const retry = JSON.parse(await db.sql(asUser(owner, commandSql(command))))

  assert.equal(first.content_version, 1)
  assert.equal(first.idempotent, false)
  assert.equal(retry.idempotent, true)
  assert.equal(
    await db.sql(`SELECT dutch_lemma || '|' || interval_days || '|' ||
      repetition_count || '|' || easiness_factor
      FROM public.words WHERE word_id = '${word}';`),
    'privaat|9|4|2.2'
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM private.word_content_receipts
      WHERE operation_id = '${operation}';`),
    '1'
  )

  await assert.rejects(
    db.sql(
      asUser(owner, commandSql({ ...command, content: content('different') }))
    ),
    /operation-intent-mismatch/
  )
  await db.sql(`UPDATE public.words SET deleted_at = NOW()
    WHERE word_id = '${word}';`)
  assert.equal(
    JSON.parse(await db.sql(asUser(owner, commandSql(command)))).idempotent,
    true
  )
})

test('content commands reject unknown and learning fields before mutation', async () => {
  const word = await seedWord(db)
  const operation = randomUUID()
  const command = {
    ...privateCommand({ word, operation, value: content('strict') }),
    interval_days: 999,
  }
  await assert.rejects(
    db.sql(asUser(owner, commandSql(command))),
    /invalid-content-command/
  )
  assert.equal(
    await db.sql(`SELECT interval_days || '|' ||
      (SELECT count(*) FROM private.word_content_receipts
        WHERE operation_id = '${operation}')
      FROM public.words WHERE word_id = '${word}';`),
    '1|0'
  )
})

test('canonical concurrency serializes the commit-order delivery cursor', async () => {
  const firstResolution = randomUUID()
  const secondResolution = randomUUID()
  const firstSql = persistSql({
    resolution: firstResolution,
    sense: randomUUID(),
    value: content('eerste'),
  })
  const secondSql = persistSql({
    resolution: secondResolution,
    sense: randomUUID(),
    value: content('tweede'),
  })

  const second = JSON.parse(await overlapServiceRole(firstSql, secondSql))
  const versions = (
    await db.sql(`SELECT committed_version FROM private.dictionary_content_changes
      WHERE entry_id IN (
        SELECT entry_id FROM private.dictionary_entry_resolutions
        WHERE resolution_id IN ('${firstResolution}', '${secondResolution}')
      ) ORDER BY committed_version;`)
  )
    .split('\n')
    .map(Number)
  assert.equal(versions.length, 2)
  assert.equal(versions[1], versions[0] + 1)
  assert.equal(
    await db.sql(`SELECT committed_version FROM private.dictionary_content_changes
      WHERE entry_id = '${second.entry_id}';`),
    String(versions[1])
  )

  const page = JSON.parse(
    await db.sql(
      asUser(owner, `SELECT public.get_dictionary_content_changes_v1(0, 1);`)
    )
  )
  assert.equal(page.protocol_version, 1)
  assert.equal(page.changes.length, 1)
  assert.equal(page.has_more, true)
  assert.ok(page.latest_cursor >= versions[1])
})

test('link command pins a revision and bulk read applies private overrides', async () => {
  const word = await seedWord(db, owner, { intervalDays: 12 })
  const cefrAssessment = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_cefr_assessments(
    assessment_id, entry_id, input_sha256, cefr_level, status, confidence,
    method, method_version, source_id, locked
  ) VALUES (
    '${cefrAssessment}', '${canonical.entry_id}', '${digest('b')}',
    'A2', 'reviewed', 0.95, 'editorial', '1', '${sourceId}', TRUE
  );
  INSERT INTO public.dictionary_cefr_heads(entry_id, input_sha256, assessment_id)
  VALUES ('${canonical.entry_id}', '${digest('b')}', '${cefrAssessment}');`)
  const command = referenceCommand({
    word,
    entry: canonical.entry_id,
    revision: canonical.revision_id,
    overrides: {
      image_url: { op: 'set', value: 'https://example.invalid/private.png' },
    },
  })
  await db.sql(asUser(owner, commandSql(command)))
  const payload = JSON.parse(
    await db.sql(
      asUser(
        owner,
        `SELECT public.get_dictionary_effective_content_v1(
          ARRAY['${word}'::UUID]
        );`
      )
    )
  )

  assert.equal(payload.protocol_version, 1)
  assert.equal(payload.cards.length, 1)
  assert.equal(payload.cards[0].source, 'pinned')
  assert.equal(
    payload.cards[0].content.image_url,
    'https://example.invalid/private.png'
  )
  assert.equal(payload.cards[0].cefr.level, 'A2')
  assert.equal(payload.cards[0].cefr.status, 'reviewed')
  assert.equal(
    await db.sql(`SELECT dictionary_entry_id || '|' || interval_days
      FROM public.words WHERE word_id = '${word}';`),
    `${canonical.entry_id}|12`
  )
  assert.equal(
    JSON.parse(
      await db.sql(
        asUser(
          other,
          `SELECT public.get_dictionary_effective_content_v1(
            ARRAY['${word}'::UUID]
          );`
        )
      )
    ).cards.length,
    0
  )

  const edit = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: word,
    expected_content_version: 1,
    kind: 'edit-private',
    overrides: {
      analysis_notes: { op: 'set', value: 'Owner-only linguistic note' },
    },
  }
  await db.sql(asUser(owner, commandSql(edit)))
  const edited = JSON.parse(
    await db.sql(
      asUser(
        owner,
        `SELECT public.get_dictionary_effective_content_v1(
          ARRAY['${word}'::UUID]
        );`
      )
    )
  )
  assert.equal(
    edited.cards[0].content.analysis_notes,
    'Owner-only linguistic note'
  )
  assert.equal(edited.cards[0].cefr.level, null)
  assert.equal(edited.cards[0].cefr.status, 'unknown')
  linkedWord = word
})

test('adopt, detach, and conflict resolution keep the personal and learning identity', async () => {
  const nextRevision = randomUUID()
  const nextContent = {
    ...content('fiets'),
    plural: 'fietsen',
    analysis_notes: 'Reviewed revision two',
  }
  await db.sql(`INSERT INTO public.dictionary_revisions(
    revision_id, entry_id, revision_no, schema_version, content,
    content_sha256, cefr_input_sha256, source_id, review_status,
    reviewed_at, published_at
  ) VALUES (
    '${nextRevision}', '${canonical.entry_id}', 2, 1,
    ${literal(JSON.stringify(nextContent))}::JSONB,
    '${digest('a')}', '${digest('c')}', '${sourceId}', 'published', NOW(), NOW()
  );
  UPDATE public.dictionary_entry_heads SET revision_id = '${nextRevision}'
    WHERE entry_id = '${canonical.entry_id}';`)

  const adopt = referenceCommand({
    word: linkedWord,
    entry: canonical.entry_id,
    revision: nextRevision,
    version: 2,
    kind: 'adopt-revision',
    overrides: {
      image_url: { op: 'set', value: 'https://example.invalid/retained.png' },
    },
  })
  await db.sql(asUser(owner, commandSql(adopt)))

  const detachedContent = {
    ...nextContent,
    image_url: 'https://example.invalid/retained.png',
  }
  const detach = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: linkedWord,
    expected_content_version: 3,
    kind: 'detach',
    content: detachedContent,
  }
  await db.sql(asUser(owner, commandSql(detach)))

  const resolvedContent = {
    ...detachedContent,
    dutch_original: 'de fiets',
  }
  const resolve = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: linkedWord,
    expected_content_version: 4,
    kind: 'resolve-conflict',
    content: resolvedContent,
  }
  await db.sql(asUser(owner, commandSql(resolve)))

  assert.equal(
    await db.sql(`SELECT word_id || '|' || interval_days || '|' ||
      COALESCE(dictionary_entry_id::TEXT, 'null') || '|' ||
      (SELECT content_version FROM public.word_content_state states
        WHERE states.word_id = words.word_id)
      FROM public.words WHERE word_id = '${linkedWord}';`),
    `${linkedWord}|12|null|5`
  )
})

test('stale and cross-owner commands fail without receipts or mutations', async () => {
  const word = await seedWord(db)
  const stale = privateCommand({
    word,
    version: 2,
    value: content('stale'),
  })
  await assert.rejects(
    db.sql(asUser(owner, commandSql(stale))),
    /stale-content-version/
  )
  await assert.rejects(
    db.sql(
      asUser(
        other,
        commandSql(privateCommand({ word, value: content('foreign') }))
      )
    ),
    /not-found-or-not-owned/
  )
  assert.equal(
    await db.sql(`SELECT
      (SELECT count(*) FROM public.word_content_state WHERE word_id = '${word}') || '|' ||
      (SELECT count(*) FROM private.word_content_receipts WHERE word_id = '${word}');`),
    '0|0'
  )
})

test('concurrent duplicate content commands apply exactly once', async () => {
  const word = await seedWord(db)
  const command = privateCommand({ word, value: content('parallel') })
  const sql = commandSql(command)
  const second = JSON.parse(
    await overlap(
      db,
      `SELECT word_id FROM public.words WHERE word_id = '${word}' FOR UPDATE;`,
      sql
    )
  )
  assert.equal(second.content_version, 1)
  assert.equal(
    await db.sql(`SELECT content_version FROM public.word_content_state
      WHERE word_id = '${word}';`),
    '1'
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM private.word_content_receipts
      WHERE operation_id = '${command.operation_id}';`),
    '1'
  )
})

test('legacy unlinked edits update private content and invalidate stale command bases', async () => {
  const word = await seedWord(db)
  const initial = privateCommand({
    word,
    value: content(`legacy-${randomUUID()}`),
  })
  const receipt = JSON.parse(await db.sql(asUser(owner, commandSql(initial))))
  assert.equal(receipt.content_version, 1)
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words SET dutch_original = 'legacy changed' WHERE word_id = '${word}';`
    )
  )
  const state = JSON.parse(
    await db.sql(`SELECT JSONB_BUILD_OBJECT('version', content_version,
    'original', fallback_content->>'dutch_original') FROM public.word_content_state WHERE word_id = '${word}';`)
  )
  assert.deepEqual(state, { version: 2, original: 'legacy changed' })
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        commandSql({
          ...initial,
          operation_id: randomUUID(),
          expected_content_version: 1,
          kind: 'resolve-conflict',
        })
      )
    ),
    /stale-content-version/
  )
  const current = JSON.parse(
    await db.sql(
      asUser(
        owner,
        `SELECT public.get_dictionary_effective_content_v1(ARRAY['${word}']::UUID[]);`
      )
    )
  )
  assert.equal(current.cards[0].content.dutch_original, 'legacy changed')
})

test('legacy guard blocks linked content writes but not metadata or new private cards', async () => {
  const linked = await seedWord(db, other)
  await db.sql(
    asUser(
      other,
      commandSql(
        referenceCommand({
          word: linked,
          entry: canonical.entry_id,
          revision: canonical.revision_id,
        })
      )
    )
  )

  await assert.rejects(
    db.sql(
      asUser(
        other,
        `UPDATE public.words SET dutch_original = 'legacy overwrite'
         WHERE word_id = '${linked}';`
      )
    ),
    /legacy-content-upgrade-required/
  )
  assert.equal(
    await db.sql(
      asUser(
        other,
        `UPDATE public.words SET collection_id = NULL
         WHERE word_id = '${linked}' RETURNING word_id;`
      )
    ),
    linked
  )
  assert.equal(
    await db.sql(
      asUser(
        other,
        `UPDATE public.words SET interval_days = 999
         WHERE word_id = '${linked}' RETURNING interval_days;`
      )
    ),
    '1'
  )

  const unlinked = await seedWord(db)
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `UPDATE public.words SET dutch_original = 'legacy private'
         WHERE word_id = '${unlinked}' RETURNING dutch_original;`
      )
    ),
    'legacy private'
  )
})

test('review snapshot v2 adds bulk content without changing v1', async () => {
  const v1 = JSON.parse(await db.sql(asUser(owner, REVIEW_SNAPSHOT_V1_SQL)))
  const v2 = JSON.parse(
    await db.sql(asUser(owner, 'SELECT public.get_web_review_snapshot_v2();'))
  )
  assert.equal(v1.protocolVersion, 1)
  assert.equal(v1.dictionaryContentProtocol, undefined)
  assert.equal(v2.protocolVersion, 2)
  assert.equal(v2.dictionaryContentProtocol, 1)
  assert.ok(Array.isArray(v2.effectiveContent))
  assert.deepEqual(v2.collections, v1.collections)
  assert.deepEqual(v2.events, v1.events)
})

test('disabling reads is a lossless rollback to snapshot v1', async () => {
  await db.sql(`UPDATE private.dictionary_content_runtime
    SET reads_enabled = FALSE WHERE singleton;`)
  await assert.rejects(
    db.sql(asUser(owner, 'SELECT public.get_web_review_snapshot_v2();')),
    /unsupported-protocol/
  )
  assert.equal(
    JSON.parse(await db.sql(asUser(owner, REVIEW_SNAPSHOT_V1_SQL)))
      .protocolVersion,
    1
  )
  assert.ok(
    Number(await db.sql(`SELECT count(*) FROM public.word_content_state;`)) > 0
  )
})
