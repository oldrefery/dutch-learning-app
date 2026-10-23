import assert from 'node:assert/strict'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  journalPacket,
  type GeminiTransport,
  type ProviderOutcome,
} from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import { creationPilotPacket } from './creation-pilot-packet.ts'
import {
  runCreationPilot,
  type CreationPilotOptions,
} from './creation-pilot-runner.ts'
import { replayCreationPilot } from './creation-pilot-replay.ts'
import { writeOnce, readJson } from './creation-pilot-journal.ts'
import {
  allocatedCharge,
  historicalCharge,
  reportedCharge,
  priorDispatchTimes,
} from './creation-pilot-budget.ts'

const JUDGE_VERSION = 'gemini-3.6-flash'

const DAY = '2026-10-11'
const CLIENT_FAILURE = 'client-failure'
const THROWN_TRANSPORT = 'thrown-transport'
const ANALYSIS_SCOPE = 'analysis-scope'
const EXISTING_LOCK = 'existing-lock'
const BEFORE_RUN = 'before-run'
const PARTIAL_CLAIM = 'partial-claim'
const RUN_RECEIPT = 'run-receipt'

async function fixture() {
  const directory = await Deno.makeTempDir({ prefix: 'creation-pilot-' })
  const current = await creationPilotPacket()
  const packetPath = `${directory}/candidate.json`,
    authorityPath = `${directory}/authority.json`,
    output = `${directory}/run`,
    budgetDirectory = `${directory}/budget`
  await writeOnce(packetPath, current)
  const authority = {
    id: 'AUTH-CREATION-TEST',
    kind: 'creation-qualification',
    packet_sha256: current.packet_sha256,
    local_day: DAY,
    expires_at: '2026-10-11T22:00:00Z',
    maximum_aggregate_usd: 15,
    maximum_calls: 48,
    automatic_retries: 0,
    personal_google_project_confirmed: true,
    distinct_judge_model_confirmed: true,
    readiness_review_accepted: true,
  }
  await writeOnce(authorityPath, authority)
  let at = Date.parse('2026-10-11T21:00:00Z'),
    calls = 0,
    factories = 0,
    sleeps = 0
  const ids: string[] = []
  let change:
    ((outcome: ProviderOutcome, id: string) => ProviderOutcome) | null = null
  const transport: GeminiTransport = {
    invoke: (request, id) => {
      calls++
      ids.push(id)
      at += 1000
      const parent = current.packet.requests.find(
        r => r.id === id || `${r.id}-judge` === id
      )!
      const phase = id.endsWith('-judge') ? 'judgement' : parent.phase
      const data = JSON.parse(
        JSON.parse(request.body).contents[0].parts[0].text
      )
      const expected =
        phase === 'generation'
          ? null
          : id.endsWith('-judge')
            ? 'same-meaning'
            : current.packet.corpus.find(c => c.id === parent.case_id)!.expected
      const content =
        phase === 'generation'
          ? parent.context.result.content
          : {
              ...data.binding,
              decision: expected,
              checks: [
                'translations-en',
                'translations-ru',
                'examples',
                'related-words',
                'notes',
                'grammar',
              ].map((dimension, i) => ({
                dimension,
                verdict:
                  i === 0 && expected !== 'same-meaning'
                    ? expected === 'different-meaning'
                      ? 'contradicted'
                      : 'uncertain'
                    : 'preserved',
                reason: 'Synthetic fixture only.',
                anchor_quote: data.creation_input.anchor.gloss,
              })),
            }
      const envelope = {
        modelVersion:
          phase === 'generation'
            ? current.packet.profile.generation_model_version
            : current.packet.profile.judgement_model_version,
        responseId: `fixture-${id}`,
        usageMetadata: {
          promptTokenCount: 100,
          totalTokenCount: 200,
          serviceTier: 'standard',
        },
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: JSON.stringify({ content }) }] },
          },
        ],
      }
      const outcome: ProviderOutcome = {
        kind: 'returned',
        requestId: `fixture-${id}`,
        result: journalPacket(JSON.stringify(envelope)),
      }
      return Promise.resolve(change ? change(outcome, id) : outcome)
    },
  }
  const options: CreationPilotOptions = {
    packetPath,
    output,
    authorityPath,
    budgetDirectory,
    preflightConnectivity: () => Promise.resolve(),
    transportFactory: () => {
      factories++
      return transport
    },
    now: () => at,
    sleep: ms => {
      sleeps++
      at += ms
      return Promise.resolve()
    },
  }
  return {
    directory,
    current,
    authority,
    options,
    setChange: (fn: typeof change) => {
      change = fn
    },
    advance: (ms: number) => {
      at += ms
    },
    counts: () => ({ calls, factories, sleeps, ids }),
    cleanup: () => Deno.remove(directory, { recursive: true }),
  }
}
Deno.test(
  'creation pilot completes48 unique journals and replays without transport or environment',
  async () => {
    const f = await fixture()
    try {
      const report = await runCreationPilot(f.options)
      assert.equal(report.complete, true)
      assert.equal(report.thresholds_pass, true)
      assert.equal(report.qualified, false)
      assert.equal(report.provider_results, 48)
      assert.equal(report.generated.length, 4)
      assert.equal(f.counts().calls, 48)
      assert.equal(new Set(f.counts().ids).size, 48)
      assert.ok(f.counts().sleeps >= 4)
      assert.equal(report.committed_nanousd, 48 * (100 * 750 + 100 * 3750))
      assert.deepEqual(await replayCreationPilot(f.options.output), report)
      assert.equal(
        await allocatedCharge(f.options.budgetDirectory, DAY),
        report.committed_nanousd
      )
      await assert.rejects(runCreationPilot(f.options))
      assert.equal(f.counts().calls, 48)
      assert.equal(f.counts().factories, 1)
    } finally {
      await f.cleanup()
    }
  }
)
for (const receipt of [
  'same-path',
  'copied',
  'reformatted',
  'new-day',
] as const)
  Deno.test(
    `settled authority refuses ${receipt} reuse in a new output before credentials`,
    async () => {
      const f = await fixture()
      try {
        await runCreationPilot(f.options)
        const original = await Deno.readTextFile(f.options.authorityPath)
        const authorityPath = `${f.directory}/copied-authority.json`
        if (receipt !== 'same-path')
          await writeOnce(authorityPath, {
            ...f.authority,
            ...(receipt === 'new-day'
              ? { local_day: '2026-10-12', expires_at: '2026-10-12T22:00:00Z' }
              : {}),
          })
        if (receipt === 'copied')
          await Deno.writeTextFile(authorityPath, original)
        if (receipt === 'reformatted')
          await Deno.writeTextFile(authorityPath, JSON.stringify(f.authority))
        if (receipt === 'new-day') f.advance(86400000)
        await assert.rejects(
          runCreationPilot({
            ...f.options,
            output: `${f.directory}/second-run`,
            authorityPath:
              receipt === 'same-path' ? f.options.authorityPath : authorityPath,
          }),
          /authority-already-consumed/
        )
        assert.equal(f.counts().calls, 48)
        assert.equal(f.counts().factories, 1)
      } finally {
        await f.cleanup()
      }
    }
  )
