import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal, owner, other, seedUsers } from './fixtures.mjs'
import {
  POLICY,
  VERSION,
  ready,
  json,
  service,
  quota,
  snapshots,
  start,
} from './dictionary-creation-dispatch.fixture.mjs'
import {
  configure,
  content,
  verdict,
} from './dictionary-creation-publication.fixture.mjs'
import {
  definitive,
  approved,
  accounting,
  configure as configureRecovery,
} from './dictionary-creation-recovery.fixture.mjs'

const { createCreationStore } =
  await import('../../supabase/functions/dictionary-creation/store.ts')
const { createDictionaryCreationHandler } =
  await import('../../supabase/functions/dictionary-creation/handler.ts')
const { parseCreationGrant } =
  await import('../../supabase/functions/dictionary-creation/contracts.ts')
let db
const profile = {
  generation_model: 'gemini-generator-fixture',
  judgement_model: 'gemini-judge-fixture',
  prompt_sha256: 'c'.repeat(64),
  validator_version: VERSION,
  policy_sha256: POLICY,
}
const UNKNOWN = 'provider-outcome-unknown'
const FAILED = 'provider-failed'
before(async () => {
  db = await createCluster({
    // Historical core contract; current paid containment uses all migrations in dictionary-paid-* and the endpoint suite.
    throughMigration:
      '20261025093000_add_dictionary_capability_release_gate.sql',
  })
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

const client = (actor, events, hooks = {}) => ({
  async rpc(name, params) {
    events.push({ rpc: name, role: actor ? 'caller' : 'service', params })
    assert.match(name, /^[a-z_0-9]+$/)
    const args = Object.entries(params)
      .map(([key, value]) => {
        assert.match(key, /^p_[a-z_0-9]+$/)
        return `${key} => ${typeof value === 'boolean' ? String(value) : value !== null && typeof value === 'object' ? `${literal(JSON.stringify(value))}::JSONB` : literal(value)}`
      })
      .join(',')
    try {
      if (hooks.beforeRpc) await hooks.beforeRpc(name)
      const data = await json(
        db,
        (actor ? sql => asUser(actor, sql) : service)(
          `SELECT public.${name}(${args});`
        )
      )
      if (hooks.afterRpc) await hooks.afterRpc(name, data)
      return { data, error: null }
    } catch (error) {
      const message =
        /ERROR:\s+(?:[A-Z0-9]+:\s+)?([^\n]+)/.exec(error.message)?.[1] ??
        error.message
      return { data: null, error: { message } }
    }
  },
})
const request = command =>
  new Request('https://fixture.invalid/creation', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer local-fixture',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
function handler(options = {}) {
  const events = [],
    calls = []
  const actor = options.actor ?? owner
  const store = createCreationStore(
    client(actor, events, options),
    client(null, events, options)
  )
  const http = createDictionaryCreationHandler({
    verifyUser: async () => (options.verify ? options.verify() : actor),
    forCaller: () => ({
      store,
      profile,
      transport: {
        async invoke(phase, grant) {
          calls.push({ phase, grant })
          // Both intents are already committed; quota and run/fence binding are real SQL.
          const table = phase === 'generation' ? 'generation' : 'judge'
          assert.equal(
            await db.sql(
              `SELECT status FROM private.dictionary_creation_${table}_attempts WHERE run_id='${grant.run_id}';`
            ),
            'dispatching'
          )
          if (options.invoke) return options.invoke(phase, grant)
          return {
            kind: 'returned',
            result:
              phase === 'generation'
                ? {
                    content: content(),
                    confidence: 1,
                    reasoning: 'Not judge evidence',
                  }
                : verdict(grant),
            requestId: `fixture:${phase}:${grant.run_id}`,
          }
        },
      },
    }),
  })
  return { http, calls, events }
}
const invoke = async (h, command) => {
  const response = await h.http(request(command))
  return { status: response.status, body: await response.json() }
}
async function fixture() {
  await configure(db)
  return ready(db)
}
const persisted = f =>
  json(
    db,
    service(
      `SELECT public.get_dictionary_creation_work_v1('${f.actor}','${f.cmd.operation_id}');`
    )
  )

test('SQL generation grant matches exact neutral transport schema and canonical hash', async () => {
  const f = await fixture()
  const result = await start(db, f)
  await parseCreationGrant(
    result.dispatch,
    'generation',
    f.run,
    result.receipt,
    profile
  )
})

test('creation HTTP publishes first revision from two committed fake grants and never writes personal/SRS state', async () => {
  const f = await fixture(),
    beforeState = await snapshots(db),
    h = handler()
  const result = await invoke(h, f.cmd)
  assert.equal(
    result.status,
    200,
    JSON.stringify({
      result,
      calls: h.calls.length,
      rpc: h.events.map(e => e.rpc),
    })
  )
  assert.equal(result.body.status, 'published')
  assert.equal(await quota(db), 2)
  assert.deepEqual(
    h.calls.map(c => c.phase),
    ['generation', 'judgement']
  )
  assert.equal(
    h.calls.every(c => c.grant.run_id === f.run && c.grant.fence === '1'),
    true
  )
  const sent = JSON.stringify(h.calls)
  for (const privateText of [
    'Private owner hint',
    'original_query',
    'meaning_hint',
    'confidence',
    'reasoning',
    'Not judge evidence',
  ])
    assert.equal(sent.includes(privateText), false)
  assert.equal(
    await db.sql(
      `SELECT revision_no FROM public.dictionary_revisions WHERE entry_id='${f.identity.entry_id}';`
    ),
    '1'
  )
  assert.deepEqual(await snapshots(db), beforeState)
  assert.deepEqual((await invoke(h, f.cmd)).body, result.body)
  assert.equal(h.calls.length, 2)
  assert.equal(await quota(db), 2)
})
for (const lost of [
  'record_dictionary_creation_result_v1',
  'record_dictionary_creation_judgement_v1',
  'validate_dictionary_creation_v1',
  'publish_dictionary_creation_v1',
]) {
  test(`lost committed ${lost} reply recovers without another provider call or quota`, async () => {
    const f = await fixture()
    let fired = false
    const h = handler({
      afterRpc(name) {
        if (name === lost && !fired) {
          fired = true
          throw new Error('local-lost-reply')
        }
      },
    })
    assert.equal((await invoke(h, f.cmd)).status, 503)
    const result = await invoke(h, f.cmd)
    assert.equal(result.body.status, 'published')
    assert.equal(h.calls.length, 2)
    assert.equal(await quota(db), 2)
  })
}
for (const phase of ['generation', 'judgement']) {
  test(`lost committed ${phase} dispatch reply never grants a second fake call`, async () => {
    const f = await fixture(),
      target =
        phase === 'generation'
          ? 'start_dictionary_creation_dispatch_v1'
          : 'start_dictionary_creation_judgement_v1'
    let fired = false
    const h = handler({
      afterRpc(name) {
        if (name === target && !fired) {
          fired = true
          throw new Error('local-lost-grant')
        }
      },
    })
    assert.equal((await invoke(h, f.cmd)).status, 503)
    const calls = h.calls.length
    const replay = await invoke(h, f.cmd)
    assert.equal(replay.status, 202)
    assert.equal(h.calls.length, calls)
    assert.equal(await quota(db), phase === 'generation' ? 1 : 2)
  })
  for (const kind of [FAILED, UNKNOWN, 'throw']) {
    test(`${phase} ${kind} is durable and cannot redispatch on HTTP replay`, async () => {
      const f = await fixture(),
        h = handler({
          invoke(p, grant) {
            if (p !== phase)
              return {
                kind: 'returned',
                result: { content: content() },
                requestId: `fixture:gen:${grant.run_id}`,
              }
            if (kind === 'throw') throw new Error('secret-provider-error')
            return {
              kind,
              evidence_sha256: kind === FAILED ? 'e'.repeat(64) : null,
            }
          },
        })
      const first = await invoke(h, f.cmd),
        calls = h.calls.length
      assert.equal(first.body.status, kind === FAILED ? kind : UNKNOWN)
      assert.deepEqual((await invoke(h, f.cmd)).body, first.body)
      assert.equal(h.calls.length, calls)
      assert.equal(await quota(db), phase === 'generation' ? 1 : 2)
    })
  }
}
for (const [label, change] of [
  [
    'malformed schema',
    candidate => {
      delete candidate.translations
    },
  ],
  [
    'wrong lexical identity',
    candidate => {
      candidate.article = 'het'
    },
  ],
  [
    'unsafe media',
    candidate => {
      candidate.image_url = 'http://unsafe.invalid/image.png'
    },
  ],
]) {
  test(`${label} persists server rejection before judge quota`, async () => {
    const f = await fixture(),
      candidate = content()
    change(candidate)
    const h = handler({
      invoke() {
        return {
          kind: 'returned',
          result: { content: candidate },
          requestId: `fixture:bad:${f.run}`,
        }
      },
    })
    const result = await invoke(h, f.cmd)
    assert.equal(result.body.status, 'rejected')
    assert.equal(h.calls.length, 1)
    assert.equal(await quota(db), 1)
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM private.dictionary_creation_judge_attempts WHERE run_id='${f.run}';`
      ),
      '0'
    )
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.identity.entry_id}';`
      ),
      '0'
    )
  })
}
for (const change of ['contradicted', 'uncertain', 'ungrounded']) {
  test(`independent ${change} verdict cannot publish or claim worker approval`, async () => {
    const f = await fixture(),
      h = handler({
        invoke(phase, grant) {
          const result =
            phase === 'generation'
              ? { content: content() }
              : verdict(grant, change === 'ungrounded' ? undefined : change)
          if (phase === 'judgement' && change === 'ungrounded')
            result.content.checks[0].anchor_quote = 'Unsupported invented quote'
          return {
            kind: 'returned',
            result,
            requestId: `fixture:${phase}:${grant.run_id}`,
          }
        },
      })
    const result = await invoke(h, f.cmd)
    assert.equal(
      change === 'ungrounded' ? result.status : result.body.status,
      change === 'ungrounded'
        ? 503
        : change === 'contradicted'
          ? 'rejected'
          : 'review-required'
    )
    assert.equal(await quota(db), 2)
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.identity.entry_id}';`
      ),
      '0'
    )
    await invoke(h, f.cmd)
    assert.equal(h.calls.length, 2)
  })
}
test('fresh token withdrawal between committed grant and transport sends nothing and retains conservative intent', async () => {
  const f = await fixture()
  let valid = true
  const h = handler({
    verify: () => (valid ? owner : null),
    afterRpc(name) {
      if (name === 'start_dictionary_creation_dispatch_v1') valid = false
    },
  })
  assert.equal((await invoke(h, f.cmd)).status, 401)
  assert.equal(h.calls.length, 0)
  assert.equal((await persisted(f)).receipt.status, 'dispatching')
  valid = true
  assert.equal((await invoke(h, f.cmd)).status, 202)
  assert.equal(h.calls.length, 0)
  assert.equal(await quota(db), 1)
})
test('SQL rights withdrawal after generation retains result and stops judging', async () => {
  const f = await fixture(),
    h = handler({
      async invoke(phase, grant) {
        assert.equal(phase, 'generation')
        await db.sql(
          `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
        )
        return {
          kind: 'returned',
          result: { content: content() },
          requestId: `fixture:revoked:${grant.run_id}`,
        }
      },
    })
  assert.equal((await invoke(h, f.cmd)).body.status, 'authorization-revoked')
  assert.equal(h.calls.length, 1)
  assert.equal(await quota(db), 1)
})
test('judge quota denial is durable, no judge transport or publication', async () => {
  const f = await fixture()
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=1;'
  )
  const h = handler(),
    result = await invoke(h, f.cmd)
  assert.equal(result.body.status, 'review-required')
  assert.equal(result.body.error_code, 'judge-quota-denied')
  assert.equal(h.calls.length, 1)
  assert.equal(await quota(db), 1)
})
test('closed creation gate blocks an accepted draft without terminalizing or dispatching', async () => {
  const f = await fixture()
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_dispatch_enabled=FALSE;'
  )
  const h = handler()
  assert.equal((await invoke(h, f.cmd)).status, 503)
  assert.equal(h.calls.length, 0)
  assert.equal((await persisted(f)).receipt.status, 'accepted')
  assert.equal(await quota(db), 1)
})
test('different verified owner cannot obtain original run or use its command', async () => {
  const f = await fixture(),
    h = handler({ actor: other })
  assert.equal((await invoke(h, f.cmd)).status, 409)
  assert.equal(h.calls.length, 0)
  assert.equal((await persisted(f)).receipt.status, 'accepted')
})
test('concurrent HTTP invocations use at most one generation and one judge grant', async () => {
  const f = await fixture(),
    h = handler()
  const responses = await Promise.all([invoke(h, f.cmd), invoke(h, f.cmd)])
  assert.equal(
    responses.some(r => r.body.status === 'published'),
    true
  )
  assert.deepEqual(
    h.calls.map(c => c.phase),
    ['generation', 'judgement']
  )
  assert.equal(await quota(db), 2)
})
test('explicit reviewed recovery HTTP command publishes fence2 while prior accounting remains exact', async () => {
  await configureRecovery(db)
  const f = await definitive(db),
    a = await approved(db, f),
    old = await accounting(db, f),
    h = handler()
  const result = await invoke(h, a.cmd)
  assert.equal(result.body.status, 'published')
  assert.equal(result.body.fence, '2')
  assert.equal(
    h.calls.every(c => c.grant.run_id !== f.run && c.grant.fence === '2'),
    true
  )
  assert.deepEqual(await accounting(db, f), old)
  assert.equal(await quota(db), 3)
  assert.deepEqual((await invoke(h, a.cmd)).body, result.body)
  assert.equal(h.calls.length, 2)
})
test('busy and already published meanings return immutable zero-charge responses without worker transport', async () => {
  const f = await fixture(),
    h = handler(),
    busy = { ...f.cmd, operation_id: randomUUID() }
  const busyResponse = await invoke(h, busy)
  assert.equal(busyResponse.body.outcome, 'creation-in-progress')
  assert.equal(h.calls.length, 0)
  await invoke(h, f.cmd)
  const existing = await invoke(h, { ...f.cmd, operation_id: randomUUID() })
  assert.equal(existing.body.outcome, 'existing-meaning')
  assert.equal(h.calls.length, 2)
  assert.equal(await quota(db), 2)
  assert.deepEqual((await invoke(h, busy)).body, busyResponse.body)
})
test('missing generation response remains in-flight on replay, without automatic takeover', async () => {
  const f = await fixture()
  await start(db, f)
  const h = handler()
  assert.equal((await invoke(h, f.cmd)).body.status, 'dispatching')
  assert.equal(h.calls.length, 0)
  assert.equal(await quota(db), 1)
})

for (const phase of ['generation', 'judgement']) {
  test(`missing uncommitted ${phase} journal reply does not manufacture failure or redispatch`, async () => {
    const f = await fixture(),
      target =
        phase === 'generation'
          ? 'record_dictionary_creation_result_v1'
          : 'record_dictionary_creation_judgement_v1'
    const h = handler({
      beforeRpc(name) {
        if (name === target)
          throw new Error('synthetic-uncommitted-journal-loss')
      },
    })
    assert.equal((await invoke(h, f.cmd)).status, 503)
    const beforeCalls = h.calls.length
    assert.equal((await invoke(h, f.cmd)).status, 202)
    assert.equal(h.calls.length, beforeCalls)
    assert.equal(await quota(db), phase === 'generation' ? 1 : 2)
    assert.equal(
      (await persisted(f)).receipt.status,
      phase === 'generation' ? 'dispatching' : 'validating'
    )
  })
  test(`late ${phase} response is journaled unknown and never publishes or redispatches`, async () => {
    const f = await fixture(),
      table = phase === 'generation' ? 'generation' : 'judge'
    // New immutable attempt starts old; never rewrite an existing dispatch timestamp.
    await db.sql(
      `ALTER TABLE private.dictionary_creation_${table}_attempts ALTER COLUMN dispatched_at SET DEFAULT (NOW()-INTERVAL '3 minutes');`
    )
    const h = handler()
    try {
      const result = await invoke(h, f.cmd)
      assert.equal(result.body.status, UNKNOWN)
      const beforeCalls = h.calls.length
      assert.deepEqual((await invoke(h, f.cmd)).body, result.body)
      assert.equal(h.calls.length, beforeCalls)
      assert.equal(
        await db.sql(
          `SELECT result IS NOT NULL FROM private.dictionary_creation_${table}_attempts WHERE run_id='${f.run}';`
        ),
        't'
      )
      assert.equal(
        await db.sql(
          `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.identity.entry_id}';`
        ),
        '0'
      )
    } finally {
      await db.sql(
        `ALTER TABLE private.dictionary_creation_${table}_attempts ALTER COLUMN dispatched_at SET DEFAULT NOW();`
      )
    }
  })
}
test('original publication receipt replays exactly after SQL gates and owner rights are withdrawn', async () => {
  const f = await fixture(),
    h = handler(),
    first = await invoke(h, f.cmd)
  assert.equal(first.body.status, 'published')
  await db.sql(`UPDATE private.dictionary_content_runtime SET creation_dispatch_enabled=FALSE,creation_judgement_enabled=FALSE,creation_publication_enabled=FALSE;
    UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`)
  assert.deepEqual((await invoke(h, f.cmd)).body, first.body)
  assert.equal(h.calls.length, 2)
  assert.equal(await quota(db), 2)
})
test('Auth deletion during paid generation preserves actorless unknown result; recreated UUID gets no old run', async () => {
  const f = await fixture(),
    h = handler({
      async invoke(phase, grant) {
        assert.equal(phase, 'generation')
        await db.sql(`DELETE FROM auth.users WHERE id='${owner}';`)
        return {
          kind: 'returned',
          result: { content: content() },
          requestId: `fixture:deleted:${grant.run_id}`,
        }
      },
    })
  try {
    const result = await invoke(h, f.cmd)
    assert.equal(result.body.status, UNKNOWN)
    assert.equal(h.calls.length, 1)
    assert.equal(
      await db.sql(
        `SELECT actor_id IS NULL FROM private.dictionary_creation_runs WHERE run_id='${f.run}';`
      ),
      't'
    )
    assert.equal(
      await db.sql(
        `SELECT status FROM private.dictionary_creation_generation_attempts WHERE run_id='${f.run}';`
      ),
      'unknown'
    )
  } finally {
    await db.sql(
      `INSERT INTO auth.users(id,email) VALUES('${owner}','review-owner@example.invalid');`
    )
  }
  assert.equal(
    await json(
      db,
      service(
        `SELECT public.get_dictionary_creation_work_v1('${owner}','${f.cmd.operation_id}');`
      )
    ),
    null
  )
  assert.notEqual((await invoke(h, f.cmd)).status, 200)
  assert.equal(h.calls.length, 1)
})
