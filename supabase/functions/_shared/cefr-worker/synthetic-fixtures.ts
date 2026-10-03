import { qualifyMethod } from '../cefr-calibration/policy.ts'
import { buildCalibrationReport } from '../cefr-calibration/report.ts'
import {
  syntheticContent,
  syntheticInputs,
} from '../cefr-calibration/synthetic-fixtures.ts'
import { sha256 } from '../cefr-calibration/validation.ts'
import { canonicalizeCefrInput } from '../../../../packages/domain/src/shared-dictionary.ts'

// Fictional reviewed-shaped mechanics data only, never operational quality evidence.
export const syntheticWorker = async () => {
  const inputs = await syntheticInputs(true)
  const report = await buildCalibrationReport(inputs)
  const approval = {
    fixture_sha256: report.fixture_sha256,
    report_sha256: report.sha256,
    profile_sha256: report.profile_sha256,
    policy_sha256: report.policy_sha256!,
    review_ref: 'TEST-ONLY-review',
    provider_reuse_policy_ref: 'TEST-ONLY-reuse',
  }
  const { qualified } = await qualifyMethod(inputs, approval)
  if (!qualified) throw new Error('Synthetic mechanics fixture did not qualify')
  const content = syntheticContent('synthetic-worker')
  const job = {
    job_id: crypto.randomUUID(),
    entry_id: crypto.randomUUID(),
    revision_id: crypto.randomUUID(),
    input_sha256: await sha256(canonicalizeCefrInput(content)),
    qualification_sha256: qualified.qualification_sha256,
    profile_sha256: report.profile_sha256,
    profile: inputs.profile,
    content,
    lease_token: crypto.randomUUID(),
    lease_expires_at: new Date(Date.now() + 60000).toISOString(),
    attempt: 1,
  }
  return { inputs, report, approval, qualified, job }
}
