import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
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

const SECOND_ANALYSIS = 'Second common analysis'
const content = notes => ({
  dutch_lemma: 'fiets',
  dutch_original: 'fiets',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['bicycle'], ru: [] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'fietsen',
  register: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: notes,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})
let db
let entry
let first
let second
let ownWord
let otherWord
const read = (user, wordIds, version = 2) =>
  db
    .sql(
      asUser(
        user,
        `SELECT public.get_dictionary_effective_content_v${version}(${wordIds === null ? 'NULL' : `ARRAY[${wordIds.map(literal).join(',')}]::UUID[]`});`
      )
    )
    .then(JSON.parse)
const page = (user, after = '0', limit = 200, version = 2) =>
  db
    .sql(
      asUser(
        user,
        `SELECT public.get_dictionary_content_changes_v${version}(${literal(after)}, ${limit});`
      )
    )
    .then(JSON.parse)

async function addRevision(number, notes) {
  const id = randomUUID()
  const source = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator,
    review_state, reviewed_by, reviewed_at, approved_content_sha256)
    VALUES ('${source}', 'editorial', 'fixture://following/${source}', 'approved', '${owner}', NOW(), '${'a'.repeat(64)}');
    INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, schema_version,
      content, content_sha256, cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
    VALUES ('${id}', '${entry}', ${number}, 1, ${literal(JSON.stringify(content(notes)))}::JSONB,
      '${'a'.repeat(64)}', '${'b'.repeat(64)}', '${source}', 'published', NOW(), NOW());`)
  return id
}

async function link(word, user, mode = 'follow') {
  await db.sql(`BEGIN;
    UPDATE public.words SET dictionary_entry_id = '${entry}', dictionary_revision_id = '${first}',
      dictionary_content_mode = '${mode}' WHERE word_id = '${word}';
    INSERT INTO public.word_content_state(word_id, user_id, content_version, overrides)
      VALUES ('${word}', '${user}', 3, '{}'); COMMIT;`)
}

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  entry = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_entries(entry_id, language_code, lemma, part_of_speech, article, sense_key)
    VALUES ('${entry}', 'nl', 'fiets', 'noun', 'de', 'bicycle-meaning');`)
  first = await addRevision(1, 'First common analysis')
  second = await addRevision(2, SECOND_ANALYSIS)
  await db.sql(`INSERT INTO public.dictionary_entry_heads(entry_id, revision_id) VALUES ('${entry}', '${first}');
    UPDATE public.dictionary_entries SET state = 'published' WHERE entry_id = '${entry}';`)
})
after(async () => {
  await db?.close()
})

test('new behavior defaults dormant; legacy capability and rows retain their contracts', async () => {
  const word = await seedWord(db)
  assert.equal(
    await db.sql(
      `SELECT dictionary_content_mode FROM public.words WHERE word_id='${word}'`
    ),
    'legacy'
  )
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        asUser(owner, 'SELECT public.dictionary_content_capability_v2();')
      )
    ),
    {
      dictionary_content_protocol: 2,
      read_protocol_versions: [],
      command_protocol_versions: [],
      following_enabled: false,
      shared_analysis_enabled: false,
    }
  )
  await assert.rejects(read(owner, [word]), /unsupported-protocol/)
  await assert.rejects(
    db.sql(
      `UPDATE public.words SET dictionary_entry_id='${entry}', dictionary_revision_id='${first}', dictionary_content_mode='follow' WHERE word_id='${word}';`
    ),
    /following-content-disabled/
  )
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET operations_enabled=TRUE, reads_enabled=TRUE, legacy_guard_enabled=TRUE WHERE singleton;`
  )
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        asUser(owner, 'SELECT public.dictionary_content_capability_v1();')
      )
    ),
    { dictionary_content_protocol: 1 }
  )
  await assert.rejects(read(owner, [word]), /unsupported-protocol/)
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET following_reads_enabled=TRUE WHERE singleton;`
  )
})

