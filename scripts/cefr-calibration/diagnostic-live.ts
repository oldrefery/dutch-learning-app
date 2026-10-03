import { loadDiagnosticBundle } from './diagnostic-bundle.ts'
import { loadDiagnosticExecution } from './diagnostic-execution.ts'
import { runGeminiDiagnostic } from './diagnostic-runner.ts'
import { writeNewDiagnosticReport } from './diagnostic-report.ts'

const [
  mode,
  worklist,
  reference,
  profile,
  prompt,
  proposal,
  draftPath,
  authorizationPath,
  credentialPath,
  runDir,
  ...extra
] = process.argv.slice(2)
if (!['--check', '--execute'].includes(mode) || !runDir || extra.length) {
  console.error(
    'Usage: diagnostic-live.ts --check|--execute WORKLIST REFERENCE PROFILE PROMPT PROPOSAL PRIVATE_DRAFT PRIVATE_AUTHORIZATION PRIVATE_KEY EXACT_RUN_DIR'
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
  const execution = loadDiagnosticExecution({
    bundle,
    draftPath,
    authorizationPath,
    credentialPath,
    runDir,
  })
  if (execution.origin !== 'provider')
    throw new Error('Live CLI requires a human-approved registry')
  if (mode === '--check')
    console.log(
      JSON.stringify({
        ready: true,
        execution_sha256: execution.sha256,
        external_calls: 0,
      })
    )
  else {
    const report = await runGeminiDiagnostic({ bundle, execution })
    writeNewDiagnosticReport(runDir, report)
    console.log(
      JSON.stringify({
        run_id: report.run_id,
        reserved_requests: report.reserved_all.requests,
        qualified: false,
      })
    )
  }
} catch {
  // Never print private registry/key/account paths, provider bodies or raw errors.
  console.error(
    'Diagnostic live entrypoint stopped: approval, binding, run state or provider validation failed.'
  )
  process.exitCode = 1
}
