import assert from 'node:assert/strict'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  sha256,
  record,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { creationPilotPacket } from './creation-pilot-packet.ts'
import { readJson, writeOnce } from './creation-pilot-journal.ts'
import { allocatedCharge } from './creation-pilot-budget.ts'
import { verifyTerminalAccounting } from './creation-terminal-evidence.ts'
import {
  prepareTerminalReconciliation,
  applyTerminalReconciliation,
} from './creation-terminal-settlement.ts'
import { runCreationPilot } from './creation-pilot-runner.ts'

const SOURCE =
  'reports/shared-dictionary-cefr/d13a7-creation-day-pilot-20261011'
const REVIEW =
  'reports/shared-dictionary-cefr/d13a7-creation-failure-review-20261011/reconciliation-review.json'
const ID = 'AUTH-33-CREATION-01'
const DAY = '2026-10-11'
async function fixture() {
  const root = await Deno.makeTempDir({ prefix: 'terminal-accounting-' })
  const directory = `${root}/run`,
    budgetDirectory = `${root}/budget`
  await Deno.mkdir(directory)
  await Deno.mkdir(budgetDirectory)
  for await (const file of Deno.readDir(`${SOURCE}/live-run`))
    await Deno.copyFile(
      `${SOURCE}/live-run/${file.name}`,
      `${directory}/${file.name}`
    )
  const allocation = await readJson(
    `reports/shared-dictionary-cefr/creation-pilot-day-budget/${ID}.allocation.json`
  )
  allocation.run_directory = directory
  const allocationPath = `${budgetDirectory}/${ID}.allocation.json`
  await writeOnce(allocationPath, allocation)
  const run = await readJson(`${directory}/run.json`)
  run.run_directory = directory
  await Deno.writeTextFile(`${directory}/run.json`, JSON.stringify(run))
  const review = await readJson(REVIEW),
    reviewPath = `${root}/review.json`
  const hashFile = async (path: string) =>
    await sha256(await Deno.readTextFile(path))
  const repin = async () => {
    const hashes: Record<string, string> = {}
    for await (const file of Deno.readDir(directory))
      if (file.isFile)
        hashes[`${directory}/${file.name}`] = await hashFile(
          `${directory}/${file.name}`
        )
    review.run_journal_sha256 = hashes
    review.allocation_sha256 = await hashFile(allocationPath)
    await Deno.writeTextFile(reviewPath, JSON.stringify(review))
    return await hashFile(reviewPath)
  }
  let reviewSha256 = await repin()
  const packetPath = `${root}/new-packet.json`,
    current = await creationPilotPacket()
  await writeOnce(packetPath, current)
  return {
    root,
    directory,
    budgetDirectory,
    allocationPath,
    review,
    reviewPath,
    current,
    hashFile,
    repin: async () => {
      reviewSha256 = await repin()
    },
    options: () => ({ packetPath, budgetDirectory, reviewPath, reviewSha256 }),
    verify: () =>
      verifyTerminalAccounting(allocationPath, {
        review_path: reviewPath,
        review_sha256: reviewSha256,
      }),
    cleanup: () => Deno.remove(root, { recursive: true }),
  }
}

Deno.test(
  'frozen pre-repair pilot reconciles without current-source regeneration; calculation leaves ledger untouched',
  async () => {
    const f = await fixture()
    try {
      const old = await readJson(`${f.directory}/packet.json`)
      assert.notEqual(old.packet_sha256, f.current.packet_sha256)
      const before = await f.hashFile(f.allocationPath)
      const calculation = await prepareTerminalReconciliation(f.options())
      assert.equal(calculation.settlement.committed_nanousd, 22074000)
      assert.equal(calculation.settlement.released_nanousd, 13417926000)
      assert.equal(calculation.before_committed_nanousd, 14254253500)
      assert.equal(calculation.after_committed_nanousd, 836327500)
      assert.equal(calculation.after_remaining_nanousd, 14163672500)
      assert.equal(calculation.historical.unsettled, 1)
      assert.equal(await allocatedCharge(f.budgetDirectory, DAY), 13440000000)
      assert.equal(await f.hashFile(f.allocationPath), before)
      await assert.rejects(
        Deno.stat(`${f.budgetDirectory}/${ID}.settlement.json`),
        Deno.errors.NotFound
      )
    } finally {
      await f.cleanup()
    }
  }
)

