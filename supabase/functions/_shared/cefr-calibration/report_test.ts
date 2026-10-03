import { assertEquals, assertNotEquals, assertRejects } from '@std/assert'
import { buildCalibrationReport } from './report.ts'
import { rebindSyntheticInputs, syntheticInputs } from './synthetic-fixtures.ts'

Deno.test(
  'report exposes synthetic interpretation, split metrics and denominators',
  async () => {
    const report = await buildCalibrationReport(await syntheticInputs())
    assertEquals(report.interpretation, 'synthetic_mechanics_only')
    assertEquals(report.total.coverage, {
      numerator: 18,
      denominator: 22,
      value: 18 / 22,
    })
    assertEquals(report.total.exact, {
      numerator: 18,
      denominator: 18,
      value: 1,
    })
    assertEquals(report.total.abstentions, 4)
    assertEquals(report.splits.held_out.items, 11)
    assertEquals(report.total.confusion.A2.A2, 18)
    assertEquals(report.profile.resolved_model_version, null)
  }
)

Deno.test(
  'missing responses remain visible and empty slices are unknown',
  async () => {
    const input = await syntheticInputs()
    input.fixture.items = input.fixture.items.slice(0, 1)
    input.responses.responses = []
    await rebindSyntheticInputs(input)
    const report = await buildCalibrationReport(input)
    assertEquals(report.total.missing, 1)
    assertEquals(report.total.evaluated, 0)
    assertEquals(report.total.exact.value, null)
    assertEquals(report.splits.held_out.coverage.value, null)
    assertEquals(report.splits.calibration.slices.idioms.exact.denominator, 0)
  }
)

Deno.test(
  'wrong, severe, malformed and absent outputs have honest denominators',
  async () => {
    const input = await syntheticInputs()
    input.responses.responses[0].candidate.level = 'C2'
    input.responses.responses[1].candidate.level = 'B1'
    input.responses.responses[2].candidate.level = 'A0'
    input.responses.responses.splice(3, 1)
    const report = await buildCalibrationReport(input)
    assertEquals(report.total.invalid, 1)
    assertEquals(report.total.missing, 1)
    assertEquals(report.total.exact, {
      numerator: 14,
      denominator: 16,
      value: 14 / 16,
    })
    assertEquals(report.total.within_one.numerator, 15)
    assertEquals(report.total.severe_errors.numerator, 1)
    assertEquals(report.total.accepted_accuracy.denominator, 16)
  }
)

Deno.test(
  'confidence bins include one exactly once and count wrong forced answers',
  async () => {
    const input = await syntheticInputs()
    input.responses.responses[0].candidate.confidence = 1
    input.responses.responses[1].candidate.confidence = 0.8
    input.responses.responses[2].candidate.confidence = 0.5
    input.responses.responses[9].candidate = { level: 'A2', confidence: 0.9 }
    const report = await buildCalibrationReport(input)
    assertEquals(
      report.total.confidence_reliability.map(bin => bin.count),
      [0, 1, 18]
    )
    assertEquals(report.total.confidence_reliability[0].accuracy.value, null)
    assertEquals(report.total.confidence_reliability[2].accuracy.numerator, 17)
    assertEquals(report.total.expected_abstention_accuracy, {
      numerator: 3,
      denominator: 4,
      value: 0.75,
    })
    assertEquals(report.items[9].would_accept_at_proposed_threshold, false)
  }
)

Deno.test(
  'a reviewed acceptable set scores minimum distance without invented confusion label',
  async () => {
    const input = await syntheticInputs()
    input.fixture.items[0].expectation.levels = ['A1', 'A2']
    await rebindSyntheticInputs(input)
    const report = await buildCalibrationReport(input)
    assertEquals(report.total.exact.numerator, 18)
    assertEquals(report.total.acceptable_set_items, 1)
    assertEquals(report.total.confusion.A2.A2, 17)
  }
)

const responseMutations: Record<
  string,
  (value: Awaited<ReturnType<typeof syntheticInputs>>['responses']) => void
> = {
  'duplicate item': batch => {
    batch.responses.push(batch.responses[0])
  },
  'missing item ID': batch => {
    batch.responses[0].id = ''
  },
  'unknown item ID': batch => {
    batch.responses[0].id = 'not-in-fixture'
  },
  'mismatched input': batch => {
    batch.responses[0].input_sha256 = '0'.repeat(64)
  },
  'mismatched request': batch => {
    batch.request_sha256 = '0'.repeat(64)
  },
  'mismatched profile': batch => {
    batch.profile_sha256 = '0'.repeat(64)
  },
  'duplicate provider response': batch => {
    batch.responses[1].response_id = batch.responses[0].response_id
  },
  'missing provenance': batch => {
    batch.provenance.run_id = ''
  },
}
for (const [name, mutate] of Object.entries(responseMutations)) {
  Deno.test(`report rejects ${name}`, async () => {
    const input = await syntheticInputs()
    mutate(input.responses)
    await assertRejects(() => buildCalibrationReport(input))
  })
}

Deno.test(
  'reports are deterministic and policy or evidence changes invalidate their digest',
  async () => {
    const input = await syntheticInputs()
    const report = await buildCalibrationReport(input)
    assertEquals(await buildCalibrationReport(structuredClone(input)), report)
    input.policy.confidence_threshold = 0.95
    const changed = await buildCalibrationReport(input)
    assertNotEquals(changed.sha256, report.sha256)
    assertNotEquals(changed.policy_sha256, report.policy_sha256)
    assertEquals(changed.total.accepted_accuracy.value, null)
    const without = await buildCalibrationReport({ ...input, policy: null })
    assertEquals(without.policy, null)
    assertEquals(without.total.accepted_accuracy.value, null)
  }
)