test('following cards are owner-only references with deduplicated dependencies and unchanged adoption', async () => {
  ownWord = await seedWord(db, owner, { intervalDays: 12, repetitionCount: 7 })
  otherWord = await seedWord(db, other, { intervalDays: 3, repetitionCount: 2 })
  const sameOwner = await seedWord(db)
  await link(ownWord, owner)
  await link(otherWord, other)
  await link(sameOwner, owner)
  const result = await read(owner, [ownWord, sameOwner, otherWord, ownWord])
  assert.equal(result.cards.length, 2)
  assert.equal(result.revisions.length, 1)
  assert.equal(result.revisions[0].revision_id, first)
  assert.ok(
    result.cards.every(
      card =>
        card.mode === 'follow' &&
        card.legacy_content === null &&
        card.head_sequence === '1'
    )
  )
  assert.ok(
    result.cards.every(
      card => card.adopted_revision_id === first && card.content_version === '3'
    )
  )
  assert.deepEqual(
    (await read(other, [ownWord, otherWord])).cards.map(card => card.word_id),
    [otherWord]
  )
  assert.deepEqual((await read(owner, [])).cards, [])
})

test('publishing updates both owners through one head without rewriting personal rows or learning', async () => {
  const beforeOwn = await state(db, ownWord)
  const beforeOther = await state(db, otherWord)
  await db.sql(
    `UPDATE public.dictionary_entry_heads SET revision_id='${second}' WHERE entry_id='${entry}';`
  )
  for (const [user, word] of [
    [owner, ownWord],
    [other, otherWord],
  ]) {
    const result = await read(user, [word])
    assert.equal(result.cards[0].reference.revision_id, second)
    assert.equal(result.cards[0].adopted_revision_id, first)
    assert.equal(result.cards[0].head_sequence, '2')
    assert.equal(result.revisions[0].content.analysis_notes, SECOND_ANALYSIS)
  }
  assert.deepEqual(await state(db, ownWord), beforeOwn)
  assert.deepEqual(await state(db, otherWord), beforeOther)
})

test('v1 adapter returns the current actual revision with matching strict content and no overrides', async () => {
  const result = await read(owner, [ownWord], 1)
  assert.equal(result.cards[0].source, 'pinned')
  assert.deepEqual(result.cards[0].reference, {
    entry_id: entry,
    revision_id: second,
  })
  assert.equal(result.cards[0].content.analysis_notes, SECOND_ANALYSIS)
  assert.deepEqual(result.cards[0].removed_fields, [])
  assert.equal(
    await db.sql(
      `SELECT dictionary_revision_id FROM public.words WHERE word_id='${ownWord}';`
    ),
    first
  )
})

test('legacy pins and overrides remain on their adopted revision', async () => {
  const legacy = await seedWord(db)
  await link(legacy, owner, 'legacy')
  await db.sql(
    `UPDATE public.word_content_state SET overrides='{"analysis_notes":{"op":"set","value":"Private legacy note"}}' WHERE word_id='${legacy}';`
  )
  const v2 = await read(owner, [legacy])
  assert.equal(v2.cards[0].mode, 'legacy')
  assert.equal(v2.cards[0].reference.revision_id, first)
  assert.equal(v2.cards[0].legacy_content.analysis_notes, 'Private legacy note')
  assert.equal(v2.cards[0].head_sequence, null)
  assert.equal(
    (await read(owner, [legacy], 1)).cards[0].content.analysis_notes,
    'Private legacy note'
  )
})

test('following mode rejects private overrides and direct caller mode changes atomically', async () => {
  await assert.rejects(
    db.sql(
      `UPDATE public.word_content_state SET overrides='{"image_url":{"op":"remove"}}' WHERE word_id='${ownWord}';`
    ),
    /following-content-cannot-have-overrides/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.words SET dictionary_content_mode='legacy' WHERE word_id='${ownWord}';`
      )
    ),
    /Dictionary modes can only/
  )
  const privateWord = await seedWord(db)
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.words SET dictionary_content_mode='follow' WHERE word_id='${privateWord}';`
      )
    ),
    /Dictionary modes can only/
  )
  assert.equal(
    await db.sql(
      `SELECT overrides FROM public.word_content_state WHERE word_id='${ownWord}';`
    ),
    '{}'
  )
})