Deno.test(
  'reviewed terminal apply releases only known usage once and does not replenish authority',
  async () => {
    const f = await fixture()
    try {
      const calculation = await prepareTerminalReconciliation(f.options())
      const calculationPath = `${f.root}/calculation.json`
      await writeOnce(calculationPath, calculation)
      const options = {
        ...f.options(),
        calculationPath,
        calculationSha256: await f.hashFile(calculationPath),
      }
      const claimHash = await f.hashFile(f.allocationPath)
      const results = await Promise.allSettled([
        applyTerminalReconciliation(options),
        applyTerminalReconciliation(options),
      ])
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
      assert.equal(await allocatedCharge(f.budgetDirectory, DAY), 22074000)
      assert.equal(await f.hashFile(f.allocationPath), claimHash)
      await assert.rejects(
        applyTerminalReconciliation(options),
        /already-settled/
      )
      await assert.rejects(
        prepareTerminalReconciliation(f.options()),
        /already-settled/
      )
      const authority = {
        ...(await readJson(`${SOURCE}/authorization.json`)),
        packet_sha256: f.current.packet_sha256,
      }
      await writeOnce(`${f.root}/reuse.json`, authority)
      let factories = 0
      await assert.rejects(
        runCreationPilot({
          ...f.options(),
          output: `${f.root}/reuse`,
          authorityPath: `${f.root}/reuse.json`,
          now: () => Date.parse('2026-10-11T21:00:00Z'),
          preflightConnectivity: () => Promise.resolve(),
          transportFactory: () => {
            factories++
            throw new Error('unexpected-transport')
          },
        }),
        /already-consumed/
      )
      assert.equal(factories, 0)
      const settlementPath = `${f.budgetDirectory}/${ID}.settlement.json`
      const settlement = await readJson(settlementPath)
      settlement.committed_nanousd = 0
      await Deno.writeTextFile(settlementPath, JSON.stringify(settlement))
      await assert.rejects(
        allocatedCharge(f.budgetDirectory, DAY),
        /terminal-settlement-conflict/
      )
    } finally {
      await f.cleanup()
    }
  }
)

type Fixture = Awaited<ReturnType<typeof fixture>>
async function editEvidence(
  f: Fixture,
  name: string,
  change: (saved: Record<string, unknown>) => void | Promise<void>
) {
  const path = `${f.directory}/${name}`,
    saved = await readJson(path)
  await change(saved)
  await Deno.writeTextFile(path, JSON.stringify(saved))
  await f.repin()
}
const RESULT = 'positive-2-1.result.json'
const mutations: Record<string, (f: Fixture) => Promise<unknown>> = {
  'unknown-review': async f => {
    f.review.unknown = 1
    await f.repin()
  },
  'unreviewed-file': f => writeOnce(`${f.directory}/extra.json`, {}),
  'missing-result': async f => {
    await Deno.remove(`${f.directory}/${RESULT}`)
    await f.repin()
  },
  'extra-failure': async f => {
    await writeOnce(`${f.directory}/positive-2-1.failure.json`, {
      kind: 'provider-outcome-unknown',
    })
    await f.repin()
  },
  'dispatch-gap': async f => {
    await Deno.remove(`${f.directory}/positive-1-1.dispatch.json`)
    await f.repin()
  },
  'review-charge': async f => {
    f.review.new_reported_charge_nanousd = 0
    await f.repin()
  },
  'run-binding': f =>
    editEvidence(f, 'run.json', saved => {
      saved.run_id = '00000000-0000-0000-0000-000000000000'
    }),
  'termination-count': f =>
    editEvidence(f, 'termination.json', saved => {
      saved.provider_attempts = 2
    }),
  'packet-hash': f =>
    editEvidence(f, 'packet.json', saved => {
      saved.packet_sha256 = 'f'.repeat(64)
    }),
  'request-binding': f =>
    editEvidence(f, 'positive-2-1.dispatch.json', saved => {
      record(saved.request).input_sha256 = 'f'.repeat(64)
    }),
  'result-hash': f =>
    editEvidence(f, RESULT, saved => {
      saved.result_sha256 = 'f'.repeat(64)
    }),
}

