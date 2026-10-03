import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  cpSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import {
  loadDiagnosticBundle,
  runDiagnostic,
  writeNewDiagnosticReport,
  type DiagnosticPaths,
  type DiagnosticRequest,
  type DiagnosticReply,
  type FakeDiagnosticTransport,
} from './diagnostic.ts'

const { DatabaseSync } = createRequire(import.meta.url)(
  'node:sqlite'
) as typeof import('node:sqlite')
const DB_FILE = 'diagnostic.sqlite'
const ATTEMPT_COUNT = 'SELECT COUNT(*) AS total FROM attempts'
const evidence = 'docs/tasks/shared-dictionary-cefr/evidence/'
const paths: DiagnosticPaths = {
  worklist: `${evidence}D11-pilot-review-worklist.json`,
  reference: `${evidence}D11-pilot-provisional-reference.json`,
  profile: `${evidence}D11-pilot-profile.proposed.json`,
  prompt: `${evidence}D11-pilot-prompt.txt`,
  proposal: `${evidence}D11-pilot-proposal-summary.json`,
}
const sha = (value: string): string =>
  createHash('sha256').update(value).digest('hex')
const reply = (
  request: DiagnosticRequest,
  level: string | null = 'A1',
  usage = true
): DiagnosticReply => ({
  kind: 'response',
  body: JSON.stringify({
    job_id: request.job_id,
    input_sha256: request.input_sha256,
    profile_sha256: request.profile_sha256,
    ambiguous: level === null,
    candidate: { level, confidence: level === null ? null : 0.7 },
  }),
  response_id: `fake-${request.job_id}`,
  model_version: 'fake-model-v1',
  finish_reason: 'STOP',
  ...(usage
    ? { usage: { input_tokens: 100, output_tokens: 20, reasoning_tokens: 10 } }
    : {}),
})
const transport = (
  answer?: (
    request: DiagnosticRequest
  ) => DiagnosticReply | Promise<DiagnosticReply>
) => {
  let calls = 0,
    counts = 0
  const fake: FakeDiagnosticTransport = {
    kind: 'fake',
    countTokens: async request => {
      counts++
      assert.equal(Object.hasOwn(request, 'reference'), false)
      return 150
    },
    generate: async request => {
      calls++
      return answer
        ? answer(request)
        : reply(
            request,
            request.job_id.includes('pilot-23') ||
              request.job_id.includes('pilot-24')
              ? null
              : 'A1'
          )
    },
  }
  return { fake, counts: () => counts, calls: () => calls }
}
const temp = () => mkdtempSync(join(tmpdir(), 'd11-diagnostic-test-'))