Deno.test(
  'new explicit authority remains distinct after settled permission',
  async () => {
    const f = await fixture()
    try {
      await runCreationPilot(f.options)
      const authorityPath = `${f.directory}/new-authority.json`
      await writeOnce(authorityPath, {
        ...f.authority,
        id: 'AUTH-CREATION-NEW',
      })
      const report = await runCreationPilot({
        ...f.options,
        output: `${f.directory}/new-run`,
        authorityPath,
      })
      assert.equal(report.complete, true)
      assert.equal(f.counts().calls, 96)
      assert.equal(f.counts().factories, 2)
      assert.equal(
        await allocatedCharge(f.options.budgetDirectory, DAY),
        43200000
      )
    } finally {
      await f.cleanup()
    }
  }
)
for (const interruption of [
  BEFORE_RUN,
  'before-credentials',
  'claim-only',
  PARTIAL_CLAIM,
] as const)
  Deno.test(
    `interrupted ${interruption} claim cannot redispatch or replenish authority`,
    async () => {
      const f = await fixture()
      try {
        if (interruption === BEFORE_RUN) await Deno.mkdir(f.options.output)
        f.options.transportFactory = () => {
          throw new Error('fixture credential construction interrupted')
        }
        await assert.rejects(runCreationPilot(f.options))
        const path = `${f.options.budgetDirectory}/${f.authority.id}.allocation.json`
        const allocation = await readJson(path)
        assert.equal(allocation.allocation_id, f.authority.id)
        assert.equal(allocation.packet_sha256, f.current.packet_sha256)
        assert.equal(allocation.run_directory, f.options.output)
        assert.equal(
          allocation.authority_sha256,
          await sha256(await Deno.readTextFile(f.options.authorityPath))
        )
        assert.deepEqual(allocation.authority, f.authority)
        if (interruption === 'claim-only') {
          await Deno.remove(f.options.output, { recursive: true })
          assert.deepEqual(
            await priorDispatchTimes(
              f.current,
              f.options.budgetDirectory,
              Date.parse('2026-10-11T21:00:00Z')
            ),
            []
          )
        }
        if (interruption === PARTIAL_CLAIM) await Deno.writeTextFile(path, '{')
        if (interruption !== PARTIAL_CLAIM)
          assert.equal(
            await allocatedCharge(f.options.budgetDirectory, DAY),
            13440000000
          )
        else
          await assert.rejects(allocatedCharge(f.options.budgetDirectory, DAY))
        await assert.rejects(
          runCreationPilot({ ...f.options, output: `${f.directory}/retry` }),
          /authority-already-consumed/
        )
        assert.equal(f.counts().calls, 0)
        assert.equal(f.counts().factories, 0)
      } finally {
        await f.cleanup()
      }
    }
  )
