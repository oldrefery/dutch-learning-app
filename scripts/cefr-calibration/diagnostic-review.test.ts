import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import {
  loadDiagnosticBundle,
  runDiagnostic,
  type DiagnosticPaths,
  type DiagnosticRequest,
  type DiagnosticReply,
} from './diagnostic.ts'
import type { DiagnosticRunOptions } from './diagnostic-types.ts'
const { DatabaseSync } = createRequire(import.meta.url)(
  'node:sqlite'
) as typeof import('node:sqlite')
const prefix = 'docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-'
const paths: DiagnosticPaths = {
  worklist: prefix + 'review-worklist.json',
  reference: prefix + 'provisional-reference.json',
  profile: prefix + 'profile.proposed.json',
  prompt: prefix + 'prompt.txt',
  proposal: prefix + 'proposal-summary.json',
}
const dayOne = '2026-10-03T23:59:59Z',
  dayTwo = '2026-10-04T00:00:01Z'
const good = (
  request: DiagnosticRequest
): Extract<DiagnosticReply, { kind: 'response' }> => ({
  kind: 'response',
  body: JSON.stringify({
    job_id: request.job_id,
    input_sha256: request.input_sha256,
    profile_sha256: request.profile_sha256,
    ambiguous: false,
    candidate: { level: 'A1', confidence: 0.5 },
  }),
  response_id: request.job_id,
  model_version: 'v1',
  finish_reason: 'STOP',
  usage: { input_tokens: 100, output_tokens: 20, reasoning_tokens: 0 },
})
const withRun = async (
  work: (root: string, options: DiagnosticRunOptions) => Promise<void>
) => {
  const root = mkdtempSync(join(tmpdir(), 'd11-review-'))
  try {
    await work(root, {
      runDir: join(root, 'run'),
      bundle: loadDiagnosticBundle(paths),
      transport: {
        kind: 'fake',
        countTokens: async () => 100,
        generate: async request => good(request),
      },
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
const totals = (runDir: string) => {
  const db = new DatabaseSync(join(runDir, 'diagnostic.sqlite'))
  try {
    return {
      attempts: Number(
        db.prepare('SELECT COUNT(*) AS n FROM attempts').get()?.n
      ),
      captures: Number(
        db.prepare('SELECT COUNT(*) AS n FROM captures').get()?.n
      ),
    }
  } finally {
    db.close()
  }
}

test('review: caller mutation cannot replace validated bundle or transport during preflight', () =>
  withRun(async (_, options) => {
    const original = options.bundle
    let poisonCalls = 0
    options.transport.countTokens = async () => {
      options.bundle = { ...original, bindingSha256: '0'.repeat(64) }
      options.transport.generate = async request => {
        poisonCalls++
        return good(request)
      }
      return 100
    }
    const report = await runDiagnostic(options)
    assert.equal(report.binding_sha256, original.bindingSha256)
    assert.equal(poisonCalls, 0)
  }))
test('review: UTC rollover during preflight stops before reservation', () =>
  withRun(async (_, options) => {
    let now = dayOne,
      calls = 0
    options.now = () => new Date(now)
    options.transport.countTokens = async () => {
      now = dayTwo
      return 100
    }
    options.transport.generate = async request => {
      calls++
      return good(request)
    }
    await assert.rejects(() => runDiagnostic(options), /run_day_changed/)
    assert.equal(calls, 0)
    assert.deepEqual(totals(options.runDir), { attempts: 0, captures: 0 })
  }))
test('review: midnight after dispatch retains capture and stops further requests', () =>
  withRun(async (_, options) => {
    let now = dayOne,
      calls = 0,
      counts = 0
    options.now = () => new Date(now)
    options.transport.countTokens = async () => {
      counts++
      return 100
    }
    options.transport.generate = async request => {
      calls++
      now = dayTwo
      return good(request)
    }
    await assert.rejects(() => runDiagnostic(options), /run_day_changed/)
    assert.equal(calls, 1)
    assert.equal(counts, 1)
    assert.deepEqual(totals(options.runDir), { attempts: 1, captures: 1 })
  }))
test('review: malformed model JSON retains verified receipt and usage', () =>
  withRun(async (_, options) => {
    let calls = 0
    options.transport.generate = async request => {
      calls++
      return calls === 1 ? { ...good(request), body: '{' } : good(request)
    }
    const report = await runDiagnostic(options)
    assert.equal(report.total.invalid, 1)
    assert.equal(report.observed.verified_captures, 24)
    assert.equal(report.observed.unknown_usage, 0)
  }))
test('review: invalid answer still binds the first resolved model version', () =>
  withRun(async (_, options) => {
    let calls = 0
    options.transport.generate = async request => {
      calls++
      return calls === 1
        ? { ...good(request), body: '{' }
        : { ...good(request), model_version: 'v2' }
    }
    await assert.rejects(
      () => runDiagnostic(options),
      /mixed_resolved_model_versions/
    )
    assert.equal(calls, 2)
  }))
test('review: authorization rejection stops the whole batch after capture', () =>
  withRun(async (_, options) => {
    let calls = 0
    options.transport.generate = async () => {
      calls++
      return { kind: 'http_error', status: 403 }
    }
    await assert.rejects(() => runDiagnostic(options), /provider_rejected/)
    assert.equal(calls, 1)
    assert.deepEqual(totals(options.runDir), { attempts: 1, captures: 1 })
  }))
for (const scenario of ['split', 'slices'] as const) {
  test(`review: reject rebound worklist with incorrect ${scenario} coverage`, () =>
    withRun(async root => {
      const copy = { ...paths }
      for (const key of Object.keys(paths) as (keyof DiagnosticPaths)[]) {
        copy[key] = join(root, key)
        cpSync(paths[key], copy[key])
      }
      const worklist = JSON.parse(readFileSync(copy.worklist, 'utf8'))
      if (scenario === 'split') worklist.items[0].proposed_split = 'held_out'
      else for (const row of worklist.items) row.proposed_slices = ['ordinary']
      const raw = JSON.stringify(worklist)
      writeFileSync(copy.worklist, raw)
      const hash = createHash('sha256').update(raw).digest('hex')
      for (const [key, field] of [
        ['reference', 'worklist_sha256'],
        ['proposal', 'worklist_file_sha256'],
      ] as const) {
        const value = JSON.parse(readFileSync(copy[key], 'utf8'))
        value[field] = hash
        writeFileSync(copy[key], JSON.stringify(value))
      }
      assert.throws(
        () => loadDiagnosticBundle(copy),
        /reference_or_split_coverage/
      )
    }))
}

test('review: day change after reservation leaves conservative charge without dispatch', () =>
  withRun(async (_, options) => {
    let now = dayOne,
      calls = 0
    options.now = () => new Date(now)
    options.onReserved = () => {
      now = dayTwo
    }
    options.transport.generate = async request => {
      calls++
      return good(request)
    }
    await assert.rejects(() => runDiagnostic(options), /run_day_changed/)
    assert.equal(calls, 0)
    assert.deepEqual(totals(options.runDir), { attempts: 1, captures: 0 })
  }))
test('review: a recorded authorization failure prevents later resume calls', () =>
  withRun(async (_, options) => {
    let calls = 0
    options.transport.generate = async () => {
      calls++
      return { kind: 'http_error', status: 401 }
    }
    await assert.rejects(() => runDiagnostic(options), /provider_rejected/)
    await assert.rejects(() => runDiagnostic(options), /provider_rejected/)
    assert.equal(calls, 1)
    assert.deepEqual(totals(options.runDir), { attempts: 1, captures: 1 })
  }))
