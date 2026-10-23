import {
  UNDISPATCHED_SETTLEMENT,
  undispatchedSettlementCharge,
} from './creation-undispatched.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import type { CreationPilotPacket } from './creation-pilot-packet.ts'
import {
  readJson,
  optionalJson,
  localDay,
  equal,
  verifyRunBinding,
} from './creation-pilot-journal.ts'
import { RESERVE_NANOUSD, reportedCharge } from './creation-pilot-usage.ts'
import { completedRunCharge } from './creation-completed-accounting.ts'
import {
  TERMINAL_SETTLEMENT,
  terminalSettlementCharge,
} from './creation-terminal-evidence.ts'
export {
  RESERVE_NANOUSD,
  DAY_LIMIT_NANOUSD,
  reportedCharge,
} from './creation-pilot-usage.ts'

const DISPATCH_SUFFIX = '.dispatch.json'
const ALLOCATION_SUFFIX = '.allocation.json'
const INVALID_ALLOCATION = 'invalid-day-allocation'

export async function historicalCharge(
  current: CreationPilotPacket,
  day: string
) {
  const paths = current.packet.historical_receipts_sha256
  let committed = 0,
    calls = 0,
    unsettled = 0
  for (const [path, hash] of Object.entries(paths)) {
    if ((await sha256(await Deno.readTextFile(path))) !== hash)
      throw new Error('historical-provider-evidence-changed')
    if (!path.endsWith(DISPATCH_SUFFIX)) continue
    const intent = await readJson(path)
    if (
      typeof intent.dispatched_at !== 'number' ||
      !Number.isFinite(intent.dispatched_at)
    )
      throw new Error('invalid-historical-dispatch')
    if (localDay(intent.dispatched_at) !== day) continue
    calls++
    const resultPath = path.replace(/\.dispatch\.json$/, '.result.json')
    let charge = RESERVE_NANOUSD
    if (Object.hasOwn(paths, resultPath)) {
      const result = record((await readJson(resultPath)).result)
      try {
        charge = reportedCharge(result, 'gemini-3.8-flash')
      } catch {
        unsettled++
      }
    } else unsettled++
    committed += charge
  }
  return { committed_nanousd: committed, calls, unsettled }
}
async function settledCharge(
  allocation: Record<string, unknown>,
  settlement: Record<string, unknown>
) {
  if (
    settlement.packet_sha256 !== allocation.packet_sha256 ||
    settlement.allocation_id !== allocation.allocation_id ||
    settlement.run_id !== allocation.run_id ||
    settlement.authority_sha256 !== allocation.authority_sha256 ||
    !Number.isSafeInteger(settlement.committed_nanousd) ||
    Number(settlement.committed_nanousd) < 0 ||
    Number(settlement.committed_nanousd) > 48 * RESERVE_NANOUSD
  )
    throw new Error('invalid-day-settlement')
  const files = record(settlement.receipts_sha256)
  for (const [name, hash] of Object.entries(files)) {
    if (
      !/^[a-zA-Z0-9.-]+\.json$/.test(name) ||
      (await sha256(
        await Deno.readTextFile(`${allocation.run_directory}/${name}`)
      )) !== hash
    )
      throw new Error('settled-provider-evidence-changed')
  }
  if (typeof allocation.run_directory !== 'string')
    throw new Error(INVALID_ALLOCATION)
  const charge = await completedRunCharge(allocation, files)
  equal(charge, settlement.committed_nanousd, 'day-settlement-charge-conflict')
  if (
    !Object.hasOwn(files, 'report.json') ||
    !Object.hasOwn(files, 'seal.json')
  )
    throw new Error('unsealed-day-settlement')
  return Number(settlement.committed_nanousd)
}
export async function allocatedCharge(directory: string, day: string) {
  let committed = 0
  for await (const file of Deno.readDir(directory)) {
    if (!file.name.endsWith(ALLOCATION_SUFFIX)) continue
    const allocation = await readJson(`${directory}/${file.name}`)
    const authority = await verifyRunBinding(allocation)
    equal(
      file.name,
      `${authority.id}${ALLOCATION_SUFFIX}`,
      'allocation-identity-conflict'
    )
    equal(allocation.local_day, authority.local_day, 'allocation-day-conflict')
    if (allocation.local_day !== day) continue
    if (
      allocation.reserved_nanousd !== 48 * RESERVE_NANOUSD ||
      typeof allocation.run_directory !== 'string' ||
      typeof allocation.packet_sha256 !== 'string'
    )
      throw new Error(INVALID_ALLOCATION)
    const settlement = await optionalJson(
      `${directory}/${file.name.replace(ALLOCATION_SUFFIX, '.settlement.json')}`
    )
    if (!settlement) committed += 48 * RESERVE_NANOUSD
    else if (settlement.kind === UNDISPATCHED_SETTLEMENT)
      committed += await undispatchedSettlementCharge(
        `${directory}/${file.name}`,
        settlement
      )
    else if (settlement.kind === TERMINAL_SETTLEMENT)
      committed += await terminalSettlementCharge(
        `${directory}/${file.name}`,
        settlement
      )
    else committed += await settledCharge(allocation, settlement)
  }
  return committed
}
async function runReceipts(directory: string) {
  const receipts: Deno.DirEntry[] = []
  try {
    for await (const receipt of Deno.readDir(directory)) receipts.push(receipt)
  } catch (error) {
    // A claim may survive interruption before its run directory is created.
    if (!(error instanceof Deno.errors.NotFound)) throw error
  }
  return receipts
}
async function allocatedDispatchTimes(directory: string) {
  const times: unknown[] = []
  for await (const file of Deno.readDir(directory)) {
    if (!file.name.endsWith(ALLOCATION_SUFFIX)) continue
    const allocation = await readJson(`${directory}/${file.name}`)
    if (typeof allocation.run_directory !== 'string')
      throw new Error(INVALID_ALLOCATION)
    for (const receipt of await runReceipts(allocation.run_directory)) {
      if (!receipt.name.endsWith(DISPATCH_SUFFIX)) continue
      times.push(
        (await readJson(`${allocation.run_directory}/${receipt.name}`))
          .dispatched_at
      )
    }
  }
  return times
}
export async function priorDispatchTimes(
  current: CreationPilotPacket,
  directory: string,
  at: number
) {
  const times: number[] = []
  const accept = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error('invalid-prior-dispatch-time')
    if (at - value >= 0 && at - value < 61000) times.push(value)
  }
  for (const path of Object.keys(current.packet.historical_receipts_sha256))
    if (path.endsWith(DISPATCH_SUFFIX))
      accept((await readJson(path)).dispatched_at)
  for (const timestamp of await allocatedDispatchTimes(directory))
    accept(timestamp)
  return times
}
