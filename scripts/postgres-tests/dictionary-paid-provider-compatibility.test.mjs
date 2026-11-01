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
  modelLimits,
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
async function quarantine(f, phase) {
  if (f.workflow === 'analysis') {
    const rpc =
      phase === 'generation'
        ? 'record_dictionary_analysis_failure_v1'
        : 'record_dictionary_semantic_failure_v1'
    await db.sql(
      service(
        `SELECT public.${rpc}('${owner}','${f.operation}','1','provider-outcome-unknown',NULL);`
      )
    )
  } else {
    const table =
      phase === 'generation'
        ? 'dictionary_creation_generation_attempts'
        : 'dictionary_creation_judge_attempts'
    const rpc =
      phase === 'generation'
        ? 'record_dictionary_creation_failure_v1'
        : 'fail_dictionary_creation_judgement_v1'
    const hash = await db.sql(
      `SELECT input_sha256 FROM private.${table} WHERE run_id='${f.run}';`
    )
    await db.sql(
      service(
        `SELECT public.${rpc}('${f.run}','1','${hash}',FALSE,'${'a'.repeat(64)}');`
      )
    )
  }
}
const normalizedUsage = model =>
  usage(model, {
    cachedContentTokenCount: 0,
    thoughtsTokenCount: 0,
    totalTokenCount: 26,
  })
const candidateLimits = fields =>
  modelLimits(GENERATOR, {
    max_request_bytes: '32768',
    max_input_tokens: '1048576',
    input_nanousd_per_token: '750',
    cached_nanousd_per_token: '75',
    output_nanousd_per_token: '3750',
    ...fields,
  })
const ceiling = limits =>
  db.sql(
    `SELECT private.dictionary_paid_model_ceiling(${literal(JSON.stringify(limits))}::JSONB);`
  )
for (const tokens of ['1000000', '1000001', '1048576'])
  test(`model input ceiling accepts ${tokens} and reserves the exact worst case`, async () => {
    assert.equal(
      await ceiling(candidateLimits({ max_input_tokens: tokens })),
      (BigInt(tokens) * 750n + 8192n * 3750n).toString()
    )
  })
for (const value of [
  '0',
  '-1',
  '1048577',
  '1.5',
  'invalid',
  '9223372036854775808',
  1048576,
  null,
])
  test(`model input ceiling rejects ${JSON.stringify(value)}`, async () => {
    await assert.rejects(
      ceiling(candidateLimits({ max_input_tokens: value })),
      /invalid-paid-model-limits/
    )
  })
