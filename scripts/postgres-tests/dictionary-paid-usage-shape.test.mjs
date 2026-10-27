import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { owner, seedUsers, literal } from './fixtures.mjs'
import {
  GENERATOR,
  JUDGE,
  PAID_POLICY,
  paidRelease,
  paidState,
  grantPair,
  claimPaid,
  usage,
} from './dictionary-paid.fixture.mjs'
import { content, judge } from './dictionary-creation-publication.fixture.mjs'
import { json, service } from './dictionary-creation-dispatch.fixture.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})
const absent = Symbol('absent')
const shapes = [
  ['array', []],
  ['string', 'invalid-usage'],
  ['number', 42],
  ['boolean', false],
  ['explicit-null', null],
  ['malformed-object', {}],
  ['absent', absent],
  ['valid', usage()],
]
const packet = (model, value) => ({
  content: content(),
  provider_response: {
    modelVersion: model,
    ...(value === absent ? {} : { usageMetadata: value }),
  },
})
const ledger = release =>
  json(
    db,
    `SELECT JSONB_AGG(TO_JSONB(a) ORDER BY phase) FROM private.dictionary_paid_attempts a WHERE release_id='${release}';`
  )

async function journalPhase(f, phase, result, requestId) {
  const raw = literal(JSON.stringify(result)),
    id = literal(requestId)
  if (f.workflow === 'analysis') {
    const rpc =
      phase === 'generation'
        ? 'journal_dictionary_analysis_result_v1'
        : 'journal_dictionary_semantic_result_v1'
    return json(
      db,
      service(
        `SELECT public.${rpc}('${owner}','${f.operation}','1',${raw}::JSONB,${id});`
      )
    )
  }
  const table =
    phase === 'generation'
      ? 'dictionary_creation_generation_attempts'
      : 'dictionary_creation_judge_attempts'
  const rpc =
    phase === 'generation'
      ? 'record_dictionary_creation_result_v1'
      : 'record_dictionary_creation_judgement_v1'
  const hash = await db.sql(
    `SELECT input_sha256 FROM private.${table} WHERE run_id='${f.run}';`
  )
  return json(
    db,
    service(
      `SELECT public.${rpc}('${f.run}','1','${hash}',${raw}::JSONB,${id});`
    )
  )
}
async function prepared(workflow, phase) {
  const release = await paidRelease(db),
    f = { ...(await grantPair(db, { workflow })), workflow }
  await claimPaid(db, f)
  if (phase === 'judgement') {
    const result = packet(GENERATOR, usage())
    await journalPhase(f, 'generation', result, randomUUID())
    if (workflow === 'analysis') {
      const hash = await db.sql(
        `SELECT private.dictionary_canonical_sha256(${literal(JSON.stringify(result.content))}::JSONB);`
      )
      assert.equal(
        (
          await json(
            db,
            service(
              `SELECT public.start_dictionary_semantic_check_v1('${owner}','${f.operation}','1','paid-ledger-fixture','${PAID_POLICY}','${JUDGE}','${'c'.repeat(64)}','${hash}','${'a'.repeat(64)}');`
            )
          )
        ).dispatch,
        true
      )
    } else assert.ok((await judge(db, f)).dispatch)
    const key =
      workflow === 'analysis' ? 'semantic:' + f.key : `${f.run}:judgement:1`
    assert.equal((await claimPaid(db, f, { key, model: JUDGE })).allowed, true)
  }
  return { release, f }
}
async function retainedResult(f, phase) {
  if (f.workflow === 'analysis') {
    const table =
      phase === 'generation'
        ? 'dictionary_analysis_results'
        : 'dictionary_semantic_checks'
    return json(
      db,
      `SELECT result FROM private.${table} WHERE actor_id='${owner}' AND operation_id='${f.operation}';`
    )
  }
  const table =
    phase === 'generation'
      ? 'dictionary_creation_generation_attempts'
      : 'dictionary_creation_judge_attempts'
  return json(
    db,
    `SELECT result FROM private.${table} WHERE run_id='${f.run}';`
  )
}
for (const workflow of ['analysis', 'creation']) {
  for (const phase of ['generation', 'judgement']) {
    for (const [shape, value] of shapes) {
      test(`${workflow} ${phase}: ${shape} usage preserves evidence and applies the correct spend stop`, async () => {
        const { release, f } = await prepared(workflow, phase)
        // An already committed unrelated grant must also be denied if this result freezes the envelope.
        const pending = await grantPair(db)
        const before = await paidState(db, release)
        const model = phase === 'generation' ? GENERATOR : JUDGE
        const result = packet(model, value),
          requestId = randomUUID()
        const receipt = await journalPhase(f, phase, result, requestId)
        const isValid = shape === 'valid',
          isAbsent = shape === 'absent'
        const after = await paidState(db, release)
        assert.equal(after.enabled, isValid || isAbsent)
        assert.equal(
          after.held,
          (BigInt(before.held) - (isValid ? 8292n : 0n)).toString()
        )
        assert.equal(
          after.settled,
          (BigInt(before.settled) + (isValid ? 25n : 0n)).toString()
        )
        assert.equal(after.calls, before.calls)
        const rows = await ledger(release),
          attempt = rows.find(
            a => a.operation_id === f.operation && a.phase === phase
          )
        assert.equal(attempt.state, isValid ? 'settled' : 'unknown')
        assert.equal(attempt.actual_nanousd, isValid ? 25 : null)
        assert.equal(
          attempt.evidence_sha256,
          await db.sql(
            `SELECT private.dictionary_canonical_sha256(${literal(JSON.stringify(result))}::JSONB);`
          )
        )
        if (!isValid && shape !== 'malformed-object')
          assert.deepEqual(attempt.usage, isAbsent ? null : value)
        assert.equal(
          await db.sql(
            `SELECT usage IS NULL FROM private.dictionary_paid_attempts WHERE attempt_id='${attempt.attempt_id}';`
          ),
          isAbsent ? 't' : 'f'
        )
        assert.deepEqual(await retainedResult(f, phase), result)
        assert.deepEqual(
          await journalPhase(f, phase, result, requestId),
          receipt
        )
        assert.deepEqual(await ledger(release), rows)
        assert.deepEqual(await paidState(db, release), after)
        if (isValid || isAbsent)
          assert.equal((await claimPaid(db, pending)).allowed, true)
        else {
          await assert.rejects(
            claimPaid(db, pending),
            /paid-dispatch-unavailable/
          )
          await assert.rejects(grantPair(db), /shared-analysis-disabled/)
          assert.deepEqual(await paidState(db, release), after)
          assert.deepEqual(await ledger(release), rows)
        }
      })
    }
  }
}