Deno.test(
  'concurrent launch shares one authority claim and one transport factory',
  async () => {
    const f = await fixture()
    try {
      const outcomes = await Promise.allSettled([
        runCreationPilot(f.options),
        runCreationPilot({ ...f.options, output: `${f.directory}/concurrent` }),
      ])
      assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1)
      assert.equal(outcomes.filter(o => o.status === 'rejected').length, 1)
      assert.equal(f.counts().calls, 48)
      assert.equal(f.counts().factories, 1)
    } finally {
      await f.cleanup()
    }
  }
)
for (const target of [
  RUN_RECEIPT,
  'allocation-run',
  'settlement-identity',
] as const)
  Deno.test(
    `authority ${target} tampering fails replay or settlement binding`,
    async () => {
      const f = await fixture()
      try {
        await runCreationPilot(f.options)
        const path =
          target === RUN_RECEIPT
            ? `${f.options.output}/run.json`
            : `${f.options.budgetDirectory}/${f.authority.id}.${target === 'allocation-run' ? 'allocation' : 'settlement'}.json`
        const value = await readJson(path)
        if (target === RUN_RECEIPT) value.authority_receipt = '{}'
        else value.run_id = crypto.randomUUID()
        await Deno.writeTextFile(path, JSON.stringify(value))
        if (target === RUN_RECEIPT)
          await assert.rejects(
            replayCreationPilot(f.options.output),
            /authority-binding/
          )
        else
          await assert.rejects(
            allocatedCharge(f.options.budgetDirectory, DAY),
            /binding-conflict|invalid-day-settlement/
          )
        assert.equal(f.counts().calls, 48)
      } finally {
        await f.cleanup()
      }
    }
  )
