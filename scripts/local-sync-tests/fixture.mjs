import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, realpathSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Deliberately not a hosted/staging runner. Never load application .env files.
export function localStack() {
  const directory = realpathSync(process.env.WOORDENAAR_LOCAL_QA_DIR ?? '')
  assert.match(directory, /^\/private\/tmp\/woordenaar-sync-v2\.[a-zA-Z0-9]+$/)
  const project = basename(directory)
  const config = readFileSync(join(directory, 'supabase/config.toml'), 'utf8')
  assert.ok(config.includes(`project_id = "${project}"`))
  assert.equal(existsSync(join(directory, 'supabase/.temp/project-ref')), false)
  const status = JSON.parse(
    execFileSync(
      'supabase',
      ['status', '--workdir', directory, '--output', 'json'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15_000,
      }
    )
  )
  assert.equal(status.API_URL, 'http://127.0.0.1:55321')
  const container = JSON.parse(
    execFileSync('docker', ['inspect', `supabase_kong_${project}`], {
      encoding: 'utf8',
      timeout: 10_000,
    })
  )[0]
  assert.equal(container.Config.Labels['com.supabase.cli.project'], project)
  assert.ok(
    Object.values(container.NetworkSettings.Ports).some(bindings =>
      bindings?.some(binding => binding.HostPort === '55321')
    )
  )
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const client = () => createClient(status.API_URL, status.ANON_KEY, options)
  const database = `supabase_db_${project}`
  const label = execFileSync(
    'docker',
    [
      'inspect',
      database,
      '--format',
      '{{index .Config.Labels "com.supabase.cli.project"}}',
    ],
    { encoding: 'utf8' }
  ).trim()
  assert.equal(label, project)
  // Administrative fixture setup/cleanup only. Tested writes always use user JWTs.
  const fixtureSql = (userId, email, statement) => {
    assert.match(userId, /^[0-9a-f-]{36}$/)
    assert.match(email, /^sync-[0-9a-f-]{36}@example\.invalid$/)
    return execFileSync(
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
      {
        input: statement,
        encoding: 'utf8',
        timeout: 10_000,
      }
    ).trim()
  }
  const grantAccess = (userId, email) =>
    assert.equal(
      fixtureSql(
        userId,
        email,
        `UPDATE public.user_access_levels SET access_level='full_access'
      WHERE user_id='${userId}' AND EXISTS (SELECT 1 FROM auth.users
        WHERE id='${userId}' AND email='${email}') RETURNING user_id;`
      ),
      userId
    )
  const deleteUser = (userId, email) =>
    assert.equal(
      fixtureSql(
        userId,
        email,
        `DELETE FROM auth.users WHERE id='${userId}' AND email='${email}' RETURNING id;`
      ),
      userId
    )
  return { client, grantAccess, deleteUser }
}

export function ok(response) {
  assert.equal(response.error, null, response.error?.message)
  return response.data
}

export async function createFixture(stack) {
  const email = `sync-${randomUUID()}@example.invalid`
  const password = randomUUID()
  const a = stack.client()
  const signup = ok(await a.auth.signUp({ email, password }))
  const userId = signup.user.id
  try {
    assert.equal(ok(await a.auth.getUser()).user.email, email)
    stack.grantAccess(userId, email)
    const b = stack.client()
    ok(await b.auth.signInWithPassword({ email, password }))
    assert.equal(ok(await b.auth.getUser()).user.id, userId)
    const collectionId = randomUUID()
    ok(
      await a.from('collections').insert({
        collection_id: collectionId,
        user_id: userId,
        name: 'Local protocol QA',
      })
    )
    const wordId = randomUUID()
    ok(
      await a.from('words').insert({
        word_id: wordId,
        collection_id: collectionId,
        user_id: userId,
        dutch_lemma: 'syncproef',
        dutch_original: null,
        part_of_speech: 'noun',
        is_irregular: false,
        is_reflexive: false,
        is_expression: false,
        expression_type: null,
        is_separable: false,
        prefix_part: null,
        root_verb: null,
        article: null,
        plural: null,
        register: null,
        translations: { en: ['synchronization test'] },
        examples: null,
        synonyms: [],
        antonyms: [],
        conjugation: null,
        preposition: null,
        image_url: null,
        tts_url: '',
        analysis_notes: 'Local native payload fixture',
        usage_notes: null,
      })
    )
    return {
      a,
      b,
      userId,
      wordId,
      collectionId,
      credentials: { email, password },
      session: signup.session,
      cleanup: async () => stack.deleteUser(userId, email),
    }
  } catch (error) {
    stack.deleteUser(userId, email)
    throw error
  }
}

export async function state(client, fixture) {
  const word = ok(
    await client
      .from('words')
      .select('*')
      .eq('word_id', fixture.wordId)
      .single()
  )
  const events = ok(
    await client
      .from('review_events')
      .select('*')
      .eq('word_id', fixture.wordId)
      .order('event_id')
  )
  return { word, events }
}

export function assessment(
  fixture,
  rating = 'good',
  at = new Date().toISOString()
) {
  return {
    p_word_id: fixture.wordId,
    p_event_id: randomUUID(),
    p_assessment: rating,
    p_review_mode: 'meaning-recall',
    p_answered_correctly: true,
    p_response_time_ms: 750,
    p_reviewed_at: at,
    p_review_date: at.slice(0, 10),
  }
}

export const review = async (client, input) =>
  ok(await client.rpc('record_review_assessment', input))