test('queued v1 content commands on following rows fail before mutations or receipts', async () => {
  const before = await state(db, ownWord)
  for (const kind of [
    'edit-private',
    'detach',
    'resolve-conflict',
    'adopt-revision',
  ]) {
    const command = {
      protocol_version: 1,
      operation_id: randomUUID(),
      word_id: ownWord,
      expected_content_version: 3,
      kind,
      ...(kind === 'edit-private'
        ? { overrides: {} }
        : kind === 'adopt-revision'
          ? {
              reference: { entry_id: entry, revision_id: second },
              overrides: {},
            }
          : { content: content('Queued private text') }),
    }
    await assert.rejects(
      db.sql(
        asUser(
          owner,
          `SELECT public.apply_dictionary_content_command_v1(${literal(JSON.stringify(command))}::JSONB);`
        )
      ),
      /legacy-content-upgrade-required/
    )
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM private.word_content_receipts WHERE operation_id='${command.operation_id}';`
      ),
      '0'
    )
  }
  assert.deepEqual(await state(db, ownWord), before)
})

test('following direct content writes stay protected even when the old guard is disabled; learning proceeds', async () => {
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET legacy_guard_enabled=FALSE WHERE singleton;'
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.words SET dutch_original='stale private text' WHERE word_id='${ownWord}';`
      )
    ),
    /legacy-content-upgrade-required/
  )
  const result = await review(db, assessment(ownWord))
  assert.ok(result)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.review_events WHERE word_id='${ownWord}';`
    ),
    '1'
  )
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET legacy_guard_enabled=TRUE WHERE singleton;'
  )
})

test('content rollback emits a newer delivery sequence while retaining subsequent learning', async () => {
  const before = await state(db, ownWord)
  await db.sql(
    `UPDATE public.dictionary_entry_heads SET revision_id='${first}' WHERE entry_id='${entry}';`
  )
  const result = await read(owner, [ownWord])
  assert.equal(result.cards[0].reference.revision_id, first)
  assert.equal(result.cards[0].head_sequence, '3')
  const changes = await page(owner, '1')
  assert.deepEqual(
    changes.changes.map(item => [item.cursor, item.revision_id]),
    [
      ['2', second],
      ['3', first],
    ]
  )
  assert.deepEqual(await state(db, ownWord), before)
})

test('read snapshot observes either committed head and its matching dependency, never an uncommitted mixture', async () => {
  const writer = db.connect()
  try {
    writer.child.stdin.write(
      `BEGIN; UPDATE public.dictionary_entry_heads SET revision_id='${second}' WHERE entry_id='${entry}';\n\\echo HEAD_HELD\n`
    )
    const deadline = Date.now() + 5000
    while (!writer.output().includes('HEAD_HELD')) {
      if (Date.now() > deadline)
        throw new Error('Writer lock barrier not reached')
      await setTimeout(20)
    }
    const beforeCommit = await read(owner, [ownWord])
    assert.equal(beforeCommit.cards[0].reference.revision_id, first)
    assert.equal(beforeCommit.revisions[0].revision_id, first)
    assert.equal(beforeCommit.watermark, '3')
    writer.child.stdin.end('COMMIT;\n')
    await writer.completed
    const afterCommit = await read(owner, [ownWord])
    assert.equal(afterCommit.cards[0].reference.revision_id, second)
    assert.equal(afterCommit.revisions[0].revision_id, second)
    assert.equal(afterCommit.cards[0].head_sequence, '4')
    assert.equal(afterCommit.watermark, '4')
  } finally {
    if (!writer.child.stdin.writableEnded) writer.child.stdin.end('ROLLBACK;\n')
    await writer.completed.catch(() => {})
  }
})

test('review snapshot3 reuses the same owner-only batch and preserves legacy snapshot contracts', async () => {
  const v1 = JSON.parse(
    await db.sql(asUser(owner, 'SELECT public.get_web_review_snapshot_v1();'))
  )
  const v3 = JSON.parse(
    await db.sql(asUser(owner, 'SELECT public.get_web_review_snapshot_v3();'))
  )
  assert.equal(v1.protocolVersion, 1)
  assert.equal(v3.protocolVersion, 3)
  assert.equal(v3.dictionaryContentProtocol, 2)
  assert.equal(v3.dictionaryContent.protocol_version, 2)
  assert.deepEqual(v3.collections, v1.collections)
  assert.deepEqual(v3.events, v1.events)
  assert.ok(
    v3.dictionaryContent.cards.every(card => card.word_id !== otherWord)
  )
})

test('read/command SQL privileges and missing identity fail closed', async () => {
  await assert.rejects(
    db.sql(
      'SET ROLE anon; SELECT public.get_dictionary_effective_content_v2(NULL);'
    ),
    /permission denied/
  )
  await assert.rejects(read(null, [ownWord]), /not-found-or-not-owned/)
  await assert.rejects(
    db.sql(
      asUser(owner, 'SELECT private.dictionary_content_change_page(0,200);')
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.dictionary_entry_heads SET revision_id='${first}' WHERE entry_id='${entry}';`
      )
    ),
    /permission denied/
  )
})