Deno.test(
  'changed ledger refuses an earlier calculation without releasing the original reserve',
  async () => {
    const f = await fixture()
    try {
      const calculation = await prepareTerminalReconciliation(f.options())
      const calculationPath = `${f.root}/calculation.json`
      await writeOnce(calculationPath, calculation)
      const other = await readJson(f.allocationPath)
      const authority = {
        ...record(other.authority),
        id: 'AUTH-OTHER-REVIEW-MOCK',
      }
      other.authority = authority
      other.authority_receipt = JSON.stringify(authority)
      other.authority_sha256 = await sha256(String(other.authority_receipt))
      other.allocation_id = authority.id
      other.run_id = crypto.randomUUID()
      other.run_directory = `${f.root}/other-interrupted-run`
      await writeOnce(
        `${f.budgetDirectory}/${authority.id}.allocation.json`,
        other
      )
      await assert.rejects(
        applyTerminalReconciliation({
          ...f.options(),
          calculationPath,
          calculationSha256: await f.hashFile(calculationPath),
        }),
        /terminal-day-accounting-conflict/
      )
      await assert.rejects(
        Deno.stat(`${f.budgetDirectory}/${ID}.settlement.json`),
        Deno.errors.NotFound
      )
      assert.equal(await allocatedCharge(f.budgetDirectory, DAY), 26880000000)
    } finally {
      await f.cleanup()
    }
  }
)
const resultMutations: Record<
  string,
  (result: Record<string, unknown>) => void
> = {
  'raw-result': result => {
    record(result.content).decision = 'different-meaning'
  },
  'model-version': result => {
    record(result.provider_response).modelVersion = 'gemini-3.8-flash'
  },
  'usage-components': result => {
    record(record(result.provider_response).usageMetadata).thoughtsTokenCount =
      0
  },
}
for (const [name, mutate] of Object.entries(resultMutations))
  mutations[name] = f =>
    editEvidence(f, RESULT, async saved => {
      mutate(record(saved.result))
      saved.result_sha256 = await sha256(canonicalizeJson(saved.result))
    })
for (const [name, mutate] of Object.entries(mutations))
  Deno.test(
    `terminal accounting refuses ${name} even with repinned fixture evidence`,
    async () => {
      const f = await fixture()
      try {
        await mutate(f)
        await assert.rejects(f.verify())
        assert.equal(await allocatedCharge(f.budgetDirectory, DAY), 13440000000)
      } finally {
        await f.cleanup()
      }
    }
  )

Deno.test(
  'terminal preparation and apply refuse lock, changed reviewed bytes, or changed calculation',
  async () => {
    const f = await fixture()
    try {
      await Deno.writeTextFile(`${f.budgetDirectory}/budget.lock`, '')
      await assert.rejects(
        prepareTerminalReconciliation(f.options()),
        Deno.errors.AlreadyExists
      )
      await Deno.remove(`${f.budgetDirectory}/budget.lock`)
      const calculation = await prepareTerminalReconciliation(f.options()),
        calculationPath = `${f.root}/calc.json`
      await writeOnce(calculationPath, {
        ...calculation,
        after_committed_nanousd: 0,
      })
      await assert.rejects(
        applyTerminalReconciliation({
          ...f.options(),
          calculationPath,
          calculationSha256: await f.hashFile(calculationPath),
        }),
        /stale-terminal-calculation/
      )
      await Deno.writeTextFile(f.reviewPath, '{}')
      await assert.rejects(f.verify(), /hash-conflict/)
      assert.equal(await allocatedCharge(f.budgetDirectory, DAY), 13440000000)
    } finally {
      await f.cleanup()
    }
  }
)
