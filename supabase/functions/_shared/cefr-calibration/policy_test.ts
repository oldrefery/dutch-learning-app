import { assertEquals, assertNotEquals } from '@std/assert'
import {
  decideCandidate,
  qualifyMethod,
  type QualificationApproval,
} from './policy.ts'
import { buildCalibrationReport } from './report.ts'
import { syntheticInputs } from './synthetic-fixtures.ts'

const fictionalApproval = async (
  input: Awaited<ReturnType<typeof syntheticInputs>>
): Promise<QualificationApproval> => {
  const report = await buildCalibrationReport(input)
  return {
    fixture_sha256: report.fixture_sha256,
    profile_sha256: report.profile_sha256,
    report_sha256: report.sha256,
    policy_sha256: report.policy_sha256!,
    review_ref: 'TEST-ONLY-review',
    provider_reuse_policy_ref: 'TEST-ONLY-reuse',
  }
}

Deno.test(
  'synthetic evidence cannot qualify even with perfect metrics and matching approval',
  async () => {
    const input = await syntheticInputs()
    const result = await qualifyMethod(input, await fictionalApproval(input))
    assertEquals(result.qualified, null)
    assertEquals(result.blockers, ['fixture_not_reviewed', 'fake_responses'])
  }
)

Deno.test(
  'reviewed-shaped evidence still requires a separate trusted server approval',
  async () => {
    const result = await qualifyMethod(await syntheticInputs(true))
    assertEquals(result.qualified, null)
    assertEquals(result.blockers, ['missing_server_approval'])
  }
)

Deno.test(
  'approval binds exact fixture, report, method and policy digests',
  async () => {
    const input = await syntheticInputs(true)
    for (const field of [
      'fixture_sha256',
      'report_sha256',
      'profile_sha256',
      'policy_sha256',
    ] as const) {
      const approval = await fictionalApproval(input)
      approval[field] = '0'.repeat(64)
      const result = await qualifyMethod(input, approval)
      assertEquals(result.qualified, null)
      assertEquals(result.blockers.includes('approval_binding_mismatch'), true)
    }
  }
)

Deno.test(
  'qualified mechanics token permits estimates only and cannot survive serialization',
  async () => {
    const input = await syntheticInputs(true)
    const result = await qualifyMethod(input, await fictionalApproval(input))
    assertNotEquals(result.qualified, null)
    const context = { profile: input.profile, ambiguous: false }
    const decision = await decideCandidate(
      { level: 'A2', confidence: 0.8, status: 'reviewed', source: 'editorial' },
      context,
      result.qualified
    )
    assertEquals(decision.status, 'estimated')
    if (decision.status === 'estimated') assertEquals(decision.source, 'model')
    const copy = JSON.parse(JSON.stringify(result.qualified))
    assertEquals(
      (await decideCandidate({ level: 'A2', confidence: 1 }, context, copy))
        .status,
      'needs_review'
    )
  }
)

Deno.test(
  'uncalibrated self-confidence cannot produce a known operational level',
  async () => {
    const input = await syntheticInputs()
    assertEquals(
      await decideCandidate(
        { level: 'A1', confidence: 1 },
        { profile: input.profile, ambiguous: false }
      ),
      {
        status: 'needs_review',
        level: null,
        reason: 'unqualified_method',
      }
    )
  }
)

Deno.test(
  'missing, invalid, abstained, ambiguous and below-threshold candidates fail closed',
  async () => {
    const input = await syntheticInputs(true)
    const { qualified } = await qualifyMethod(
      input,
      await fictionalApproval(input)
    )
    const context = { profile: input.profile, ambiguous: false }
    for (const raw of [
      undefined,
      null,
      {},
      { level: 'B0', confidence: 1 },
      { level: 'A1', confidence: NaN },
      { level: 'A1', confidence: -1 },
      { level: null, confidence: null },
      { level: null, confidence: 1 },
    ]) {
      assertEquals(
        (await decideCandidate(raw, context, qualified)).status,
        'unknown'
      )
    }
    assertEquals(
      await decideCandidate(
        { level: 'A2', confidence: 0.79 },
        context,
        qualified
      ),
      {
        status: 'needs_review',
        level: null,
        reason: 'below_qualified_threshold',
      }
    )
    assertEquals(
      await decideCandidate(
        { level: 'A2', confidence: 1 },
        { ...context, ambiguous: true },
        qualified
      ),
      { status: 'needs_review', level: null, reason: 'ambiguous_input' }
    )
  }
)

Deno.test(
  'every material method setting invalidates qualification',
  async () => {
    const input = await syntheticInputs(true)
    const { qualified } = await qualifyMethod(
      input,
      await fictionalApproval(input)
    )
    for (const change of [
      { namespace: 'word-analysis-cefr-v1' },
      { input_schema_version: 2 },
      { method_revision: 'changed' },
      { prompt_revision: 'changed' },
      { provider: 'changed' },
      { requested_model: 'changed' },
      { unrecognized_method_setting: 'changed' },
      { resolved_model_version: 'new-resolved-version' },
      { generation_config: { temperature: 0.1, max_output_tokens: 64 } },
    ]) {
      const decision = await decideCandidate(
        { level: 'A2', confidence: 1 },
        { profile: { ...input.profile, ...change }, ambiguous: false },
        qualified
      )
      assertEquals(decision.status, 'needs_review')
    }
  }
)

Deno.test(
  'empty or insufficient held-out coverage cannot qualify',
  async () => {
    const input = await syntheticInputs(true)
    input.responses.responses = input.responses.responses.filter(row =>
      row.id.startsWith('calibration')
    )
    const result = await qualifyMethod(input, await fictionalApproval(input))
    assertEquals(result.qualified, null)
    assertEquals(result.blockers.includes('held_out_acceptance_failed'), true)
  }
)

Deno.test(
  'severe errors and forced answers on abstention slices block qualification',
  async () => {
    const input = await syntheticInputs(true)
    input.responses.responses[11].candidate.level = 'C2'
    input.responses.responses[20].candidate = { level: 'A2', confidence: 1 }
    const result = await qualifyMethod(input, await fictionalApproval(input))
    assertEquals(result.qualified, null)
    assertEquals(result.blockers.includes('held_out_acceptance_failed'), true)
    assertEquals(
      result.blockers.includes('held_out_ambiguous_acceptance_failed'),
      true
    )
  }
)

Deno.test(
  'input mutations during asynchronous reporting cannot rewrite captured evidence',
  async () => {
    const input = await syntheticInputs()
    const expected = await buildCalibrationReport(input)
    const pending = buildCalibrationReport(input)
    input.responses.responses[0].candidate.level = 'C2'
    input.profile.generation_config.temperature = 1
    assertEquals(await pending, expected)
  }
)

Deno.test(
  'small metric denominators cannot qualify despite perfect percentages',
  async () => {
    for (const field of [
      'minimum_scored_items',
      'minimum_accepted_items',
    ] as const) {
      const input = await syntheticInputs(true)
      input.policy[field] = 20
      const result = await qualifyMethod(input, await fictionalApproval(input))
      assertEquals(result.qualified, null)
      assertEquals(result.blockers.includes('held_out_acceptance_failed'), true)
    }
  }
)

Deno.test(
  'approval mutation during async validation cannot grant qualification',
  async () => {
    const input = await syntheticInputs(true)
    const valid = await fictionalApproval(input)
    const approval = { ...valid, report_sha256: '0'.repeat(64) }
    const pending = qualifyMethod(input, approval)
    approval.report_sha256 = valid.report_sha256
    assertEquals((await pending).qualified, null)
  }
)
