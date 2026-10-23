import assert from 'node:assert/strict'
import { checkCreationConnectivity } from './creation-connectivity.ts'
import {
  prepareTerminalReconciliation,
  applyTerminalReconciliation,
} from './creation-terminal-settlement.ts'
import { verifyReviewedAccounting } from './creation-undispatched.ts'
import { creationPilotPacket } from './creation-pilot-packet.ts'
import { allocatedCharge } from './creation-pilot-budget.ts'
import { readJson, writeOnce } from './creation-pilot-journal.ts'
import { sha256 } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
const DAY = '2026-10-11'
const ID = 'AUTH-33-CREATION-02'
const BASE =
  'reports/shared-dictionary-cefr/d13a7-creation-reviewed-pilot-20261011'
async function fixture() {
  const root = await Deno.makeTempDir({ prefix: 'undispatched-' }),
    run = `${root}/run`,
    budgetDirectory = `${root}/budget`
  await Deno.mkdir(run)
  await Deno.mkdir(budgetDirectory)
  for await (const f of Deno.readDir(`${BASE}/live-run`))
    await Deno.copyFile(`${BASE}/live-run/${f.name}`, `${run}/${f.name}`)
  await Deno.copyFile(`${BASE}/runner-exit.json`, `${root}/runner-exit.json`)
  const allocation = await readJson(
    `reports/shared-dictionary-cefr/creation-pilot-day-budget/${ID}.allocation.json`
  )
  allocation.run_directory = run
  const allocationPath = `${budgetDirectory}/${ID}.allocation.json`
  await writeOnce(allocationPath, allocation)
  const binding = await readJson(`${run}/run.json`)
  binding.run_directory = run
  await Deno.writeTextFile(`${run}/run.json`, JSON.stringify(binding))
  const review = await readJson(
    'reports/shared-dictionary-cefr/d13a7-creation-unknown-review-20261011/undispatched-accounting-review.json'
  )
  await Deno.copyFile(`${BASE}/launch.ts`, `${root}/launch.ts`)
  const reviewPath = `${root}/review.json`,
    packetPath = `${root}/packet.json`
  await writeOnce(packetPath, await creationPilotPacket())
  const hash = async (path: string) =>
    await sha256(await Deno.readTextFile(path))
  const pin = async () => {
    review.allocation_sha256 = await hash(allocationPath)
    const hashes: Record<string, string> = {}
    for await (const f of Deno.readDir(run))
      hashes[`${run}/${f.name}`] = await hash(`${run}/${f.name}`)
    review.run_journal_sha256 = hashes
    review.launch_source = {
      path: `${root}/launch.ts`,
      sha256: await hash(`${root}/launch.ts`),
    }
    review.runner_exit = {
      path: `${root}/runner-exit.json`,
      sha256: await hash(`${root}/runner-exit.json`),
    }
    await Deno.writeTextFile(reviewPath, JSON.stringify(review))
    return await hash(reviewPath)
  }
  const options = async () => ({
    packetPath,
    budgetDirectory,
    reviewPath,
    reviewSha256: await pin(),
  })
  return {
    root,
    run,
    allocationPath,
    review,
    options,
    hash,
    cleanup: () => Deno.remove(root, { recursive: true }),
  }
}
Deno.test(
  'reachability probe is unauthenticated GET and rejects DNS, timeout and redirect',
  async () => {
    await checkCreationConnectivity(async (input, init) => {
      assert.equal(input, 'https://generativelanguage.googleapis.com/')
      const options = init as {
        method?: string
        redirect?: string
        headers?: unknown
      }
      assert.equal(options.method, 'GET')
      assert.equal(options.redirect, 'error')
      assert.equal(options.headers, undefined)
      return new Response(null, { status: 404 })
    })
    for (const message of ['dns', 'timeout', 'redirect'])
      await assert.rejects(
        checkCreationConnectivity(() => Promise.reject(new Error(message))),
        /connectivity-preflight-failed/
      )
    await assert.rejects(
      checkCreationConnectivity(() =>
        Promise.resolve(new Response(null, { status: 200 }))
      ),
      /connectivity-preflight-failed/
    )
  }
)
Deno.test(
  'unknown release retains one reserve, applies once and remains evidence-bound',
  async () => {
    const f = await fixture()
    try {
      const opts = await f.options(),
        before = await f.hash(f.allocationPath)
      const calc = await prepareTerminalReconciliation(opts)
      assert.equal(calc.settlement.committed_nanousd, 280000000)
      assert.equal(calc.settlement.released_nanousd, 13160000000)
      assert.equal(
        await allocatedCharge(opts.budgetDirectory, DAY),
        13440000000
      )
      const calculationPath = `${f.root}/calculation.json`
      await writeOnce(calculationPath, calc)
      const apply = {
        ...opts,
        calculationPath,
        calculationSha256: await f.hash(calculationPath),
      }
      const results = await Promise.allSettled([
        applyTerminalReconciliation(apply),
        applyTerminalReconciliation(apply),
      ])
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
      assert.equal(await allocatedCharge(opts.budgetDirectory, DAY), 280000000)
      assert.equal(await f.hash(f.allocationPath), before)
      await assert.rejects(
        applyTerminalReconciliation(apply),
        /already-settled/
      )
      await Deno.writeTextFile(`${f.run}/late.dispatch.json`, '{}')
      await assert.rejects(allocatedCharge(opts.budgetDirectory, DAY))
    } finally {
      await f.cleanup()
    }
  }
)
for (const mutation of [
  'extra',
  'missing',
  'failure',
  'termination',
  'exit',
  'request',
  'source',
  'release',
  'unknown-zero',
])
  Deno.test(`undispatched refuses repinned ${mutation}`, async () => {
    const f = await fixture()
    try {
      if (mutation === 'extra')
        await Deno.writeTextFile(`${f.run}/late.dispatch.json`, '{}')
      if (mutation === 'missing')
        await Deno.remove(`${f.run}/positive-1-1.failure.json`)
      if (mutation === 'failure')
        await Deno.writeTextFile(
          `${f.run}/positive-1-1.failure.json`,
          JSON.stringify({ kind: 'provider-failed', evidence_sha256: 'x' })
        )
      if (mutation === 'termination')
        await Deno.writeTextFile(`${f.run}/termination.json`, '{}')
      if (mutation === 'exit')
        await Deno.writeTextFile(
          `${f.root}/runner-exit.json`,
          JSON.stringify({ exit_code: 0 })
        )
      if (mutation === 'request') {
        const p = `${f.run}/positive-1-1.dispatch.json`,
          d = await readJson(p)
        d.row_id = 'other'
        await Deno.writeTextFile(p, JSON.stringify(d))
      }
      if (mutation === 'source') f.review.frozen_runner_sources_sha256 = {}
      if (mutation === 'release')
        f.review.eligible_undispatched_release_nanousd = 13440000000
      if (mutation === 'unknown-zero')
        f.review.required_unknown_liability_nanousd = 0
      const opts = await f.options()
      await assert.rejects(
        verifyReviewedAccounting(f.allocationPath, {
          review_path: opts.reviewPath,
          review_sha256: opts.reviewSha256,
        })
      )
    } finally {
      await f.cleanup()
    }
  })
