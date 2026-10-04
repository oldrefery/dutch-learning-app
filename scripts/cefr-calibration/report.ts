import { buildCalibrationReport } from '../../supabase/functions/_shared/cefr-calibration/report.ts'
import { qualificationBlockers } from '../../supabase/functions/_shared/cefr-calibration/policy.ts'

// Explicit files only. No environment loading, private-export discovery or HTTP.
const [
  fixturePath,
  profilePath,
  policyPath,
  responsesPath,
  outputPath,
  ...extra
] = Deno.args
if (!outputPath || extra.length) {
  console.error('Usage: report.ts FIXTURE PROFILE POLICY RESPONSES NEW_OUTPUT')
  Deno.exit(2)
}

try {
  const [fixture, profile, policy, responses] = await Promise.all(
    [fixturePath, profilePath, policyPath, responsesPath].map(async path =>
      JSON.parse(await Deno.readTextFile(path))
    )
  )
  const report = await buildCalibrationReport({
    fixture,
    profile,
    policy,
    responses,
  })
  const output = {
    report,
    qualification_blockers: [
      ...qualificationBlockers(report),
      'missing_server_approval',
    ],
  }
  await Deno.writeTextFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
    createNew: true,
  })
  console.log(
    JSON.stringify({
      items: report.total.items,
      missing: report.total.missing,
      interpretation: report.interpretation,
      qualified: false,
    })
  )
} catch {
  // Input contents and paths may be private; detailed exceptions stay out of logs.
  console.error(
    'Calibration report failed: invalid inputs, denied access, or output already exists.'
  )
  Deno.exit(1)
}
