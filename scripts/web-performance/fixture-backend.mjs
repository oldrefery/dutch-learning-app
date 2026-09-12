import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createServerClient } from '@supabase/ssr'

export const USER_ID = '00000000-0000-4000-8000-000000000001'
export const COLLECTION_ID = '00000000-0000-4000-8000-000000000002'
export const PUBLIC_KEY = 'isolated-performance-fixture-public-key'
const timestamp = '2020-01-01T12:00:00.000Z'
const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'performance@example.invalid',
  email_confirmed_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
}

export function createFixture({
  words: wordCount,
  events: eventCount,
  selected = wordCount,
}) {
  assert.ok(Number.isInteger(wordCount) && wordCount >= 20 && wordCount <= 5000)
  assert.ok(
    Number.isInteger(eventCount) && eventCount >= 0 && eventCount <= 5000
  )
  assert.ok(Number.isInteger(selected) && selected > 0 && selected <= wordCount)
  const words = Array.from({ length: wordCount }, (_, index) => ({
    word_id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    user_id: USER_ID,
    collection_id: COLLECTION_ID,
    article: index % 3 === 0 ? 'de' : null,
    dutch_lemma: `woord-${String(index).padStart(5, '0')}`,
    dutch_original: null,
    translations: { en: [`meaning-${index}`], ru: [`перевод-${index}`] },
    easiness_factor: 2.5,
    interval_days: index % 6,
    last_reviewed_at: null,
    next_review_date: index < selected ? '2020-01-01' : '2099-01-01',
    repetition_count: index % 4,
    part_of_speech: index % 2 === 0 ? 'noun' : 'verb',
    image_url: null,
    tts_url: null,
    deleted_at: null,
    created_at: timestamp,
  }))
  const events = Array.from({ length: eventCount }, (_, index) => ({
    event_id: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    user_id: USER_ID,
    word_id: words[index % wordCount].word_id,
    answered_correctly: true,
    assessment: 'good',
    review_mode: 'recognition',
    reviewed_at: new Date(Date.parse(timestamp) - index * 1000).toISOString(),
  }))
  const collections = [
    {
      collection_id: COLLECTION_ID,
      user_id: USER_ID,
      name: 'Performance fixture',
      created_at: timestamp,
      updated_at: null,
      is_shared: false,
    },
  ]
  return { words, events, collections, selected }
}

const wordColumns =
  'article,collection_id,dutch_lemma,dutch_original,easiness_factor,image_url,interval_days,last_reviewed_at,next_review_date,part_of_speech,repetition_count,translations,tts_url,word_id'
const eventColumns =
  'answered_correctly,assessment,event_id,review_mode,reviewed_at,word_id'
const project = (rows, columns) =>
  rows.map(row =>
    Object.fromEntries(
      columns.split(',').map(column => [column.trim(), row[column.trim()]])
    )
  )

export function snapshot(fixture) {
  return {
    protocolVersion: 1,
    correctionsAvailable: true,
    collections: project(fixture.collections, 'collection_id,name'),
    words: project(fixture.words, wordColumns),
    events: project(fixture.events, eventColumns),
  }
}