test('provider-sized profile preserves byte/output caps and monetary overflow protection', async () => {
  for (const fields of [
    { max_request_bytes: '32769' },
    { max_output_tokens: '8193' },
  ])
    await assert.rejects(
      ceiling(candidateLimits(fields)),
      /invalid-paid-model-limits/
    )
  await assert.rejects(
    ceiling(
      candidateLimits({ input_nanousd_per_token: '9223372036854775807' })
    ),
    /paid-money-overflow/
  )
})
test('full provider pair reserves exactly; one nanoUSD short rejects without a partial grant', async () => {
  const models = {
    [GENERATOR]: candidateLimits(),
    [JUDGE]: candidateLimits({ model_version: JUDGE }),
  }
  let release = await paidRelease(db, { models, limit: '1634303999', calls: 4 })
  const before = await paidState(db, release)
  await assert.rejects(grantPair(db), /rate-limit-exceeded/)
  assert.deepEqual(await paidState(db, release), before)
  assert.equal(await ledger(release), null)
  release = await paidRelease(db, { models, limit: '1634304000', calls: 4 })
  await grantPair(db)
  assert.deepEqual(await paidState(db, release), {
    enabled: true,
    held: '1634304000',
    settled: '0',
    calls: 1,
  })
  assert.deepEqual(
    (await ledger(release)).map(a => a.reserved_nanousd),
    [817152000, 817152000]
  )
})
test('four aggregate grants cannot be refilled by unissued claims or another workflow', async () => {
  const release = await paidRelease(db, { calls: 4 })
  for (let i = 0; i < 4; i++) await grantPair(db)
  const before = await paidState(db, release),
    rows = await ledger(release)
  await assert.rejects(
    grantPair(db, { workflow: 'creation' }),
    /rate-limit-exceeded/
  )
  assert.equal(before.calls, 4)
  assert.deepEqual(await paidState(db, release), before)
  assert.deepEqual(await ledger(release), rows)
})
for (const workflow of ['analysis', 'creation']) {
  for (const phase of ['generation', 'judgement']) {
    for (const omitted of [
      ['cachedContentTokenCount'],
      ['thoughtsTokenCount'],
      ['cachedContentTokenCount', 'thoughtsTokenCount'],
    ]) {
      test(`${workflow} ${phase}: omitted ${omitted.join('+')} settles as explicit zero and replays once`, async () => {
        const { release, f } = await prepared(workflow, phase),
          before = await paidState(db, release)
        const model = phase === 'generation' ? GENERATOR : JUDGE
        const value = normalizedUsage(model)
        for (const key of omitted) delete value[key]
        const result = packet(model, value),
          id = randomUUID()
        const receipt = await journalPhase(f, phase, result, id)
        const rows = await ledger(release),
          a = rows.find(
            a => a.operation_id === f.operation && a.phase === phase
          )
        assert.equal(a.state, 'settled')
        assert.equal(a.actual_nanousd, 26)
        assert.deepEqual(a.usage, normalizedUsage(model))
        assert.equal(
          a.evidence_sha256,
          await db.sql(
            `SELECT private.dictionary_canonical_sha256(${literal(JSON.stringify(result))}::JSONB);`
          )
        )
        assert.deepEqual(await retainedResult(f, phase), result)
        const after = await paidState(db, release)
        assert.deepEqual(after, {
          ...before,
          held: (BigInt(before.held) - 8292n).toString(),
          settled: (BigInt(before.settled) + 26n).toString(),
        })
        assert.deepEqual(await journalPhase(f, phase, result, id), receipt)
        assert.deepEqual(await paidState(db, release), after)
        assert.deepEqual(await ledger(release), rows)
      })
    }
    const invalid = [
      [
        'cache-null',
        r => {
          r.provider_response.usageMetadata.cachedContentTokenCount = null
        },
      ],
      [
        'thought-null',
        r => {
          r.provider_response.usageMetadata.thoughtsTokenCount = null
        },
      ],
      [
        'cache-string',
        r => {
          r.provider_response.usageMetadata.cachedContentTokenCount = '0'
        },
      ],
      [
        'thought-negative',
        r => {
          r.provider_response.usageMetadata.thoughtsTokenCount = -1
        },
      ],
      [
        'thought-fractional',
        r => {
          r.provider_response.usageMetadata.thoughtsTokenCount = 0.5
        },
      ],
      [
        'missing-prompt',
        r => {
          delete r.provider_response.usageMetadata.promptTokenCount
        },
      ],
      [
        'missing-total',
        r => {
          delete r.provider_response.usageMetadata.totalTokenCount
        },
      ],
      [
        'missing-candidate',
        r => {
          delete r.provider_response.usageMetadata.candidatesTokenCount
        },
      ],
      [
        'missing-version',
        r => {
          delete r.provider_response.modelVersion
        },
      ],
      [
        'wrong-version',
        r => {
          r.provider_response.modelVersion = 'gemini-unexpected'
        },
      ],
      [
        'wrong-total',
        r => {
          r.provider_response.usageMetadata.totalTokenCount++
        },
      ],
      [
        'tool-use-total',
        r => {
          r.provider_response.usageMetadata.toolUsePromptTokenCount = 1
          r.provider_response.usageMetadata.totalTokenCount++
        },
      ],
    ]
    for (const [label, change] of invalid) {
      test(`${workflow} ${phase}: ${label} remains quarantined and freezes the release`, async () => {
        const { release, f } = await prepared(workflow, phase),
          before = await paidState(db, release)
        const model = phase === 'generation' ? GENERATOR : JUDGE
        const result = packet(model, normalizedUsage(model))
        change(result)
        await journalPhase(f, phase, result, randomUUID())
        const a = (await ledger(release)).find(
          a => a.operation_id === f.operation && a.phase === phase
        )
        assert.equal(a.state, 'unknown')
        assert.equal(a.actual_nanousd, null)
        assert.deepEqual(await paidState(db, release), {
          ...before,
          enabled: false,
        })
        assert.deepEqual(await retainedResult(f, phase), result)
        await assert.rejects(grantPair(db), /shared-analysis-disabled/)
      })
    }
    for (const malformed of [false, true]) {
      test(`${workflow} ${phase}: late omitted counters ${malformed ? 'with null freeze' : 'remain valid'} without resettling uncertainty`, async () => {
        const { release, f } = await prepared(workflow, phase)
        await quarantine(f, phase)
        const rows = await ledger(release),
          before = await paidState(db, release)
        const model = phase === 'generation' ? GENERATOR : JUDGE,
          value = normalizedUsage(model)
        delete value.cachedContentTokenCount
        delete value.thoughtsTokenCount
        if (malformed) value.thoughtsTokenCount = null
        await journalPhase(f, phase, packet(model, value), randomUUID())
        assert.deepEqual(await ledger(release), rows)
        assert.deepEqual(await paidState(db, release), {
          ...before,
          enabled: !malformed,
        })
      })
    }
  }
}
test('rolling back normalized journal restores raw business and monetary evidence', async () => {
  const { release, f } = await prepared('analysis', 'generation'),
    before = await paidState(db, release),
    rows = await ledger(release)
  const value = normalizedUsage(GENERATOR)
  delete value.cachedContentTokenCount
  const result = packet(GENERATOR, value)
  await db.sql(
    `BEGIN; ${service(`SELECT public.journal_dictionary_analysis_result_v1('${owner}','${f.operation}','1',${literal(JSON.stringify(result))}::JSONB,${literal(randomUUID())});`)} ROLLBACK;`
  )
  assert.deepEqual(await paidState(db, release), before)
  assert.deepEqual(await ledger(release), rows)
  assert.equal(await retainedResult(f, 'generation'), null)
})
test('compatibility helpers remain unavailable to public, mobile and service callers', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [
      'private.dictionary_paid_model_ceiling(jsonb)',
      'private.dictionary_paid_usage_cost(jsonb,jsonb,bigint)',
      'private.journal_dictionary_paid_result()',
    ])
      assert.equal(
        await db.sql(
          `SELECT has_function_privilege('${role}',${literal(signature)},'EXECUTE');`
        ),
        'f'
      )
  }
})