test('bounds, malformed decimal cursors and future acknowledgements are rejected', async () => {
  await assert.rejects(
    read(owner, Array(1001).fill(ownWord)),
    /too-many-word-ids/
  )
  for (const invalid of ['-1', '01', '1e2', '9223372036854775808', '5'])
    await assert.rejects(page(owner, invalid), /invalid-change-page/)
  await assert.rejects(page(owner, '0', 0), /invalid-change-page/)
  await assert.rejects(page(owner, '0', 501), /invalid-change-page/)
  const bounded = await page(owner, '0', 1)
  assert.equal(bounded.next_cursor, '1')
  assert.equal(bounded.has_more, true)
  const terminal = await page(owner, '4')
  assert.equal(terminal.next_cursor, '4')
  assert.equal(terminal.has_more, false)
  assert.deepEqual(terminal.changes, [])
})

test('full review snapshots support larger libraries while explicit ID batches stay bounded', async () => {
  const ids = (
    await db.sql(`INSERT INTO public.words(word_id, user_id, dutch_lemma, translations, tts_url)
    SELECT extensions.gen_random_uuid(), '${owner}', extensions.gen_random_uuid()::TEXT,
      '{"en":["fixture"],"ru":[]}', '' FROM generate_series(1, 1001) RETURNING word_id;`)
  ).split('\n')
  try {
    assert.ok((await read(owner, null)).cards.length > 1000)
    const snapshot = JSON.parse(
      await db.sql(asUser(owner, 'SELECT public.get_web_review_snapshot_v3();'))
    )
    assert.ok(snapshot.dictionaryContent.cards.length > 1000)
    await assert.rejects(read(owner, ids), /too-many-word-ids/)
  } finally {
    await db.sql(
      `DELETE FROM public.words WHERE word_id = ANY(ARRAY[${ids.map(literal).join(',')}]::UUID[]);`
    )
  }
})

test('following dependencies fail explicitly instead of returning retained legacy content or a stale watermark', async () => {
  for (const version of [1, 2]) {
    await assert.rejects(
      db.sql(
        asUser(
          owner,
          `BEGIN;
      DELETE FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND revision_id='${second}';
      SELECT public.get_dictionary_effective_content_v${version}(ARRAY['${ownWord}']::UUID[]); COMMIT;`
        )
      ),
      /permission denied/
    )
    await assert.rejects(
      db.sql(`BEGIN;
      DELETE FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND revision_id='${second}';
      ${asUser(owner, `SELECT public.get_dictionary_effective_content_v${version}(ARRAY['${ownWord}']::UUID[]);`)} COMMIT;`),
      /missing-dictionary-head/
    )
  }
  assert.equal((await read(owner, [ownWord])).cards[0].head_sequence, '4')
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET following_reads_enabled=FALSE WHERE singleton;'
  )
  try {
    await assert.rejects(
      read(owner, [ownWord], 1),
      /following-content-disabled/
    )
    await assert.rejects(read(owner, [ownWord], 2), /unsupported-protocol/)
  } finally {
    await db.sql(
      'UPDATE private.dictionary_content_runtime SET following_reads_enabled=TRUE WHERE singleton;'
    )
  }
})

test('A15 BIGINT delivery remains distinct above JavaScript safe range and v1 fails explicitly', async () => {
  await db.sql(`UPDATE private.dictionary_delivery_cursor SET committed_version=9007199254740991 WHERE singleton;
    UPDATE public.dictionary_entry_heads SET revision_id='${first}' WHERE entry_id='${entry}';
    UPDATE public.dictionary_entry_heads SET revision_id='${second}' WHERE entry_id='${entry}';`)
  const result = await page(owner, '9007199254740991')
  assert.deepEqual(
    result.changes.map(item => item.cursor),
    ['9007199254740992', '9007199254740993']
  )
  assert.equal(result.latest_cursor, '9007199254740993')
  assert.equal(
    (await read(owner, [ownWord])).cards[0].head_sequence,
    '9007199254740993'
  )
  await assert.rejects(page(owner, '0', 200, 1), /unsafe-protocol-1-sequence/)
  await db.sql(
    `UPDATE public.word_content_state SET content_version=9007199254740992 WHERE word_id='${ownWord}';`
  )
  assert.equal(
    (await read(owner, [ownWord])).cards[0].content_version,
    '9007199254740992'
  )
  await assert.rejects(read(owner, [ownWord], 1), /unsafe-protocol-1-sequence/)
})