function token() {
  const encode = value =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
  })}`
  return `${unsigned}.${createHmac('sha256', 'isolated-fixture-only').update(unsigned).digest('base64url')}`
}

function readTable(url, fixture) {
  assert.equal(
    url.searchParams.get('user_id'),
    `eq.${USER_ID}`,
    'Expected owner-filtered read'
  )
  const table = url.pathname.split('/').at(-1)
  if (table === 'user_access_levels') return { access_level: 'full_access' }
  const rows = {
    collections: fixture.collections,
    words: fixture.words,
    effective_review_events: fixture.events,
    review_events: fixture.events,
  }[table]
  assert.ok(rows, 'Unsupported fixture table')
  if (table === 'words')
    assert.equal(url.searchParams.get('deleted_at'), 'is.null')
  const from = Number(url.searchParams.get('offset') ?? 0)
  const limit = Number(url.searchParams.get('limit') ?? rows.length)
  assert.ok(
    Number.isInteger(from) && from >= 0 && Number.isInteger(limit) && limit >= 0
  )
  const columns = url.searchParams.get('select')
  assert.ok(
    columns &&
      columns
        .split(',')
        .every(column => rows.length === 0 || column.trim() in rows[0])
  )
  return project(rows.slice(from, from + limit), columns)
}

function readRpc(path, fixture, mode) {
  if (path.endsWith('/review_correction_protocol'))
    return { status: 200, body: 1 }
  const known = [
    '/get_web_review_snapshot_v1',
    '/get_web_collection_overviews_v1',
  ]
  assert.ok(
    known.some(name => path.endsWith(name)),
    'Unsupported fixture RPC'
  )
  if (mode === 'legacy') {
    return {
      status: 404,
      body: { code: 'PGRST202', message: 'Fixture: RPC unavailable' },
    }
  }
  if (path.endsWith('/get_web_review_snapshot_v1'))
    return { status: 200, body: snapshot(fixture) }
  return {
    status: 200,
    body: fixture.collections.map(collection => ({
      ...collection,
      total_words: fixture.words.length,
      mastered_words: fixture.words.filter(word => word.repetition_count >= 3)
        .length,
      due_words: fixture.selected,
      difficult_words: 0,
      new_words: fixture.words.filter(word => word.repetition_count === 0)
        .length,
    })),
  }
}

export async function startFixtureBackend({ latencyMs = 0 } = {}) {
  assert.ok(Number.isFinite(latencyMs) && latencyMs >= 0 && latencyMs <= 1000)
  let fixture = createFixture({ words: 500, events: 0 })
  let mode = 'snapshot'
  let runId = 'bootstrap'
  let originTime = performance.now()
  let active = 0
  let lastActivity = performance.now()
  const requests = []
  const errors = []
  const server = createServer(async (request, response) => {
    active++
    const url = new URL(request.url, 'http://127.0.0.1')
    const entry = {
      runId,
      path: url.pathname,
      method: request.method,
      offset: Number(url.searchParams.get('offset') ?? 0),
      startedMs: performance.now() - originTime,
    }
    requests.push(entry)
    try {
      await delay(latencyMs)
      let result
      if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
        result = {
          status: 200,
          body: {
            access_token: token(),
            refresh_token: 'isolated-fixture-refresh',
            token_type: 'bearer',
            expires_in: 86400,
            user,
          },
        }
      } else if (url.pathname === '/auth/v1/user' && request.method === 'GET') {
        result = { status: 200, body: user }
      } else if (
        url.pathname.startsWith('/rest/v1/rpc/') &&
        request.method === 'POST'
      ) {
        result = readRpc(url.pathname, fixture, mode)
      } else {
        assert.equal(request.method, 'GET', 'Fixture forbids writes')
        assert.ok(
          url.pathname.startsWith('/rest/v1/'),
          'Unsupported fixture endpoint'
        )
        result = { status: 200, body: readTable(url, fixture) }
      }
      const body = JSON.stringify(result.body)
      entry.status = result.status
      entry.bytes = Buffer.byteLength(body)
      response.writeHead(result.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      response.end(body)
    } catch (error) {
      errors.push({ runId, path: url.pathname, message: error.message })
      entry.status = 500
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ message: 'Unsupported fixture request' }))
    } finally {
      entry.finishedMs = performance.now() - originTime
      lastActivity = performance.now()
      active--
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const url = `http://127.0.0.1:${server.address().port}`
  return {
    url,
    requests,
    errors,
    async drain() {
      const deadline = performance.now() + 10000
      while (active > 0 || performance.now() - lastActivity < 200) {
        assert.ok(
          performance.now() < deadline,
          'Fixture upstream did not become idle'
        )
        await delay(25)
      }
    },
    configure(nextFixture, nextMode, nextId) {
      assert.equal(active, 0, 'Previous run still has upstream requests')
      assert.ok(['legacy', 'snapshot'].includes(nextMode))
      fixture = nextFixture
      mode = nextMode
      runId = nextId
      originTime = performance.now()
      requests.length = 0
    },
    async cookies(appUrl) {
      let cookies = []
      const client = createServerClient(url, PUBLIC_KEY, {
        cookies: {
          getAll: () => cookies,
          setAll: values => {
            cookies = values
          },
        },
      })
      const { error } = await client.auth.signInWithPassword({
        email: user.email,
        password: 'fixture-only',
      })
      assert.equal(error, null)
      return cookies.map(({ name, value }) => ({
        name,
        value,
        url: appUrl,
        sameSite: 'Lax',
      }))
    },
    close: () =>
      new Promise(resolve => {
        server.closeAllConnections()
        server.close(resolve)
      }),
  }
}
