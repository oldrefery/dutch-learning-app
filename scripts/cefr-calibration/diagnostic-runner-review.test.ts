import assert from 'node:assert/strict'
import {
  mkdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  bindExecutionJournal,
  loadDiagnosticExecution,
} from './diagnostic-execution.ts'
import { runGeminiDiagnostic } from './diagnostic-runner.ts'
import {
  generation,
  generationSuffix,
  json,
  fixture,
} from './diagnostic-runner-fixtures.ts'

const DB_FILE = 'diagnostic.sqlite'

for (const lost of ['database', 'directory'] as const) {
  test(`review: losing the ${lost} cannot reuse a consumed execution`, async () => {
    const f = fixture()
    try {
      await runGeminiDiagnostic(f.runner())
      assert.equal(f.calls.length, 49)
      if (lost === 'database') rmSync(join(f.options.runDir, DB_FILE))
      else rmSync(f.options.runDir, { recursive: true })
      // Fresh scope simulates process restart with the same approved registry.
      await assert.rejects(runGeminiDiagnostic(f.runner(f.load())))
      assert.equal(f.calls.length, 49)
    } finally {
      f.cleanup()
    }
  })
}

test('review: replacing a live run directory fences further dispatch', async () => {
  const f = fixture()
  try {
    const opts = f.runner()
    await assert.rejects(
      runGeminiDiagnostic({
        ...opts,
        onReserved: kind => {
          if (kind !== 'generation') return
          renameSync(f.options.runDir, join(f.root, 'retained-run'))
          mkdirSync(f.options.runDir, { mode: 0o700 })
        },
      })
    )
    assert.equal(f.calls.length, 2)
  } finally {
    f.cleanup()
  }
})

test('review: duplicate receipt identity durably rejects resumed batch', async () => {
  const f = fixture()
  try {
    const opts = f.runner(f.load(), async (url, init) => {
      if (!url.endsWith(generationSuffix)) return f.success(url, init)
      f.calls.push({ url, init })
      return json(generation(init, 1))
    })
    await assert.rejects(runGeminiDiagnostic(opts))
    assert.equal(f.calls.length, 5)
    assert.equal(
      f.report(opts.execution).rejection_reason,
      'duplicate_response_identity'
    )
    assert.equal(f.report(opts.execution).observed.unknown_usage, 1)
    const calls = f.calls.length
    await assert.rejects(runGeminiDiagnostic(f.runner(f.load())))
    assert.equal(f.calls.length, calls)
  } finally {
    f.cleanup()
  }
})

test('review: full retry allowance includes controls in the shared ceiling', async () => {
  const f = fixture()
  try {
    const retried = new Set<string>()
    const report = await runGeminiDiagnostic(
      f.runner(f.load(), async (url, init) => {
        if (url.endsWith(generationSuffix) && !retried.has(String(init.body))) {
          retried.add(String(init.body))
          f.calls.push({ url, init })
          return json({}, 503)
        }
        return f.success(url, init)
      })
    )
    assert.equal(f.calls.length, 73)
    assert.deepEqual(report.reserved_all, {
      requests: 73,
      tokens: 340608,
      microusd: 1937972,
    })
    assert.equal(report.observed.unknown_usage, 24)
    assert.equal(report.qualified, false)
    assert.equal(report.rejection_reason, null)
  } finally {
    f.cleanup()
  }
})

test('review: emptying the same journal inode cannot reset its allowance', async () => {
  const f = fixture()
  try {
    await runGeminiDiagnostic(f.runner())
    truncateSync(join(f.options.runDir, DB_FILE), 0)
    await assert.rejects(
      runGeminiDiagnostic(f.runner(f.load())),
      /journal_initialization_incomplete/
    )
    assert.equal(f.calls.length, 49)
  } finally {
    f.cleanup()
  }
})

test('review: moving the registry cannot mint a new consumption record', async () => {
  const f = fixture()
  try {
    await runGeminiDiagnostic(f.runner())
    const moved = join(f.root, 'moved-approval.json')
    renameSync(f.options.authorizationPath, moved)
    rmSync(f.options.runDir, { recursive: true })
    const execution = loadDiagnosticExecution({
      ...f.options,
      authorizationPath: moved,
    })
    await assert.rejects(runGeminiDiagnostic(f.runner(execution)))
    assert.equal(f.calls.length, 49)
  } finally {
    f.cleanup()
  }
})

test('review: a consumption record inside the run directory is rejected through aliases', () => {
  const f = fixture()
  try {
    mkdirSync(f.options.runDir, { mode: 0o700 })
    const alias = join(f.root, 'run-alias')
    symlinkSync(f.options.runDir, alias)
    f.raw.journal_binding_path = join(alias, 'consumed.json')
    f.save()
    assert.throws(f.load, /journal_binding/)
  } finally {
    f.cleanup()
  }
})

test('review: incomplete first initialization cannot adopt an empty journal on restart', async () => {
  const f = fixture()
  try {
    mkdirSync(f.options.runDir, { mode: 0o700 })
    writeFileSync(join(f.options.runDir, DB_FILE), '', {
      mode: 0o600,
    })
    bindExecutionJournal(f.load())
    await assert.rejects(
      runGeminiDiagnostic(f.runner(f.load())),
      /journal_initialization_incomplete/
    )
    assert.equal(f.calls.length, 0)
  } finally {
    f.cleanup()
  }
})

test('review: missing consumption record cannot rebind an existing journal', async () => {
  const f = fixture()
  try {
    await runGeminiDiagnostic(f.runner())
    rmSync(f.raw.journal_binding_path)
    await assert.rejects(
      runGeminiDiagnostic(f.runner(f.load())),
      /resume_binding_or_day/
    )
    assert.equal(f.calls.length, 49)
  } finally {
    f.cleanup()
  }
})
