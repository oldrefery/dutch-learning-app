import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { assertQaRoot } from './D08-qa-paths.mjs'

const stackRoot = realpathSync(process.argv[2])
const outputPath = process.argv[3]
assertQaRoot(stackRoot, 'qa')
assertQaRoot(dirname(outputPath), 'native')

const project = basename(stackRoot)
const config = readFileSync(join(stackRoot, 'supabase/config.toml'), 'utf8')
assert.ok(config.includes(`project_id = "${project}"`))
assert.equal(existsSync(join(stackRoot, 'supabase/.temp/project-ref')), false)

const status = JSON.parse(
  execFileSync(
    'supabase',
    ['status', '--workdir', stackRoot, '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 }
  )
)
assert.equal(status.API_URL, 'http://127.0.0.1:55321')

const database = `supabase_db_${project}`
const inspect = JSON.parse(
  execFileSync('docker', ['inspect', database], {
    encoding: 'utf8',
    timeout: 10_000,
  })
)[0]
assert.equal(inspect.Config.Labels['com.supabase.cli.project'], project)
assert.ok(
  Object.values(inspect.NetworkSettings.Ports).some(bindings =>
    bindings?.some(binding => binding.HostPort === '55322')
  )
)

const sql = statement =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      database,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-XqAt',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: statement, encoding: 'utf8', timeout: 15_000 }
  ).trim()

const literal = value => `'${String(value).replaceAll("'", "''")}'`
const ok = response => {
  assert.equal(response.error, null, response.error?.message)
  return response.data
}
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
}

const createUser = async label => {
  const email = `d08-${label}-${randomUUID()}@example.invalid`
  const password = `D08-${randomUUID()}!`
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions)
  const signup = ok(await client.auth.signUp({ email, password }))
  assert.ok(signup.session)
  const userId = signup.user.id
  assert.equal(
    sql(`UPDATE public.user_access_levels SET access_level='full_access'
      WHERE user_id=${literal(userId)}::UUID
        AND EXISTS (SELECT 1 FROM auth.users
          WHERE id=${literal(userId)}::UUID AND email=${literal(email)})
      RETURNING user_id;`),
    userId
  )
  return { client, email, password, userId }
}

