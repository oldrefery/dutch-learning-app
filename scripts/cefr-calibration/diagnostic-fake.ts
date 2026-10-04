import {
  loadDiagnosticBundle,
  runDiagnostic,
  writeNewDiagnosticReport,
  type DiagnosticRequest,
  type FakeDiagnosticTransport,
} from './diagnostic.ts'

// Deterministic mechanics sample. Its answers carry no independent CEFR evidence.
const fake: FakeDiagnosticTransport = {
  kind: 'fake',
  countTokens: async () => 150,
  generate: async (request: DiagnosticRequest) => {
    const abstain =
      request.job_id.includes('pilot-23:') ||
      request.job_id.includes('pilot-24:')
    return {
      kind: 'response',
      body: JSON.stringify({
        job_id: request.job_id,
        input_sha256: request.input_sha256,
        profile_sha256: request.profile_sha256,
        ambiguous: abstain,
        candidate: {
          level: abstain ? null : 'A1',
          confidence: abstain ? null : 0.5,
        },
      }),
      response_id: `fake-${request.job_id}`,
      model_version: 'fake-diagnostic-v1',
      finish_reason: 'STOP',
      usage: { input_tokens: 150, output_tokens: 20, reasoning_tokens: 0 },
    }
  },
}

const [worklist, reference, profile, prompt, proposal, runDir, ...extra] =
  process.argv.slice(2)
if (!runDir || extra.length) {
  console.error(
    'Usage: diagnostic-fake.ts WORKLIST REFERENCE PROFILE PROMPT PROPOSAL NEW_RUN_DIR'
  )
  process.exit(2)
}
try {
  const bundle = loadDiagnosticBundle({
    worklist,
    reference,
    profile,
    prompt,
    proposal,
  })
  const report = await runDiagnostic({ runDir, bundle, transport: fake })
  writeNewDiagnosticReport(runDir, report)
  console.log(
    JSON.stringify({
      run_id: report.run_id,
      items: report.total.items,
      reserved_attempts: report.reserved.requests,
      qualified: false,
      interpretation: report.interpretation,
    })
  )
} catch {
  console.error(
    'Diagnostic fake run failed: invalid input, run state, or output path.'
  )
  process.exitCode = 1
}
