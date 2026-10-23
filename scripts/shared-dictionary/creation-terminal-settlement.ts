import { verifyReviewedAccounting } from './creation-undispatched.ts'
import { resolve } from 'node:path'
import { allocatedCharge, historicalCharge } from './creation-pilot-budget.ts'
import { verifyCreationPilotPacket } from './creation-pilot-packet.ts'
import { equal, optionalJson, writeOnce } from './creation-pilot-journal.ts'
import { DAY_LIMIT_NANOUSD, RESERVE_NANOUSD } from './creation-pilot-usage.ts'
import {
  pinnedJson,
  terminalReview,
  type TerminalReviewReference,
} from './creation-terminal-evidence.ts'

interface Location {
  packetPath: string
  budgetDirectory: string
}
export interface TerminalCalculationOptions extends Location {
  reviewPath: string
  reviewSha256: string
}
async function withBudgetLock<T>(directory: string, work: () => Promise<T>) {
  const lock = await Deno.open(`${directory}/budget.lock`, {
    write: true,
    createNew: true,
    mode: 0o600,
  })
  try {
    return await work()
  } finally {
    lock.close()
    await Deno.remove(`${directory}/budget.lock`)
  }
}
async function calculate(options: Location, ref: TerminalReviewReference) {
  const directory = resolve(options.budgetDirectory),
    review = await terminalReview(ref)
  const allocationPath = `${directory}/${review.authority_id}.allocation.json`
  if (await optionalJson(`${directory}/${review.authority_id}.settlement.json`))
    throw new Error('terminal-allocation-already-settled')
  const settlement = await verifyReviewedAccounting(allocationPath, ref)
  const current = await verifyCreationPilotPacket(options.packetPath)
  const reviewedPaths = new Set(
    Object.keys(review.run_journal_sha256 as object).map(path => resolve(path))
  )
  for (const path of Object.keys(current.packet.historical_receipts_sha256))
    if (reviewedPaths.has(resolve(path)))
      throw new Error('terminal-history-double-count')
  const history = await historicalCharge(current, settlement.local_day)
  const allocated = await allocatedCharge(directory, settlement.local_day)
  if (allocated < 48 * RESERVE_NANOUSD)
    throw new Error('terminal-reservation-missing')
  const before = history.committed_nanousd + allocated
  const after = before - settlement.released_nanousd
  if (after < 0 || before > DAY_LIMIT_NANOUSD)
    throw new Error('terminal-day-accounting-conflict')
  return {
    schema_version: 1,
    kind: 'reviewed-terminal-calculation-v1',
    current_packet_sha256: current.packet_sha256,
    budget_directory: directory,
    settlement,
    historical: history,
    other_allocated_nanousd: allocated - 48 * RESERVE_NANOUSD,
    before_committed_nanousd: before,
    after_committed_nanousd: after,
    before_remaining_nanousd: DAY_LIMIT_NANOUSD - before,
    after_remaining_nanousd: DAY_LIMIT_NANOUSD - after,
    ledger_changed: false,
    requires_code_and_packet_review_before_application: true,
  }
}
// Calculation is offline and does not write a settlement or renew provider authority.
export function prepareTerminalReconciliation(
  options: TerminalCalculationOptions
) {
  return withBudgetLock(resolve(options.budgetDirectory), () =>
    calculate(options, {
      review_path: options.reviewPath,
      review_sha256: options.reviewSha256,
    })
  )
}
export async function applyTerminalReconciliation(
  options: Location & { calculationPath: string; calculationSha256: string }
) {
  return await withBudgetLock(resolve(options.budgetDirectory), async () => {
    const saved = await pinnedJson(
      options.calculationPath,
      options.calculationSha256
    )
    const settlement = saved.settlement as Record<string, unknown>
    if (
      !settlement ||
      typeof settlement.review_path !== 'string' ||
      typeof settlement.review_sha256 !== 'string'
    )
      throw new Error('invalid-terminal-calculation')
    const current = await calculate(options, {
      review_path: settlement.review_path,
      review_sha256: settlement.review_sha256,
    })
    equal(saved, current, 'stale-terminal-calculation')
    await writeOnce(
      `${current.budget_directory}/${current.settlement.allocation_id}.settlement.json`,
      current.settlement
    )
    return current.settlement
  })
}