for (const kind of [
  'wrong-version',
  'missing-usage',
  'invalid-verdict',
  'unknown',
  CLIENT_FAILURE,
  THROWN_TRANSPORT,
] as const)
  Deno.test(
    `creation ${kind} is durable, stops once and retains full allocation`,
    async () => {
      const f = await fixture()
      try {
        f.setChange(outcome => {
          if (kind === THROWN_TRANSPORT)
            throw new Error('fixture transport exception')
          if (kind === 'unknown')
            return { kind: 'provider-outcome-unknown', evidence_sha256: null }
          if (kind === CLIENT_FAILURE)
            return { kind: 'provider-failed', evidence_sha256: 'f'.repeat(64) }
          assert.equal(outcome.kind, 'returned')
          if (outcome.kind !== 'returned') throw new Error('fixture')
          const raw = structuredClone(record(outcome.result.provider_response))
          if (kind === 'wrong-version')
            raw.modelVersion = f.current.packet.profile.generation_model_version
          if (kind === 'missing-usage') delete raw.usageMetadata
          if (kind === 'invalid-verdict')
            raw.candidates = [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: '{"content":null}' }] },
              },
            ]
          return { ...outcome, result: journalPacket(canonicalizeJson(raw)) }
        })
        await assert.rejects(runCreationPilot(f.options))
        assert.equal(f.counts().calls, 1)
        const first = f.current.packet.requests[0]
        assert.ok(
          await readJson(
            `${f.options.output}/${first.id}.${['unknown', CLIENT_FAILURE, THROWN_TRANSPORT].includes(kind) ? 'failure' : 'result'}.json`
          )
        )
        assert.equal(
          (await readJson(`${f.options.output}/termination.json`))
            .full_allocation_retained,
          true
        )
        assert.equal(
          await allocatedCharge(f.options.budgetDirectory, DAY),
          13440000000
        )
        await assert.rejects(
          runCreationPilot({ ...f.options, output: `${f.directory}/another` })
        )
        assert.equal(f.counts().calls, 1)
      } finally {
        await f.cleanup()
      }
    }
  )
for (const kind of [
  ANALYSIS_SCOPE,
  'unreviewed',
  'expired',
  'packet-tamper',
  'budget-exhausted',
  EXISTING_LOCK,
] as const)
  Deno.test(
    `creation ${kind} refuses before credentials and provider`,
    async () => {
      const f = await fixture()
      try {
        if (kind === ANALYSIS_SCOPE || kind === 'unreviewed')
          await Deno.writeTextFile(
            f.options.authorityPath,
            JSON.stringify({
              ...f.authority,
              ...(kind === ANALYSIS_SCOPE
                ? { kind: 'direct-analysis' }
                : { readiness_review_accepted: false }),
            })
          )
        if (kind === 'expired') f.advance(3600000)
        if (kind === 'packet-tamper')
          await Deno.writeTextFile(
            f.options.packetPath,
            JSON.stringify({ ...f.current, packet_sha256: 'f'.repeat(64) })
          )
        if (kind === 'budget-exhausted' || kind === EXISTING_LOCK) {
          await Deno.mkdir(f.options.budgetDirectory)
          if (kind === EXISTING_LOCK)
            await Deno.writeTextFile(
              `${f.options.budgetDirectory}/budget.lock`,
              'unreconciled allocation'
            )
          else
            await writeOnce(
              `${f.options.budgetDirectory}/previous.allocation.json`,
              {
                local_day: DAY,
                run_directory: f.options.output,
                packet_sha256: f.current.packet_sha256,
                reserved_nanousd: 13440000000,
              }
            )
        }
        await assert.rejects(runCreationPilot(f.options))
        assert.deepEqual(f.counts(), {
          calls: 0,
          factories: 0,
          sleeps: 0,
          ids: [],
        })
      } finally {
        await f.cleanup()
      }
    }
  )
