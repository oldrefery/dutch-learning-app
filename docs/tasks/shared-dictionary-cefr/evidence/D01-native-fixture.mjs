import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import {
  createFixture,
  USER_ID,
} from '../../../../scripts/web-performance/fixture-backend.mjs'

const count = Number(process.argv[2] ?? 500)
assert.ok([500, 2500].includes(count))
const time = '2026-09-12T00:00:00.000Z'
const fixture = createFixture({ words: count, events: 0 })
const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'd01@example.invalid',
  email_confirmed_at: time,
  created_at: time,
  updated_at: time,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
}
const words = fixture.words.map(word => ({
  ...word,
  updated_at: time,
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  is_separable: false,
  expression_type: null,
  prefix_part: null,
  root_verb: null,
  plural: null,
  register: 'neutral',
  examples: [],
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: '',
  usage_notes: null,
}))
const tables = {
  words,
  collections: fixture.collections.map(c => ({
    ...c,
    updated_at: time,
    description: null,
    shared_with: null,
    share_token: null,
  })),
  user_progress: [],
  review_events: [],
  review_assessment_corrections: [],
  review_progress_heads: [],
  review_progress_checkpoints: [],
  user_access_levels: [{ user_id: USER_ID, access_level: 'full_access' }],
  users: [
    { user_id: USER_ID, email: user.email, created_at: time, updated_at: time },
  ],
}
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
function token() {
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + 86400,
  })}`
  return `${unsigned}.${createHmac('sha256', 'd01-local-synthetic-only').update(unsigned).digest('base64url')}`
}
let requests = 0
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:58170')
  let status = 200,
    body
  try {
    assert.ok(
      ['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(
        req.socket.remoteAddress
      )
    )
    if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
      let input = ''
      for await (const chunk of req) {
        input += chunk
        assert.ok(input.length < 4096)
      }
      const data = JSON.parse(input)
      const grant = url.searchParams.get('grant_type')
      assert.ok(
        (grant === 'refresh_token' &&
          data.refresh_token === 'd01-local-refresh') ||
          (grant === 'password' &&
            data.email === user.email &&
            data.password === 'fixture-only-password')
      )
      body = {
        access_token: token(),
        refresh_token: 'd01-local-refresh',
        token_type: 'bearer',
        expires_in: 86400,
        user,
      }
    } else if (req.method === 'GET' && url.pathname === '/auth/v1/user')
      body = user
    else if (
      ['GET', 'POST'].includes(req.method) &&
      url.pathname === '/rest/v1/rpc/learning_sync_protocol'
    )
      body = 2
    else if (
      ['GET', 'POST'].includes(req.method) &&
      url.pathname === '/rest/v1/rpc/review_correction_protocol'
    )
      body = 1
    else {
      assert.equal(req.method, 'GET', 'Fixture forbids database writes')
      assert.ok(url.pathname.startsWith('/rest/v1/'))
      const table = url.pathname.split('/').at(-1)
      const rows = tables[table]
      assert.ok(rows, 'Unsupported fixture table')
      assert.ok(
        url.searchParams.get('user_id') === `eq.${USER_ID}` ||
          (table === 'users' &&
            url.searchParams.get('user_id') === `eq.${USER_ID}`)
      )
      const from = Number(
        url.searchParams.get('offset') ??
          String(req.headers.range ?? '0').split('-')[0]
      )
      const size = Number(url.searchParams.get('limit') ?? 1000)
      assert.ok(
        Number.isSafeInteger(from) &&
          from >= 0 &&
          Number.isSafeInteger(size) &&
          size > 0
      )
      const columns = url.searchParams.get('select') ?? '*'
      body = rows
        .slice(from, from + size)
        .map(row =>
          columns === '*'
            ? row
            : Object.fromEntries(
                columns.split(',').map(k => [k, row[k] ?? null])
              )
        )
      if (String(req.headers.accept).includes('vnd.pgrst.object')) {
        assert.equal(body.length, 1)
        body = body[0]
      }
      res.setHeader(
        'Content-Range',
        `${from}-${Math.max(from, Math.min(from + size, rows.length) - 1)}/${rows.length}`
      )
    }
  } catch (error) {
    status = 400
    body = { message: 'Unsupported or invalid local fixture request' }
  }
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
  console.log(
    JSON.stringify({
      request: ++requests,
      method: req.method,
      path: url.pathname,
      status,
    })
  )
})
server.listen(58170, '127.0.0.1', () =>
  console.log(
    JSON.stringify({
      ready: true,
      words: count,
      origin: 'http://127.0.0.1:58170',
    })
  )
)
process.on('SIGTERM', () => server.close())