const content = (lemma, translation, article = null, plural = null) => ({
  dutch_lemma: lemma,
  dutch_original: lemma,
  part_of_speech: 'noun',
  article,
  translations: { en: [translation], ru: [] },
  examples: [
    { nl: `Dit is ${lemma}.`, en: `This is ${translation}.`, ru: null },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural,
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

const insertWord = async (user, collectionId, value) => {
  const wordId = randomUUID()
  const row = {
    word_id: wordId,
    collection_id: collectionId,
    user_id: user.userId,
    ...value,
    tts_url: value.tts_url ?? '',
    next_review_date: new Date().toISOString().slice(0, 10),
  }
  ok(await user.client.from('words').insert(row))
  return wordId
}

const publishEntry = (userId, value, cefrLevel, cefrStatus) => {
  const sourceId = randomUUID()
  const resolutionId = randomUUID()
  const senseKey = randomUUID()
  const assessmentId = randomUUID()
  const contentSha = 'a'.repeat(64)
  const inputSha = 'b'.repeat(64)
  const persisted = JSON.parse(
    sql(`INSERT INTO private.dictionary_sources(
        source_id, source_kind, provenance_locator, review_state,
        reviewed_by, reviewed_at, approved_content_sha256
      ) VALUES (
        ${literal(sourceId)}::UUID, 'editorial',
        ${literal(`fixture://${sourceId}`)}, 'approved',
        ${literal(userId)}::UUID, NOW(), ${literal(contentSha)}
      );
      SET ROLE service_role;
      SELECT public.persist_canonical_dictionary_analysis_v1(
        ${literal(resolutionId)}::UUID, 'nl', ${literal(senseKey)},
        ${literal(JSON.stringify(value))}::JSONB,
        ${literal(contentSha)}, ${literal(inputSha)},
        ${literal(sourceId)}::UUID, NULL
      );
      RESET ROLE;`)
  )
  sql(`INSERT INTO public.dictionary_cefr_assessments(
      assessment_id, entry_id, input_sha256, cefr_level, status,
      confidence, method, method_version, source_id, locked
    ) VALUES (
      ${literal(assessmentId)}::UUID, ${literal(persisted.entry_id)}::UUID,
      ${literal(inputSha)}, ${literal(cefrLevel)}, ${literal(cefrStatus)},
      0.93, 'editorial-fixture', '1', ${literal(sourceId)}::UUID,
      ${cefrStatus === 'reviewed' ? 'TRUE' : 'FALSE'}
    );
    INSERT INTO public.dictionary_cefr_heads(
      entry_id, input_sha256, assessment_id
    ) VALUES (
      ${literal(persisted.entry_id)}::UUID, ${literal(inputSha)},
      ${literal(assessmentId)}::UUID
    );`)
  return { ...persisted, assessmentId }
}

const linkWord = async (user, wordId, published) =>
  ok(
    await user.client.rpc('apply_dictionary_content_command_v1', {
      p_command: {
        protocol_version: 1,
        operation_id: randomUUID(),
        word_id: wordId,
        expected_content_version: 0,
        kind: 'link',
        reference: {
          entry_id: published.entry_id,
          revision_id: published.revision_id,
        },
        overrides: {},
      },
    })
  )

const primary = await createUser('primary')
const isolated = await createUser('isolated')
try {
  const collectionId = randomUUID()
  ok(
    await primary.client.from('collections').insert({
      collection_id: collectionId,
      user_id: primary.userId,
      name: 'D08 Native QA',
    })
  )

  const estimatedContent = content('fiets', 'bicycle', 'de', 'fietsen')
  const reviewedContent = content('huis', 'house', 'het', 'huizen')
  const privateContent = content('zolder', 'attic', 'de', 'zolders')
  const estimatedWordId = await insertWord(
    primary,
    collectionId,
    estimatedContent
  )
  const reviewedWordId = await insertWord(
    primary,
    collectionId,
    reviewedContent
  )
  const privateWordId = await insertWord(primary, collectionId, privateContent)

  const estimated = publishEntry(
    primary.userId,
    estimatedContent,
    'A2',
    'estimated'
  )
  const reviewed = publishEntry(
    primary.userId,
    reviewedContent,
    'B1',
    'reviewed'
  )
  await linkWord(primary, estimatedWordId, estimated)
  await linkWord(primary, reviewedWordId, reviewed)

  const isolatedCollectionId = randomUUID()
  ok(
    await isolated.client.from('collections').insert({
      collection_id: isolatedCollectionId,
      user_id: isolated.userId,
      name: 'D08 Isolated Owner',
    })
  )
  const isolatedWordId = await insertWord(
    isolated,
    isolatedCollectionId,
    content('anker', 'anchor', 'het', 'ankers')
  )

  const fixture = {
    createdAt: new Date().toISOString(),
    project,
    apiUrl: status.API_URL,
    primary: {
      email: primary.email,
      password: primary.password,
      userId: primary.userId,
      collectionId,
      estimatedWordId,
      reviewedWordId,
      privateWordId,
    },
    isolated: {
      email: isolated.email,
      password: isolated.password,
      userId: isolated.userId,
      collectionId: isolatedCollectionId,
      wordId: isolatedWordId,
    },
  }
  writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
  console.log(
    JSON.stringify({
      project,
      users: 2,
      primaryWords: 3,
      linkedWords: 2,
      cefrStates: ['estimated', 'reviewed'],
      output: outputPath,
    })
  )
} catch (error) {
  sql(`DELETE FROM auth.users WHERE id IN (
    ${literal(primary.userId)}::UUID, ${literal(isolated.userId)}::UUID
  );`)
  throw error
}
