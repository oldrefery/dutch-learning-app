import { resolve } from 'node:path'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { sha256 } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  journalPacket,
  type GeminiTransport,
} from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import {
  creationJudgeRequest,
  scoreCreationJudge,
  type CreationQualificationRequest,
} from './creation-qualification.ts'
import { verifyCreationPilotPacket } from './creation-pilot-packet.ts'
import {
  RESERVE_NANOUSD,
  DAY_LIMIT_NANOUSD,
  historicalCharge,
  allocatedCharge,
  reportedCharge,
  priorDispatchTimes,
} from './creation-pilot-budget.ts'
import {
  writeOnce,
  digestFiles,
  equal,
  parseAuthority,
  checkDeadline,
} from './creation-pilot-journal.ts'
import { replayCreationPilot } from './creation-pilot-replay.ts'

export interface CreationPilotOptions {
  packetPath: string
  output: string
  authorityPath: string
  budgetDirectory: string
  preflightConnectivity: () => Promise<void>
  transportFactory: () => GeminiTransport
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}
// New run only. Interrupted allocations stay reserved; offline replay never dispatches.
export async function runCreationPilot(options: CreationPilotOptions) {
  const now = options.now ?? Date.now,
    sleep =
      options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const current = await verifyCreationPilotPacket(options.packetPath),
    p = current.packet
  const authorityText = await Deno.readTextFile(options.authorityPath)
  const authority = parseAuthority(
    JSON.parse(authorityText),
    current.packet_sha256
  )
  const deadline = () =>
    checkDeadline(authority, p.limits.packet_valid_until, now())
  deadline()
  const directory = resolve(options.output),
    budgetDirectory = resolve(options.budgetDirectory)
  await Deno.mkdir(budgetDirectory, { recursive: true, mode: 0o700 })
  const lock = await Deno.open(`${budgetDirectory}/budget.lock`, {
    write: true,
    createNew: true,
    mode: 0o600,
  })
  try {
    // The authority identity is global to the shared ledger, independent of day/run.
    const allocationId = authority.id
    const allocationPath = `${budgetDirectory}/${allocationId}.allocation.json`
    try {
      await Deno.lstat(allocationPath)
      throw new Error('creation-pilot-authority-already-consumed')
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
    }
    const historical = await historicalCharge(current, authority.local_day)
    const allocated = await allocatedCharge(
      budgetDirectory,
      authority.local_day
    )
    if (
      historical.committed_nanousd + allocated + 48 * RESERVE_NANOUSD >
      DAY_LIMIT_NANOUSD
    )
      throw new Error('aggregate-day-budget-exhausted')
    await options.preflightConnectivity()
    await verifyCreationPilotPacket(options.packetPath)
    equal(
      await Deno.readTextFile(options.authorityPath),
      authorityText,
      'authority-receipt-changed'
    )
    deadline()
    const binding = {
      packet_sha256: current.packet_sha256,
      authority,
      authority_receipt: authorityText,
      authority_sha256: await sha256(authorityText),
      allocated_at: now(),
      allocation_id: allocationId,
      run_id: crypto.randomUUID(),
      run_directory: directory,
    }
    // One exclusive, synced write consumes permission and reserves dollars together.
    // Any interruption here leaves a consumed claim; never recreate or redispatch it.
    await writeOnce(allocationPath, {
      ...binding,
      local_day: authority.local_day,
      reserved_nanousd: 48 * RESERVE_NANOUSD,
      historical_committed_nanousd: historical.committed_nanousd,
      other_allocated_nanousd: allocated,
    })
    await Deno.mkdir(directory, { mode: 0o700 })
    await writeOnce(`${directory}/packet.json`, current)
    await writeOnce(`${directory}/run.json`, binding)
    // Allocation is durable before credentials, transport construction or dispatch.
    const rateTimes = await priorDispatchTimes(current, budgetDirectory, now())
    const transport = options.transportFactory(),
      times: number[] = [],
      files = ['packet.json', 'run.json']
    const invoke = async (row: CreationQualificationRequest) => {
      if (
        times.length >= 48 ||
        new TextEncoder().encode(row.request.body).length > 32768
      )
        throw new Error('creation-pilot-request-limit')
      const recent = rateTimes.filter(at => now() - at < 61000)
      if (recent.length >= 10)
        await sleep(Math.max(0, 61000 - (now() - recent[0])))
      deadline()
      equal(
        await Deno.readTextFile(options.authorityPath),
        authorityText,
        'authority-receipt-changed'
      )
      await verifyCreationPilotPacket(options.packetPath)
      const at = now()
      deadline()
      await writeOnce(`${directory}/${row.id}.dispatch.json`, {
        packet_sha256: current.packet_sha256,
        row_id: row.id,
        phase: row.phase,
        request: row.request,
        dispatched_at: at,
        reserved_nanousd: RESERVE_NANOUSD,
      })
      times.push(at)
      rateTimes.push(at)
      files.push(`${row.id}.dispatch.json`)
      let outcome
      try {
        outcome = await transport.invoke(row.request, row.id)
      } catch {
        outcome = {
          kind: 'provider-outcome-unknown' as const,
          evidence_sha256: null,
        }
      }
      if (outcome.kind !== 'returned') {
        await writeOnce(`${directory}/${row.id}.failure.json`, outcome)
        throw new Error('provider-failure-or-unknown-no-retry')
      }
      const result = outcome.result
      await writeOnce(`${directory}/${row.id}.result.json`, {
        result,
        request_id: outcome.requestId,
        result_sha256: await sha256(canonicalizeJson(result)),
      })
      files.push(`${row.id}.result.json`)
      // Raw envelope is durable before any version, usage, schema or semantic check.
      equal(
        journalPacket(canonicalizeJson(result.provider_response)),
        result,
        'raw-provider-reparse-conflict'
      )
      reportedCharge(
        result,
        row.phase === 'generation'
          ? p.profile.generation_model_version
          : p.profile.judgement_model_version
      )
      if (
        row.phase === 'judgement' &&
        scoreCreationJudge(row, result, p.profile).decision === 'invalid'
      )
        throw new Error('invalid-creation-judge-verdict')
      return result
    }
    try {
      for (const row of p.requests) {
        const result = await invoke(row)
        if (row.phase === 'generation') {
          const judge = await creationJudgeRequest(row, result, p.profile)
          if (!judge) throw new Error('generated-creation-candidate-rejected')
          await invoke(judge)
        }
      }
      const report = await replayCreationPilot(directory, false)
      if (!report.complete) throw new Error('incomplete-creation-pilot')
      await writeOnce(`${directory}/seal.json`, {
        packet_sha256: current.packet_sha256,
        receipts_sha256: await digestFiles(directory, files),
      })
      await writeOnce(`${directory}/report.json`, report)
      const replay = await replayCreationPilot(directory)
      equal(replay, report, 'final-creation-replay-conflict')
      await writeOnce(`${budgetDirectory}/${allocationId}.settlement.json`, {
        packet_sha256: current.packet_sha256,
        allocation_id: allocationId,
        run_id: binding.run_id,
        authority_sha256: binding.authority_sha256,
        committed_nanousd: report.committed_nanousd,
        receipts_sha256: await digestFiles(directory, [
          ...files,
          'seal.json',
          'report.json',
        ]),
        invoice_verified: false,
      })
      return report
    } catch (error) {
      await writeOnce(`${directory}/termination.json`, {
        state: 'stopped-review-required',
        automatic_retries: 0,
        full_allocation_retained: true,
        provider_attempts: times.length,
        packet_sha256: current.packet_sha256,
      })
      throw error
    }
  } finally {
    lock.close()
    await Deno.remove(`${budgetDirectory}/budget.lock`)
  }
}
