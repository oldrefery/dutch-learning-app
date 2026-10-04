import {
  assertEquals,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from '@std/assert'
import { validateFixture } from './fixture.ts'
import { syntheticInputs, syntheticItem } from './synthetic-fixtures.ts'
import { validatePolicy, validateProfile } from './profile.ts'
import { objectDigest, sha256 } from './validation.ts'
import { canonicalizeCefrInput } from '../../../../packages/domain/src/shared-dictionary.ts'

Deno.test(
  'synthetic fixtures bind exact dictionary inputs and retain origin',
  async () => {
    const input = await syntheticInputs()
    const parsed = await validateFixture(input.fixture)
    assertEquals(parsed.origin, 'synthetic')
    assertEquals(parsed.items.length, 22)
    assertEquals(parsed.items[0].input_schema_version, 1)
    assertEquals(parsed.sha256, await objectDigest(input.fixture))
  }
)

const fixtureMutations: Record<
  string,
  (value: Awaited<ReturnType<typeof syntheticInputs>>['fixture']) => void
> = {
  'analysis namespace': fixture => {
    fixture.namespace = 'word-analysis-cefr-v1'
  },
  'input schema': fixture => {
    fixture.items[0].input_schema_version = 2
  },
  'input hash': fixture => {
    fixture.items[0].input_sha256 = '0'.repeat(64)
  },
  'canonical content': fixture => {
    fixture.items[0].content.translations.en = ['Changed meaning']
  },
  'canonical string': fixture => {
    fixture.items[0].canonical_input += ' '
  },
  'duplicate IDs': fixture => {
    fixture.items[1].id = fixture.items[0].id
  },
  'empty fixture': fixture => {
    fixture.items = []
  },
  'guessed reviewed labels': fixture => {
    fixture.origin = 'reviewed'
  },
  'unreviewed known labels': fixture => {
    fixture.origin = 'unreviewed'
  },
  'invalid CEFR level': fixture => {
    fixture.items[0].expectation.levels = ['A0']
  },
  'unknown slice': fixture => {
    fixture.items[0].slices = ['unrecognized']
  },
  'family leakage': fixture => {
    fixture.items[11].family = fixture.items[0].family
  },
  'homograph leakage': fixture => {
    fixture.items[11] = {
      ...structuredClone(fixture.items[0]),
      id: 'other-sense',
      family: 'other-family',
      split: 'held_out',
    }
  },
}
for (const [name, mutate] of Object.entries(fixtureMutations)) {
  Deno.test(`fixture rejects ${name}`, async () => {
    const { fixture } = await syntheticInputs()
    mutate(fixture)
    await assertRejects(() => validateFixture(fixture))
  })
}

Deno.test(
  'reviewed expected levels require permission and adjudication',
  async () => {
    for (const field of [
      'permission_ref',
      'adjudication',
      'reviewer',
      'evidence_ref',
    ] as const) {
      const { fixture } = await syntheticInputs(true)
      fixture.items[0].review[field] = null
      await assertRejects(
        () => validateFixture(fixture),
        Error,
        'review_evidence_required'
      )
    }
  }
)

Deno.test(
  'same-spelling distinct senses stay separate within one split',
  async () => {
    const { fixture } = await syntheticInputs()
    const other = {
      ...structuredClone(fixture.items[0]),
      id: 'another-meaning',
    }
    other.content.translations.en = ['A different synthetic sense']
    other.canonical_input = canonicalizeCefrInput(other.content)
    other.input_sha256 = await sha256(other.canonical_input)
    fixture.items.push(other)
    const parsed = await validateFixture(fixture)
    assertEquals(parsed.items.length, 23)
  }
)

Deno.test(
  'unreviewed unknown inputs are allowed but cannot supply a known label',
  async () => {
    const item = await syntheticItem('uncertain', 'held_out', 'ambiguous')
    const parsed = await validateFixture({
      namespace: 'dictionary-cefr-calibration-v1',
      revision: 'TEST-ONLY',
      origin: 'unreviewed',
      items: [item],
    })
    assertEquals(parsed.items[0].expectation.kind, 'abstain')
  }
)

Deno.test(
  'method and policy require explicit settings, version availability and thresholds',
  async () => {
    const input = await syntheticInputs()
    for (const field of [
      'generation_config',
      'resolved_model_version',
      'method_revision',
      'prompt_revision',
      'requested_model',
    ]) {
      const profile: Record<string, unknown> = { ...input.profile }
      delete profile[field]
      await assertRejects(async () => {
        await objectDigest(validateProfile(profile))
      })
    }
    for (const bins of [
      [0, 0.8, 0.5, 1],
      [0.1, 1],
      [0, 0.8],
      [0, 1, 1],
    ]) {
      assertThrows(() => {
        validatePolicy({ ...input.policy, confidence_bins: bins })
      })
    }
    for (const threshold of [null, NaN, Infinity, -0.1, 1.1]) {
      assertThrows(() => {
        validatePolicy({ ...input.policy, confidence_threshold: threshold })
      })
    }
  }
)

Deno.test(
  'duplicate linguistic inputs cannot inflate reviewed sample counts',
  async () => {
    const { fixture } = await syntheticInputs()
    fixture.items.push({
      ...structuredClone(fixture.items[0]),
      id: 'duplicate-under-another-id',
    })
    await assertRejects(
      () => validateFixture(fixture),
      Error,
      'duplicate_meaning_input'
    )
  }
)

Deno.test({
  name: 'offline permission audit remains isolated under broader Edge test flags',
  permissions: {
    net: false,
    read: false,
    write: false,
    env: false,
    run: false,
  },
  fn: async () => {
    for (const name of ['net', 'read', 'write', 'env', 'run'] as const) {
      assertNotEquals((await Deno.permissions.query({ name })).state, 'granted')
    }
  },
})
