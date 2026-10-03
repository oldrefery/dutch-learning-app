import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadDiagnosticBundle } from './diagnostic-bundle.ts'
import {
  loadDiagnosticExecution,
  bindExecutionHttp,
  diagnosticImplementationSha256,
} from './diagnostic-execution.ts'
import { runGeminiDiagnostic } from './diagnostic-runner.ts'
import { buildReport } from './diagnostic-report.ts'
import { openRun } from './diagnostic-store.ts'
import {
  GEMINI_BASE,
  GEMINI_MODEL,
  type TestHttp,
} from './diagnostic-gemini.ts'

const evidence = 'docs/tasks/shared-dictionary-cefr/evidence/'
const paths = {
  worklist: `${evidence}D11-pilot-review-worklist.json`,
  reference: `${evidence}D11-pilot-provisional-reference.json`,
  profile: `${evidence}D11-pilot-profile.proposed.json`,
  prompt: `${evidence}D11-pilot-prompt.txt`,
  proposal: `${evidence}D11-pilot-proposal-summary.json`,
}
const bundle = loadDiagnosticBundle(paths)
const sha = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex')
const key = 'TEST-ONLY-NOT-A-CREDENTIAL'
const generationSuffix = ':generateContent'
const json = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
const metadata = {
  name: `models/${GEMINI_MODEL}`,
  baseModelId: GEMINI_MODEL,
  version: '3.5',
  inputTokenLimit: 1000000,
  outputTokenLimit: 65536,
  thinking: true,
  supportedGenerationMethods: ['generateContent', 'countTokens'],
}
const generation = (init: RequestInit, sequence: number) => {
  const body = JSON.parse(String(init.body)) as {
    contents: { parts: { text: string }[] }[]
  }
  const identity = JSON.parse(
    body.contents[0].parts[0].text.split('\n')[1]
  ) as { job_id: string }
  const ambiguous = /pilot-2[34]$/.test(identity.job_id)
  return {
    responseId: `TEST-ONLY-response-${sequence}`,
    modelVersion: GEMINI_MODEL,
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              text: JSON.stringify({
                ...identity,
                ambiguous,
                candidate: {
                  level: ambiguous ? null : 'A1',
                  confidence: ambiguous ? null : 0.5,
                },
              }),
            },
          ],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 10,
      totalTokenCount: 130,
      serviceTier: 'standard',
    },
  }
}
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'd11-runner-test-'))
  const runDir = join(root, 'run'),
    draftPath = join(root, 'draft.json'),
    authorizationPath = join(root, 'authorization.json'),
    credentialPath = join(root, 'key.txt')
  const draft = readFileSync(`${evidence}D11-gemini-live-request.proposed.json`)
  writeFileSync(draftPath, draft, { mode: 0o600 })
  writeFileSync(credentialPath, key, { mode: 0o600 })
  let milliseconds = Date.now()
  const day = new Date(milliseconds).toISOString().slice(0, 10)
  const raw = {
    namespace: 'dictionary-cefr-execution-v1',
    approved: true,
    execution_enabled: true,
    approval_kind: 'test-only',
    implementation_revision: 'd11-gemini-runner-v1',
    implementation_sha256: diagnosticImplementationSha256(),
    bundle_sha256: bundle.bindingSha256,
    draft_sha256: sha(draft),
    credential_sha256: sha(key),
    run_dir: runDir,
    run_id: '11111111-1111-4111-8111-111111111111',
    utc_day: day,
    expires_at: new Date(
      Math.min(milliseconds + 120000, Date.parse(`${day}T23:59:59.999Z`))
    ).toISOString(),
    approval_ref: 'TEST-ONLY-approval',
    account: {
      personal: true,
      paid_tier: true,
      account_ref: 'TEST-ONLY-account',
      project_ref: 'TEST-ONLY-project',
      verification_ref: 'TEST-ONLY-verification',
    },
    pricing: {
      model: GEMINI_MODEL,
      service_tier: 'standard',
      rates_microusd_per_token: bundle.rates,
      api_use_ceiling_microusd: bundle.ceiling,
      pricing_ref:
        'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash',
      count_request_max_microusd: 1000,
      metadata_request_max_microusd: 500,
      control_billing_verification_ref: 'TEST-ONLY-billing',
      total_reserved_tokens: 340608,
    },
    sources: bundle.meanings.map(item => ({
      item_id: item.id,
      input_sha256: item.inputHash,
      approval_ref: 'TEST-ONLY-source',
    })),
  }
  const save = () =>
    writeFileSync(authorizationPath, JSON.stringify(raw), { mode: 0o600 })
  save()
  const options = {
    bundle,
    draftPath,
    authorizationPath,
    credentialPath,
    runDir,
  }
  const load = () =>
    loadDiagnosticExecution({ ...options, now: new Date(milliseconds) })
  const calls: { url: string; init: RequestInit }[] = []
  let generations = 0
  const success: TestHttp = async (url, init) => {
    calls.push({ url, init })
    assert.equal(
      (init.headers as Record<string, string>)['x-goog-api-key'],
      key
    )
    if (url === GEMINI_BASE) return json(metadata)
    if (url.endsWith(':countTokens')) return json({ totalTokens: 100 })
    return json(generation(init, ++generations))
  }
  const runner = (execution = load(), http = success) => ({
    bundle,
    execution,
    http,
    now: () => new Date(milliseconds),
    wait: async (ms: number) => {
      milliseconds += ms
    },
    jitter: () => 0,
  })
  const report = (execution = load()) => {
    const db = openRun(runDir, bundle, new Date(milliseconds), execution)
    try {
      return buildReport(db, bundle)
    } finally {
      db.close()
    }
  }
  return {
    root,
    raw,
    save,
    options,
    load,
    calls,
    success,
    runner,
    report,
    advance: (ms: number) => {
      milliseconds += ms
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

test('scoped runner combines controls and generations, caches exact bodies and resumes without HTTP', async () => {
  const f = fixture()
  try {
    const execution = f.load(),
      report = await runGeminiDiagnostic(f.runner(execution))
    assert.equal(f.calls.length, 49)
    assert.deepEqual(report.reserved_all, {
      requests: 49,
      tokens: 194304,
      microusd: 981236,
    })
    assert.deepEqual(report.reserved, {
      requests: 24,
      tokens: 146304,
      microusd: 956736,
    })
    assert.equal(report.controls.reserved_microusd, 24500)
    assert.equal(report.controls.observed_microusd, null)
    assert.equal(report.controls.unknown_outcomes, 0)
    assert.equal(report.observed.microusd, 10080)
    assert.equal(report.total.known, 22)
    assert.equal(report.total.abstained, 2)
    assert.equal(report.provenance, 'injected_http')
    assert.equal(report.qualified, false)
    assert.equal(report.calibration_eligible, false)
    assert.equal(JSON.stringify(report).includes(key), false)
    assert.equal(JSON.stringify(execution).includes(key), false)
    for (let index = 1; index < f.calls.length; index += 2) {
      const count = JSON.parse(String(f.calls[index].init.body)) as {
        generateContentRequest: unknown
      }
      assert.deepEqual(
        count.generateContentRequest,
        JSON.parse(String(f.calls[index + 1].init.body))
      )
    }
    assert.equal(
      (await runGeminiDiagnostic(f.runner(execution))).sha256,
      report.sha256
    )
    assert.equal(f.calls.length, 49)
  } finally {
    f.cleanup()
  }
})

test('transient retry obeys Retry-After, keeps stable identity and charges both attempts', async () => {
  const f = fixture()
  try {
    let first = true,
      waited = 0
    const opts = f.runner(f.load(), async (url, init) => {
      if (url.endsWith(generationSuffix) && first) {
        first = false
        f.calls.push({ url, init })
        return json({}, 429, { 'retry-after': '2' })
      }
      return f.success(url, init)
    })
    opts.wait = async ms => {
      waited += ms
      f.advance(ms)
    }
    const report = await runGeminiDiagnostic(opts)
    assert.equal(waited, 2000)
    assert.equal(report.reserved.requests, 25)
    assert.equal(report.controls.requests, 25)
    assert.equal(report.observed.unknown_usage, 1)
    assert.equal(f.calls[2].init.body, f.calls[3].init.body)
  } finally {
    f.cleanup()
  }
})

for (const variant of [
  'permanent',
  'receipt',
  'long_delay',
  'version_change',
] as const) {
  test(`batch stop is durable after ${variant}`, async () => {
    const f = fixture()
    try {
      let n = 0
      const http: TestHttp = async (url, init) => {
        if (!url.endsWith(generationSuffix)) return f.success(url, init)
        f.calls.push({ url, init })
        if (variant === 'permanent') return json({}, 401)
        if (variant === 'receipt') return json({ invalid: true })
        if (variant === 'long_delay')
          return json({}, 503, { 'retry-after': '6' })
        const raw = generation(init, ++n)
        if (n > 1) raw.modelVersion = 'gemini-3.5-flash-001'
        return json(raw)
      }
      const opts = f.runner(f.load(), http)
      await assert.rejects(runGeminiDiagnostic(opts), /provider_rejected/)
      const calls = f.calls.length
      await assert.rejects(runGeminiDiagnostic(opts), /provider_rejected/)
      assert.equal(f.calls.length, calls)
      assert.equal(f.report(opts.execution).total.failed, 1)
    } finally {
      f.cleanup()
    }
  })
}

test('crash after generation reservation retains unknown cost and retry delay across resume', async () => {
  const f = fixture()
  try {
    const opts = f.runner()
    await assert.rejects(
      runGeminiDiagnostic({
        ...opts,
        onReserved: kind => {
          if (kind === 'generation') throw new Error('TEST-ONLY-crash')
        },
      }),
      /TEST-ONLY-crash/
    )
    assert.equal(f.calls.length, 2)
    assert.equal(f.report(opts.execution).observed.unknown_usage, 1)
    let waited = 0
    opts.wait = async ms => {
      waited += ms
      f.advance(ms)
    }
    const report = await runGeminiDiagnostic(opts)
    assert.equal(waited, 1000)
    assert.equal(report.reserved.requests, 25)
    assert.equal(report.controls.requests, 25)
    assert.equal(report.observed.unknown_usage, 1)
  } finally {
    f.cleanup()
  }
})

test('unknown control reservation cannot replay after crash', async () => {
  const f = fixture()
  try {
    const opts = f.runner()
    await assert.rejects(
      runGeminiDiagnostic({
        ...opts,
        onReserved: () => {
          throw new Error('TEST-ONLY-crash')
        },
      }),
      /TEST-ONLY-crash/
    )
    await assert.rejects(runGeminiDiagnostic(opts), /control_outcome_unknown/)
    assert.equal(f.calls.length, 0)
    assert.equal(f.report(opts.execution).controls.unknown_outcomes, 1)
  } finally {
    f.cleanup()
  }
})

test('revocation after reservation stops dispatch and preserves the reservation', async () => {
  const f = fixture()
  try {
    const opts = f.runner()
    await assert.rejects(
      runGeminiDiagnostic({
        ...opts,
        onReserved: kind => {
          if (kind === 'generation') {
            f.raw.approved = false
            f.save()
          }
        },
      }),
      /execution_revoked_or_changed/
    )
    assert.equal(f.calls.length, 2)
    assert.equal(f.report(opts.execution).reserved.requests, 1)
  } finally {
    f.cleanup()
  }
})

test('approval expiry during HTTP retains verified receipt before stopping', async () => {
  const f = fixture()
  try {
    const opts = f.runner(f.load(), async (url, init) => {
      const response = await f.success(url, init)
      if (url.endsWith(generationSuffix)) f.advance(120001)
      return response
    })
    await assert.rejects(runGeminiDiagnostic(opts), /execution_expired/)
    const db = openRun(f.options.runDir, bundle, new Date(), opts.execution)
    try {
      assert.equal(buildReport(db, bundle).observed.verified_captures, 1)
    } finally {
      db.close()
    }
    assert.equal(f.calls.length, 3)
  } finally {
    f.cleanup()
  }
})

test('overlapping runner cannot dispatch under another lease', async () => {
  const f = fixture()
  try {
    const opts = f.runner()
    let checked = false
    const report = await runGeminiDiagnostic({
      ...opts,
      http: async (url, init) => {
        if (!checked) {
          checked = true
          await assert.rejects(runGeminiDiagnostic(opts), /run_already_active/)
        }
        return f.success(url, init)
      },
    })
    assert.equal(report.reserved.requests, 24)
    assert.equal(f.calls.length, 49)
  } finally {
    f.cleanup()
  }
})

test('injected timeout becomes unknown usage and bounded retry', async () => {
  const f = fixture()
  try {
    let first = true
    const report = await runGeminiDiagnostic({
      ...f.runner(f.load(), async (url, init) => {
        if (url.endsWith(generationSuffix) && first) {
          first = false
          return new Promise<Response>(() => {})
        }
        return f.success(url, init)
      }),
      timeoutMs: 5,
    })
    assert.equal(report.reserved.requests, 25)
    assert.equal(report.observed.timeout, 1)
    assert.equal(report.observed.unknown_usage, 1)
  } finally {
    f.cleanup()
  }
})

test('incomplete backoff cannot dispatch a second generation', async () => {
  const f = fixture()
  try {
    const opts = f.runner(f.load(), async (url, init) =>
      url.endsWith(generationSuffix) ? json({}, 503) : f.success(url, init)
    )
    opts.wait = async () => {}
    await assert.rejects(runGeminiDiagnostic(opts), /retry_wait_incomplete/)
    assert.equal(f.report(opts.execution).reserved.requests, 1)
  } finally {
    f.cleanup()
  }
})

test('prepared execution is immutable, exact, private and cannot use default HTTP in test mode', async () => {
  const f = fixture()
  try {
    const execution = f.load()
    assert.equal(Object.isFrozen(execution), true)
    assert.throws(() => bindExecutionHttp(execution), /test_http_required/)
    await assert.rejects(
      runGeminiDiagnostic({
        bundle,
        execution: { ...execution },
        http: f.success,
      }),
      /unprepared_execution/
    )
    assert.throws(
      () => openRun(join(f.root, 'other'), bundle, new Date(), execution),
      /unprepared_execution/
    )
    const opts = f.runner(execution)
    writeFileSync(f.options.credentialPath, `${key}-changed`)
    await assert.rejects(
      runGeminiDiagnostic(opts),
      /execution_revoked_or_changed/
    )
    assert.equal(f.calls.length, 0)
  } finally {
    f.cleanup()
  }
})

const invalidRegistry = [
  [
    'implementation',
    (f: ReturnType<typeof fixture>) => {
      f.raw.implementation_sha256 = '0'.repeat(64)
    },
  ],
  [
    'approval',
    (f: ReturnType<typeof fixture>) => {
      f.raw.approved = false
    },
  ],
  [
    'draft',
    (f: ReturnType<typeof fixture>) => {
      f.raw.draft_sha256 = '0'.repeat(64)
    },
  ],
  [
    'run',
    (f: ReturnType<typeof fixture>) => {
      f.raw.run_dir = join(f.root, 'other')
    },
  ],
  [
    'account',
    (f: ReturnType<typeof fixture>) => {
      f.raw.account.personal = false
    },
  ],
  [
    'source',
    (f: ReturnType<typeof fixture>) => {
      f.raw.sources[0].input_sha256 = '0'.repeat(64)
    },
  ],
  [
    'combined_cost',
    (f: ReturnType<typeof fixture>) => {
      f.raw.pricing.count_request_max_microusd = 100000
    },
  ],
  [
    'tokens',
    (f: ReturnType<typeof fixture>) => {
      f.raw.pricing.total_reserved_tokens = 292608
    },
  ],
  [
    'key',
    (f: ReturnType<typeof fixture>) => {
      f.raw.credential_sha256 = '0'.repeat(64)
    },
  ],
  [
    'provider_test',
    (f: ReturnType<typeof fixture>) => {
      f.raw.approval_kind = 'human-approved'
    },
  ],
  [
    'day',
    (f: ReturnType<typeof fixture>) => {
      f.raw.utc_day = '2000-01-01'
    },
  ],
] as const
for (const [name, mutate] of invalidRegistry)
  test(`registry rejects ${name} before HTTP`, () => {
    const f = fixture()
    try {
      mutate(f)
      f.save()
      assert.throws(f.load)
      assert.equal(f.calls.length, 0)
    } finally {
      f.cleanup()
    }
  })

test('registry rejects public files and symlinks', () => {
  const f = fixture()
  try {
    chmodSync(f.options.authorizationPath, 0o644)
    assert.throws(f.load, /private_file_required/)
    chmodSync(f.options.authorizationPath, 0o600)
    const link = join(f.root, 'link')
    symlinkSync(f.options.authorizationPath, link)
    assert.throws(
      () => loadDiagnosticExecution({ ...f.options, authorizationPath: link }),
      /private_file_required/
    )
  } finally {
    f.cleanup()
  }
})

for (const mode of ['--check', '--execute'])
  test(`live CLI ${mode} refuses test-only or unapproved registries without creating a run`, () => {
    const f = fixture()
    try {
      for (const approved of [true, false]) {
        f.raw.approved = approved
        f.save()
        const result = spawnSync(
          process.execPath,
          [
            'scripts/cefr-calibration/diagnostic-live.ts',
            mode,
            ...Object.values(paths),
            f.options.draftPath,
            f.options.authorizationPath,
            approved ? f.options.credentialPath : join(f.root, 'missing-key'),
            f.options.runDir,
          ],
          { encoding: 'utf8' }
        )
        assert.equal(result.status, 1)
        assert.equal(result.stdout, '')
        assert.match(result.stderr, /Diagnostic live entrypoint stopped/)
        assert.equal(result.stderr.includes(f.root), false)
        assert.equal(result.stderr.includes(key), false)
        assert.equal(existsSync(f.options.runDir), false)
      }
    } finally {
      f.cleanup()
    }
  })

test('control failure preserves unknown reservation and cannot generate or replay', async () => {
  const f = fixture()
  try {
    const opts = f.runner(f.load(), async (url, init) => {
      if (url.endsWith(':countTokens')) {
        f.calls.push({ url, init })
        return json({}, 503)
      }
      return f.success(url, init)
    })
    await assert.rejects(runGeminiDiagnostic(opts), /Gemini HTTP failure/)
    await assert.rejects(runGeminiDiagnostic(opts), /control_outcome_unknown/)
    assert.equal(f.calls.length, 2)
    const report = f.report(opts.execution)
    assert.equal(report.controls.requests, 2)
    assert.equal(report.controls.unknown_outcomes, 1)
    assert.equal(report.reserved.requests, 0)
  } finally {
    f.cleanup()
  }
})

test('lease loss after a reservation is checked before HTTP', async () => {
  const f = fixture()
  try {
    const opts = f.runner()
    await assert.rejects(
      runGeminiDiagnostic({
        ...opts,
        onReserved: () => {
          const db = openRun(
            f.options.runDir,
            bundle,
            new Date(),
            opts.execution
          )
          try {
            db.prepare(
              "UPDATE meta SET value='' WHERE key='active_owner'"
            ).run()
          } finally {
            db.close()
          }
        },
      }),
      /run_lease_lost/
    )
    assert.equal(f.calls.length, 0)
    assert.equal(f.report(opts.execution).controls.requests, 1)
  } finally {
    f.cleanup()
  }
})

test('HTTP 408 retries once with separate accounting', async () => {
  const f = fixture()
  try {
    let first = true
    const report = await runGeminiDiagnostic(
      f.runner(f.load(), async (url, init) => {
        if (url.endsWith(generationSuffix) && first) {
          first = false
          return json({}, 408)
        }
        return f.success(url, init)
      })
    )
    assert.equal(report.reserved.requests, 25)
    assert.equal(report.observed.retry, 1)
  } finally {
    f.cleanup()
  }
})