test('bounded fake collection freezes bindings and writes a separate unqualified report', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      fake = transport()
    const runDir = join(root, 'run')
    const report = await runDiagnostic({ runDir, bundle, transport: fake.fake })
    assert.equal(fake.calls(), 24)
    assert.equal(report.qualified, false)
    assert.equal(report.calibration_eligible, false)
    assert.equal(report.interpretation, 'unqualified_model_reference_agreement')
    assert.equal(report.reserved.requests, 24)
    assert.equal(report.reserved.microusd, 24 * 39864)
    assert.equal(report.total.reference_unknown, 5)
    assert.equal(report.total.ambiguity_probe_abstention.numerator, 2)
    assert.equal(report.total.agreement_exact.denominator, 19)
    assert.equal(report.observed.verified_captures, 24)
    assert.equal(report.splits.calibration.items, 12)
    assert.equal(report.splits.held_out.items, 12)
    const written = writeNewDiagnosticReport(runDir, report)
    assert.equal(
      JSON.parse(readFileSync(written, 'utf8')).sha256,
      report.sha256
    )
    assert.throws(() => writeNewDiagnosticReport(runDir, report), {
      code: 'EEXIST',
    })
    const again = await runDiagnostic({ runDir, bundle, transport: fake.fake })
    assert.equal(fake.calls(), 24)
    assert.equal(again.sha256, report.sha256)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('retry and unknown outcome retain reservations across a restarted run', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    let reserved = false
    const first = transport()
    await assert.rejects(
      () =>
        runDiagnostic({
          runDir,
          bundle,
          transport: first.fake,
          onReserved: id => {
            if (id === 'pilot-01' && !reserved) {
              reserved = true
              throw new Error('injected crash')
            }
          },
        }),
      /injected crash/
    )
    assert.equal(first.calls(), 0)
    const second = transport(request =>
      request.job_id.includes('pilot-02:1')
        ? { kind: 'http_error', status: 429 }
        : reply(request)
    )
    const report = await runDiagnostic({
      runDir,
      bundle,
      transport: second.fake,
    })
    assert.equal(report.reserved.requests, 26)
    assert.equal(report.reserved.microusd, 26 * 39864)
    assert.equal(report.observed.unknown_usage, 2)
    assert.equal(report.observed.retry, 1)
    assert.equal(report.items[0].attempts, 2)
    assert.equal(report.items[1].attempts, 2)
    assert.equal(second.calls(), 25)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('oversized usage fails closed after reservation and does not create capture', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    const bad = transport(
      request =>
        ({
          ...reply(request),
          usage: { input_tokens: 2001, output_tokens: 0, reasoning_tokens: 0 },
        }) as DiagnosticReply
    )
    await assert.rejects(
      () => runDiagnostic({ runDir, bundle, transport: bad.fake }),
      /usage_exceeds_reservation/
    )
    const good = transport()
    const report = await runDiagnostic({ runDir, bundle, transport: good.fake })
    assert.equal(report.items[0].attempts, 2)
    assert.equal(report.observed.unknown_usage, 1)
    assert.equal(report.reserved.requests, 25)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('active run prevents overlapping collectors from reserving a second attempt', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    let entered: () => void = () => {}
    const started = new Promise<void>(resolve => {
      entered = resolve
    })
    const slow = transport(async request => {
      entered()
      await gate
      return reply(request)
    })
    const ongoing = runDiagnostic({ runDir, bundle, transport: slow.fake })
    await started
    await assert.rejects(
      () => runDiagnostic({ runDir, bundle, transport: transport().fake }),
      /run_already_active/
    )
    release()
    const report = await ongoing
    assert.equal(report.reserved.requests, 24)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('tampered input/reference and changed-day resume are rejected before generation', async () => {
  const root = temp()
  try {
    const copied: DiagnosticPaths = {
      worklist: join(root, 'worklist.json'),
      reference: join(root, 'reference.json'),
      profile: join(root, 'profile.json'),
      prompt: join(root, 'prompt.txt'),
      proposal: join(root, 'proposal.json'),
    }
    for (const key of Object.keys(paths) as (keyof DiagnosticPaths)[])
      cpSync(paths[key], copied[key])
    const bundle = loadDiagnosticBundle(copied),
      runDir = join(root, 'run')
    const fake = transport()
    await runDiagnostic({
      runDir,
      bundle,
      transport: fake.fake,
      now: () => new Date('2026-10-03T09:00:00Z'),
    })
    await assert.rejects(
      () =>
        runDiagnostic({
          runDir,
          bundle,
          transport: fake.fake,
          now: () => new Date('2026-10-04T09:00:00Z'),
        }),
      /resume_binding_or_day/
    )
    const w = JSON.parse(readFileSync(copied.worklist, 'utf8'))
    w.items[0].content.dutch_original = 'tampered'
    writeFileSync(copied.worklist, `${JSON.stringify(w)}\n`)
    assert.throws(() => loadDiagnosticBundle(copied), /artifact_binding/)
    cpSync(paths.worklist, copied.worklist)
    const r = JSON.parse(readFileSync(copied.reference, 'utf8'))
    r.items[0].provisional_level_band = ['C2']
    writeFileSync(copied.reference, `${JSON.stringify(r)}\n`)
    const modified = loadDiagnosticBundle(copied)
    await assert.rejects(
      () =>
        runDiagnostic({
          runDir,
          bundle: modified,
          transport: fake.fake,
          now: () => new Date('2026-10-03T09:00:00Z'),
        }),
      /resume_binding_or_day/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('input token preflight stops before any generation reservation', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    const fake = transport()
    fake.fake.countTokens = async () => 2001
    await assert.rejects(
      () => runDiagnostic({ runDir, bundle, transport: fake.fake }),
      /input_token_bound/
    )
    const db = new DatabaseSync(join(runDir, DB_FILE))
    try {
      assert.equal(
        (
          db.prepare(ATTEMPT_COUNT).get() as {
            total: number
          }
        ).total,
        0
      )
    } finally {
      db.close()
    }
    assert.equal(fake.calls(), 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// The digest check is intentionally independent of the bundle loader.
test('frozen prompt digest matches the committed proposal', () => {
  const summary = JSON.parse(readFileSync(paths.proposal, 'utf8'))
  assert.equal(sha(readFileSync(paths.prompt, 'utf8')), summary.prompt_sha256)
})

test('timeout consumes its reservation and the next attempt succeeds', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    const fake = transport(request =>
      request.job_id.includes('pilot-01:1')
        ? new Promise<DiagnosticReply>(() => {})
        : reply(request)
    )
    const report = await runDiagnostic({
      runDir,
      bundle,
      transport: fake.fake,
      timeoutMs: 10,
    })
    assert.equal(report.reserved.requests, 25)
    assert.equal(report.observed.timeout, 1)
    assert.equal(report.observed.unknown_usage, 1)
    assert.equal(report.items[0].attempts, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('duplicate provider response identity stops capture with reservation retained', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    const fake = transport(
      request =>
        ({ ...reply(request), response_id: 'same-response' }) as DiagnosticReply
    )
    await assert.rejects(
      () => runDiagnostic({ runDir, bundle, transport: fake.fake }),
      /UNIQUE constraint failed/
    )
    const db = new DatabaseSync(join(runDir, DB_FILE))
    try {
      assert.equal(
        (
          db.prepare(ATTEMPT_COUNT).get() as {
            total: number
          }
        ).total,
        2
      )
      assert.equal(
        (
          db.prepare('SELECT COUNT(*) AS total FROM captures').get() as {
            total: number
          }
        ).total,
        1
      )
    } finally {
      db.close()
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('mixed resolved model versions stop without publishing a mixed report', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    const fake = transport(
      request =>
        ({
          ...reply(request),
          model_version: request.job_id.includes('pilot-01:') ? 'v1' : 'v2',
        }) as DiagnosticReply
    )
    await assert.rejects(
      () => runDiagnostic({ runDir, bundle, transport: fake.fake }),
      /mixed_resolved_model_versions/
    )
    const db = new DatabaseSync(join(runDir, DB_FILE))
    try {
      assert.equal(
        (
          db.prepare(ATTEMPT_COUNT).get() as {
            total: number
          }
        ).total,
        2
      )
    } finally {
      db.close()
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('prepared bundle cannot be mutated or replaced by a caller', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths)
    assert.equal(Object.isFrozen(bundle.meanings[0]), true)
    assert.equal(Object.isFrozen(bundle.profile.generation_config), true)
    assert.throws(() => {
      ;(bundle.meanings[0] as { input: string }).input = 'changed'
    }, TypeError)
    const copy = structuredClone(bundle)
    await assert.rejects(
      () =>
        runDiagnostic({
          runDir: join(root, 'run'),
          bundle: copy,
          transport: transport().fake,
        }),
      /unvalidated_bundle/
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('fake token preflight is time bounded before reservation', async () => {
  const root = temp()
  try {
    const bundle = loadDiagnosticBundle(paths),
      runDir = join(root, 'run')
    const fake = transport()
    fake.fake.countTokens = async () => new Promise<number>(() => {})
    await assert.rejects(
      () =>
        runDiagnostic({ runDir, bundle, transport: fake.fake, timeoutMs: 10 }),
      /token_preflight_timeout/
    )
    const db = new DatabaseSync(join(runDir, DB_FILE))
    try {
      assert.equal(
        (db.prepare(ATTEMPT_COUNT).get() as { total: number }).total,
        0
      )
    } finally {
      db.close()
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
