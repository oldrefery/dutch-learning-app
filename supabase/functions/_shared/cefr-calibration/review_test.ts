import { assertEquals, assertRejects } from '@std/assert'
import { REQUIRED_SLICES } from './fixture.ts'
import { buildCalibrationReport } from './report.ts'
import { syntheticInputs } from './synthetic-fixtures.ts'

Deno.test(
  'mutating a returned report cannot weaken coverage in later reports',
  async () => {
    const input = await syntheticInputs()
    const before = await buildCalibrationReport(input)
    const required = [...REQUIRED_SLICES]
    try {
      Reflect.set(before.policy!.required_slices, 'length', 0)
      const after = await buildCalibrationReport(input)
      assertEquals(after.policy!.required_slices, required)
    } finally {
      if (REQUIRED_SLICES.length !== required.length) {
        for (const [index, slice] of required.entries())
          Reflect.set(REQUIRED_SLICES, index, slice)
        Reflect.set(REQUIRED_SLICES, 'length', required.length)
      }
    }
  }
)

Deno.test(
  'unsupported acceptance-policy fields are rejected instead of omitted from its digest',
  async () => {
    const input = await syntheticInputs()
    await assertRejects(
      () =>
        buildCalibrationReport({
          ...input,
          policy: { ...input.policy, minimum_accepted_acuracy: 1 },
        }),
      Error,
      'unsupported_policy_setting'
    )
  }
)

Deno.test(
  'an explicit policy slice list cannot silently differ from enforced slices',
  async () => {
    const input = await syntheticInputs()
    await assertRejects(
      () =>
        buildCalibrationReport({
          ...input,
          policy: { ...input.policy, required_slices: [] },
        }),
      Error,
      'unsupported_policy_slices'
    )
  }
)

Deno.test(
  'a serialized supported policy preserves its exact report and digest',
  async () => {
    const input = await syntheticInputs()
    const original = await buildCalibrationReport(input)
    const restored = await buildCalibrationReport({
      ...input,
      policy: JSON.parse(JSON.stringify(original.policy)),
    })
    assertEquals(restored, original)
  }
)
