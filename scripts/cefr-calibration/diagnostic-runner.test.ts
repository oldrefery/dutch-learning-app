import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  bindExecutionHttp,
  loadDiagnosticExecution,
} from './diagnostic-execution.ts'
import { runGeminiDiagnostic } from './diagnostic-runner.ts'
import { buildReport } from './diagnostic-report.ts'
import { openRun } from './diagnostic-store.ts'
import { type TestHttp } from './diagnostic-gemini.ts'
import {
  bundle,
  paths,
  key,
  generationSuffix,
  json,
  generation,
  fixture,
} from './diagnostic-runner-fixtures.ts'

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
