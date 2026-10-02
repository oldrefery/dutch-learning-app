import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { assertQaFixture, assertQaRoot } from './D08-qa-paths.mjs'

const stack = realpathSync(process.argv[2])
const fixturePath = realpathSync(process.argv[3])
const action = process.argv[4]
assertQaRoot(stack, 'qa')
assertQaFixture(fixturePath)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
assert.equal(fixture.project, basename(stack))
assert.equal(fixture.apiUrl, 'http://127.0.0.1:55321')
assert.match(fixture.primary.email, /^d08-primary-[0-9a-f-]+@example\.invalid$/)
const status = JSON.parse(
  execFileSync('supabase', ['status', '--workdir', stack, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
)
assert.equal(status.API_URL, fixture.apiUrl)
const client = createClient(fixture.apiUrl, status.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const ok = result => {
  assert.equal(result.error, null, result.error?.message)
  return result.data
}
ok(
  await client.auth.signInWithPassword({
    email: fixture.primary.email,
    password: fixture.primary.password,
  })
)
const ids = [
  fixture.primary.estimatedWordId,
  fixture.primary.reviewedWordId,
  fixture.primary.privateWordId,
]
const cards = ok(
  await client.rpc('get_dictionary_effective_content_v1', { p_word_ids: ids })
).cards
if (action === 'receipt') {
  const operationId = process.argv[5]
  assert.match(operationId, /^[0-9a-f-]{36}$/)
  assert.match(fixture.primary.userId, /^[0-9a-f-]{36}$/)
  const count = Number(
    execFileSync(
      'docker',
      [
        'exec',
        `supabase_db_${fixture.project}`,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-At',
        '-c',
        `SELECT COUNT(*) FROM private.word_content_receipts WHERE user_id = '${fixture.primary.userId}' AND operation_id = '${operationId}';`,
      ],
      { encoding: 'utf8' }
    ).trim()
  )
  assert.equal(count, 1)
  console.log(JSON.stringify({ action, operationId, receipts: count }))
} else if (action === 'cefr-refresh') {
  const word = cards.find(
    card => card.word_id === fixture.primary.estimatedWordId
  )
  assert.ok(word?.reference)
  const entryId = word.reference.entry_id
  const revisionId = word.reference.revision_id
  const assessmentId = randomUUID()
  for (const value of [entryId, revisionId, fixture.primary.userId])
    assert.match(value, /^[0-9a-f-]{36}$/)
  const result = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      `supabase_db_${fixture.project}`,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-XqAt',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      encoding: 'utf8',
      input: `BEGIN;
        INSERT INTO public.dictionary_cefr_assessments(
          assessment_id, entry_id, input_sha256, cefr_level, status,
          confidence, method, method_version, source_id, locked,
          supersedes_assessment_id
        ) SELECT '${assessmentId}'::UUID, previous.entry_id,
          previous.input_sha256, previous.cefr_level, previous.status,
          previous.confidence, 'editorial-fixture', 'qa-refresh',
          previous.source_id, previous.locked, previous.assessment_id
        FROM public.dictionary_cefr_heads AS head
        JOIN public.dictionary_cefr_assessments AS previous
          ON previous.assessment_id = head.assessment_id
        JOIN public.dictionary_revisions AS revision
          ON revision.entry_id = head.entry_id
          AND revision.cefr_input_sha256 = head.input_sha256
        JOIN private.dictionary_sources AS source
          ON source.source_id = previous.source_id
        WHERE head.entry_id = '${entryId}'::UUID
          AND revision.revision_id = '${revisionId}'::UUID
          AND source.reviewed_by = '${fixture.primary.userId}'::UUID
          AND source.provenance_locator LIKE 'fixture://%';
        UPDATE public.dictionary_cefr_heads
          SET assessment_id = '${assessmentId}'::UUID
          WHERE entry_id = '${entryId}'::UUID;
        SELECT JSON_BUILD_OBJECT(
          'assessmentId', head.assessment_id,
          'cursor', cursor.committed_version
        ) FROM public.dictionary_cefr_heads AS head
          CROSS JOIN private.dictionary_delivery_cursor AS cursor
          WHERE head.entry_id = '${entryId}'::UUID;
        COMMIT;`,
    }
  ).trim()
  const refreshed = JSON.parse(result)
  assert.equal(refreshed.assessmentId, assessmentId)
  console.log(JSON.stringify({ action, ...refreshed }))
} else if (action === 'edit' || action === 'image-override') {
  const word = cards.find(card => card.content.dutch_lemma === process.argv[5])
  assert.ok(word)
  let update
  if (action === 'edit') {
    const translation = process.argv[6]
    assert.match(translation, /^QA [A-Za-z0-9 -]+$/)
    update = {
      kind: 'resolve-conflict',
      content: {
        ...word.content,
        translations: { ...word.content.translations, en: [translation] },
      },
    }
  } else {
    assert.equal(word.word_id, fixture.primary.estimatedWordId)
    assert.ok(word.reference)
    const imageVersion = process.argv[6] ?? '2'
    assert.match(imageVersion, /^[2-9]$/)
    update = {
      kind: 'edit-private',
      overrides: {
        image_url: {
          op: 'set',
          value: `http://127.0.0.1:55331/fixture.png?v=${imageVersion}`,
        },
      },
    }
  }
  const command = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: word.word_id,
    expected_content_version: word.content_version,
    ...update,
  }
  const result = ok(
    await client.rpc('apply_dictionary_content_command_v1', {
      p_command: command,
    })
  )
  console.log(
    JSON.stringify({ action, operationId: command.operation_id, result })
  )
} else {
  assert.equal(action, 'snapshot')
  const words = ok(
    await client
      .from('words')
      .select(
        'word_id,dutch_lemma,translations,image_url,deleted_at,interval_days,repetition_count,easiness_factor,next_review_date,last_reviewed_at'
      )
      .eq('user_id', fixture.primary.userId)
  )
  const output = join(dirname(fixturePath), `server-state-${Date.now()}.json`)
  writeFileSync(output, JSON.stringify({ cards, words }, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  })
  console.log(
    JSON.stringify({
      output,
      cards: cards.map(card => ({
        lemma: card.content.dutch_lemma,
        version: card.content_version,
        reference: card.reference,
        translations: card.content.translations,
      })),
      words,
    })
  )
}