Deno.test(
  'creation historical accounting reconstructs95 prior attempts and one retained failure',
  async () => {
    const f = await fixture()
    try {
      assert.deepEqual(await historicalCharge(f.current, DAY), {
        committed_nanousd: 814253500,
        calls: 95,
        unsettled: 1,
      })
      assert.equal(
        (await historicalCharge(f.current, '2026-10-12')).committed_nanousd,
        0
      )
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'creation offline replay refuses changed response and missing seal',
  async () => {
    const f = await fixture()
    try {
      await runCreationPilot(f.options)
      const path = `${f.options.output}/${f.current.packet.requests[0].id}.result.json`
      const prior = await Deno.readTextFile(path)
      const value = JSON.parse(prior)
      value.request_id = 'edited-response'
      await Deno.writeTextFile(path, JSON.stringify(value))
      await assert.rejects(
        replayCreationPilot(f.options.output),
        /seal-conflict/
      )
      await Deno.writeTextFile(path, prior)
      await Deno.remove(`${f.options.output}/seal.json`)
      await assert.rejects(replayCreationPilot(f.options.output))
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'creation expiry during rate wait stops before next dispatch and partial replay stays incomplete',
  async () => {
    const f = await fixture()
    try {
      f.options.sleep = () => {
        f.advance(3600000)
        return Promise.resolve()
      }
      await assert.rejects(runCreationPilot(f.options), /expired/)
      assert.equal(f.counts().calls, 10)
      assert.equal(
        (await replayCreationPilot(f.options.output, false)).complete,
        false
      )
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'creation billing refuses unsupported tier, invalid cache, tools and unsafe token bounds',
  () => {
    for (const usage of [
      { serviceTier: 'priority', promptTokenCount: 1, totalTokenCount: 2 },
      {
        serviceTier: 'standard',
        promptTokenCount: 1,
        totalTokenCount: 2,
        cachedContentTokenCount: 2,
      },
      {
        serviceTier: 'standard',
        promptTokenCount: 1,
        totalTokenCount: 2,
        toolUsePromptTokenCount: 1,
      },
      {
        serviceTier: 'standard',
        promptTokenCount: 32769,
        totalTokenCount: 32769,
      },
      { serviceTier: 'standard', promptTokenCount: 1, totalTokenCount: 65538 },
    ])
      assert.throws(() =>
        reportedCharge(
          {
            provider_response: {
              modelVersion: JUDGE_VERSION,
              usageMetadata: usage,
            },
          },
          JUDGE_VERSION
        )
      )
  }
)
Deno.test(
  'all fixed scores cannot hide a failed generated semantic pair',
  async () => {
    const f = await fixture()
    try {
      f.setChange((outcome, id) => {
        if (!id.endsWith('-judge') || outcome.kind !== 'returned')
          return outcome
        const raw = record(structuredClone(outcome.result.provider_response))
        const candidates = raw.candidates as {
          content: { parts: { text: string }[] }
        }[]
        const data = JSON.parse(candidates[0].content.parts[0].text)
        data.content.decision = 'different-meaning'
        data.content.checks[0].verdict = 'contradicted'
        candidates[0].content.parts[0].text = JSON.stringify(data)
        return { ...outcome, result: journalPacket(canonicalizeJson(raw)) }
      })
      const report = await runCreationPilot(f.options)
      assert.equal(report.complete, true)
      assert.equal(report.positive_acceptance, 1)
      assert.equal(report.thresholds_pass, false)
      assert.equal(report.qualified, false)
      assert.equal(f.counts().calls, 48)
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'wrong generated lexical identity stops before contingent judge and retains raw response',
  async () => {
    const f = await fixture()
    try {
      f.setChange((outcome, id) => {
        if (!id.startsWith('generation-') || outcome.kind !== 'returned')
          return outcome
        const raw = record(structuredClone(outcome.result.provider_response))
        const candidates = raw.candidates as {
          content: { parts: { text: string }[] }
        }[]
        const data = JSON.parse(candidates[0].content.parts[0].text)
        data.content.dutch_lemma = 'other'
        candidates[0].content.parts[0].text = JSON.stringify(data)
        return { ...outcome, result: journalPacket(canonicalizeJson(raw)) }
      })
      await assert.rejects(runCreationPilot(f.options), /candidate-rejected/)
      assert.equal(f.counts().calls, 41)
      assert.ok(!f.counts().ids.some(id => id.endsWith('-judge')))
      assert.equal(
        (await replayCreationPilot(f.options.output, false)).complete,
        false
      )
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'completed settlement charge is rederived and tampering cannot free daily budget',
  async () => {
    const f = await fixture()
    try {
      await runCreationPilot(f.options)
      const allocation = (await readJson(`${f.options.output}/run.json`))
        .allocation_id
      const path = `${f.options.budgetDirectory}/${allocation}.settlement.json`
      const s = await readJson(path)
      s.committed_nanousd = 0
      await Deno.writeTextFile(path, JSON.stringify(s))
      await assert.rejects(
        allocatedCharge(f.options.budgetDirectory, DAY),
        /charge-conflict/
      )
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'authority changes during a run stop before the next dispatch',
  async () => {
    const f = await fixture()
    try {
      const original = f.options.transportFactory
      f.options.transportFactory = () => {
        const transport = original()
        return {
          invoke: async (request, id) => {
            const result = await transport.invoke(request, id)
            await Deno.writeTextFile(
              f.options.authorityPath,
              JSON.stringify({ ...f.authority, id: 'AUTH-CHANGED' })
            )
            return result
          },
        }
      }
      await assert.rejects(runCreationPilot(f.options), /receipt-changed/)
      assert.equal(f.counts().calls, 1)
    } finally {
      await f.cleanup()
    }
  }
)

Deno.test(
  'connectivity failure precedes claim, credentials and paid dispatch',
  async () => {
    const f = await fixture()
    try {
      await assert.rejects(
        runCreationPilot({
          ...f.options,
          preflightConnectivity: () => Promise.reject(new Error('offline')),
        }),
        /offline/
      )
      assert.equal(f.counts().factories, 0)
      assert.equal(f.counts().calls, 0)
      await assert.rejects(
        Deno.stat(
          `${f.options.budgetDirectory}/${f.authority.id}.allocation.json`
        ),
        Deno.errors.NotFound
      )
      await assert.rejects(Deno.stat(f.options.output), Deno.errors.NotFound)
      await assert.rejects(
        Deno.stat(`${f.options.budgetDirectory}/budget.lock`),
        Deno.errors.NotFound
      )
    } finally {
      await f.cleanup()
    }
  }
)
Deno.test(
  'connectivity success still rechecks authority expiry before claim',
  async () => {
    const f = await fixture()
    try {
      await assert.rejects(
        runCreationPilot({
          ...f.options,
          preflightConnectivity: () => {
            f.advance(86400000)
            return Promise.resolve()
          },
        }),
        /expired/
      )
      assert.equal(f.counts().factories, 0)
      await assert.rejects(
        Deno.stat(
          `${f.options.budgetDirectory}/${f.authority.id}.allocation.json`
        ),
        Deno.errors.NotFound
      )
    } finally {
      await f.cleanup()
    }
  }
)

Deno.test(
  'completed billing survives unavailable current source without renewing authority',
  async () => {
    const f = await fixture()
    const cwd = Deno.cwd()
    try {
      const report = await runCreationPilot(f.options)
      Deno.chdir(f.directory)
      assert.equal(
        await allocatedCharge(f.options.budgetDirectory, DAY),
        report.committed_nanousd
      )
      await assert.rejects(runCreationPilot(f.options))
      assert.equal(f.counts().calls, 48)
      assert.equal(f.counts().factories, 1)
    } finally {
      Deno.chdir(cwd)
      await f.cleanup()
    }
  }
)

Deno.test(
  'frozen completed billing rejects repinned usage, model, duplicate response and extra evidence',
  async () => {
    const f = await fixture()
    try {
      const report = await runCreationPilot(f.options)
      const settlementPath = `${f.options.budgetDirectory}/${f.authority.id}.settlement.json`
      const originalSettlement = await Deno.readTextFile(settlementPath)
      const original = new Map<string, string>()
      for await (const file of Deno.readDir(f.options.output))
        original.set(
          file.name,
          await Deno.readTextFile(`${f.options.output}/${file.name}`)
        )
      const resultNames = [...original.keys()]
        .filter(name => name.endsWith('.result.json'))
        .sort()
      const save = async (name: string, value: unknown) => {
        await Deno.writeTextFile(
          `${f.options.output}/${name}`,
          JSON.stringify(value)
        )
      }
      for (const mutation of [
        'charge',
        'model',
        'duplicate',
        'extra',
      ] as const) {
        for (const [name, value] of original)
          await Deno.writeTextFile(`${f.options.output}/${name}`, value)
        const settlement = JSON.parse(originalSettlement)
        if (mutation === 'charge') {
          const changed = await readJson(`${f.options.output}/report.json`)
          changed.committed_nanousd = Number(changed.committed_nanousd) - 1
          settlement.committed_nanousd = changed.committed_nanousd
          await save('report.json', changed)
        } else if (mutation === 'model') {
          const name = resultNames[0].replace('.result.', '.dispatch.')
          const dispatch = await readJson(`${f.options.output}/${name}`)
          record(dispatch.request).model = 'gemini-unsupported'
          await save(name, dispatch)
        } else if (mutation === 'duplicate') {
          const first = await readJson(`${f.options.output}/${resultNames[0]}`)
          const second = await readJson(`${f.options.output}/${resultNames[1]}`)
          second.request_id = first.request_id
          record(record(second.result).provider_response).responseId =
            first.request_id
          second.result_sha256 = await sha256(canonicalizeJson(second.result))
          await save(resultNames[1], second)
        } else await save('extra.failure.json', { outcome: 'unknown' })
        const seal = await readJson(`${f.options.output}/seal.json`)
        for (const name of Object.keys(record(seal.receipts_sha256)))
          record(seal.receipts_sha256)[name] = await sha256(
            await Deno.readTextFile(`${f.options.output}/${name}`)
          )
        await save('seal.json', seal)
        for (const name of Object.keys(settlement.receipts_sha256))
          settlement.receipts_sha256[name] = await sha256(
            await Deno.readTextFile(`${f.options.output}/${name}`)
          )
        await Deno.writeTextFile(settlementPath, JSON.stringify(settlement))
        await assert.rejects(
          allocatedCharge(f.options.budgetDirectory, DAY),
          mutation
        )
      }
      await Deno.remove(`${f.options.output}/extra.failure.json`)
      for (const [name, value] of original)
        await Deno.writeTextFile(`${f.options.output}/${name}`, value)
      await Deno.writeTextFile(settlementPath, originalSettlement)
      assert.equal(
        await allocatedCharge(f.options.budgetDirectory, DAY),
        report.committed_nanousd
      )
      assert.equal(f.counts().calls, 48)
    } finally {
      await f.cleanup()
    }
  }
)

Deno.test(
  'implicit cached input is a discounted subset, including the saved AUTH37 response',
  async () => {
    const response = await readJson(
      'reports/shared-dictionary-cefr/d13a7-creation-translation-pilot-20261012/live-run/expanded-uncertain-en-1.result.json'
    )
    // (1916 - 431) * 750 + 431 * 75 + (4108 - 1916) * 3750.
    assert.equal(
      reportedCharge(record(response.result), JUDGE_VERSION),
      9366075
    )
    for (const cached of [undefined, 0, 100]) {
      const result = {
        provider_response: {
          modelVersion: JUDGE_VERSION,
          usageMetadata: {
            serviceTier: 'standard',
            promptTokenCount: 100,
            totalTokenCount: 200,
            cachedContentTokenCount: cached,
          },
        },
      }
      assert.equal(
        reportedCharge(result, JUDGE_VERSION),
        cached === 100 ? 382500 : 450000
      )
    }
  }
)

Deno.test(
  'implicit cache counters reject coercion, negative, fractional and excessive values',
  () => {
    for (const cached of [
      null,
      '1',
      -1,
      0.5,
      101,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assert.throws(() =>
        reportedCharge(
          {
            provider_response: {
              modelVersion: JUDGE_VERSION,
              usageMetadata: {
                serviceTier: 'standard',
                promptTokenCount: 100,
                totalTokenCount: 200,
                cachedContentTokenCount: cached,
              },
            },
          },
          JUDGE_VERSION
        )
      )
    }
  }
)

Deno.test(
  'implicit cache responses complete and replay without redispatch or full-price double counting',
  async () => {
    const f = await fixture()
    try {
      f.setChange(outcome => {
        if (outcome.kind !== 'returned') return outcome
        const raw = record(structuredClone(outcome.result.provider_response))
        record(raw.usageMetadata).cachedContentTokenCount = 40
        return { ...outcome, result: journalPacket(canonicalizeJson(raw)) }
      })
      const report = await runCreationPilot(f.options)
      assert.equal(report.complete, true)
      assert.equal(report.committed_nanousd, 48 * 423000)
      assert.equal(f.counts().calls, 48)
      assert.deepEqual(await replayCreationPilot(f.options.output), report)
      assert.equal(f.counts().calls, 48)
    } finally {
      await f.cleanup()
    }
  }
)
