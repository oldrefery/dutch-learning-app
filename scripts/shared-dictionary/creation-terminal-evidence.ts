import { basename, resolve } from 'node:path'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { journalPacket } from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  checkDeadline,
  equal,
  verifyRunBinding,
} from './creation-pilot-journal.ts'
import { reportedCharge, RESERVE_NANOUSD } from './creation-pilot-usage.ts'

export const TERMINAL_SETTLEMENT = 'reviewed-terminated-run-v1'
const INVALID = 'invalid-terminal-accounting-evidence'
export const UNDISPATCHED_REVIEW =
  'technical-review-of-undispatched-reservation-release'
export interface TerminalReviewReference {
  review_path: string
  review_sha256: string
}

export async function pinnedText(path: string, hash: unknown) {
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash))
    throw new Error(INVALID)
  if (!(await Deno.lstat(path)).isFile) throw new Error(INVALID)
  const text = await Deno.readTextFile(path)
  equal(await sha256(text), hash, 'terminal-evidence-hash-conflict')
  return text
}
export async function pinnedJson(path: string, hash: unknown) {
  return record(JSON.parse(await pinnedText(path, hash)))
}

export async function terminalReview(ref: TerminalReviewReference) {
  const review = await pinnedJson(ref.review_path, ref.review_sha256)
  if (
    ![
      'technical-review-of-terminated-run-accounting',
      UNDISPATCHED_REVIEW,
    ].includes(String(review.kind)) ||
    !/^[A-Z0-9-]{1,80}$/.test(String(review.authority_id)) ||
    !Number.isSafeInteger(review.dispatches) ||
    Number(review.dispatches) < 1 ||
    Number(review.dispatches) > 40 ||
    (review.kind === UNDISPATCHED_REVIEW
      ? review.dispatches !== 1 || review.returned !== 0 || review.unknown !== 1
      : review.returned !== review.dispatches || review.unknown !== 0)
  )
    throw new Error(INVALID)
  return review
}

export async function frozenJournal(
  directory: string,
  review: Record<string, unknown>
) {
  const hashes: Record<string, string> = {}
  const records: Record<string, Record<string, unknown>> = {}
  for (const [path, hash] of Object.entries(
    record(review.run_journal_sha256)
  )) {
    const name = basename(path)
    if (
      !/^[a-zA-Z0-9.-]+\.json$/.test(name) ||
      resolve(path) !== resolve(directory, name) ||
      Object.hasOwn(hashes, name)
    )
      throw new Error(INVALID)
    records[name] = await pinnedJson(path, hash)
    hashes[name] = String(hash)
  }
  const actual = []
  for await (const entry of Deno.readDir(directory)) {
    if (!entry.isFile) throw new Error(INVALID)
    actual.push(entry.name)
  }
  equal(
    actual.sort(),
    Object.keys(hashes).sort(),
    'terminal-journal-inventory-conflict'
  )
  return { records, hashes }
}

function returnedCharge(response: Record<string, unknown>, version: string) {
  const result = record(response.result),
    provider = record(result.provider_response)
  equal(
    journalPacket(canonicalizeJson(provider)),
    result,
    'terminal-raw-reparse-conflict'
  )
  if (
    typeof response.request_id !== 'string' ||
    !response.request_id ||
    response.request_id !== provider.responseId
  )
    throw new Error(INVALID)
  const usage = record(provider.usageMetadata)
  for (const field of [
    'promptTokenCount',
    'candidatesTokenCount',
    'thoughtsTokenCount',
    'totalTokenCount',
  ])
    if (
      !Number.isSafeInteger(
        usage[field] ?? (field === 'thoughtsTokenCount' ? 0 : undefined)
      ) ||
      Number(usage[field] ?? 0) < 0
    )
      throw new Error(INVALID)
  equal(
    Number(usage.promptTokenCount) +
      Number(usage.candidatesTokenCount) +
      Number(usage.thoughtsTokenCount ?? 0),
    usage.totalTokenCount,
    'terminal-token-components-conflict'
  )
  return reportedCharge(result, version)
}

// Only a reviewed stopped prefix of fixed judges is supported. Generation, unknown
// outcomes and arbitrary interrupted runs retain their full allocations.
export async function verifyTerminalAccounting(
  allocationPath: string,
  ref: TerminalReviewReference
) {
  const review = await terminalReview(ref)
  if (review.kind === UNDISPATCHED_REVIEW) throw new Error(INVALID)
  const allocation = await pinnedJson(allocationPath, review.allocation_sha256)
  const authority = await verifyRunBinding(allocation)
  equal(
    basename(allocationPath),
    `${authority.id}.allocation.json`,
    'terminal-allocation-identity-conflict'
  )
  equal(authority.id, review.authority_id, 'terminal-review-authority-conflict')
  equal(
    allocation.local_day,
    authority.local_day,
    'terminal-allocation-day-conflict'
  )
  equal(allocation.reserved_nanousd, 48 * RESERVE_NANOUSD, INVALID)
  const directory = String(allocation.run_directory)
  equal(directory, resolve(directory), INVALID)
  const { records, hashes } = await frozenJournal(directory, review)
  const run = records['run.json'],
    saved = records['packet.json']
  if (!run || !saved) throw new Error(INVALID)
  await verifyRunBinding(run)
  for (const key of Object.keys(run))
    equal(run[key], allocation[key], 'terminal-run-binding-conflict')
  const packet = record(saved.packet),
    profile = record(packet.profile)
  equal(
    saved.packet_sha256,
    await sha256(canonicalizeJson(packet)),
    'terminal-packet-hash-conflict'
  )
  equal(
    saved.packet_sha256,
    allocation.packet_sha256,
    'terminal-allocation-packet-conflict'
  )
  equal(
    saved.packet_sha256,
    review.packet_sha256,
    'terminal-review-packet-conflict'
  )
  if (
    !Array.isArray(packet.requests) ||
    typeof profile.judgement_model_version !== 'string'
  )
    throw new Error(INVALID)
  const expiry = record(packet.limits).packet_valid_until
  if (typeof expiry !== 'string' || !Number.isFinite(Date.parse(expiry)))
    throw new Error(INVALID)
  checkDeadline(authority, expiry, Number(allocation.allocated_at))
  equal(
    records['termination.json'],
    {
      state: 'stopped-review-required',
      automatic_retries: 0,
      full_allocation_retained: true,
      provider_attempts: review.dispatches,
      packet_sha256: saved.packet_sha256,
    },
    'terminal-termination-conflict'
  )
  const expected = ['packet.json', 'run.json', 'termination.json']
  let committed = 0,
    previous = Number(allocation.allocated_at)
  for (const value of packet.requests.slice(0, Number(review.dispatches))) {
    const row = record(value),
      request = record(row.request),
      id = String(row.id)
    if (
      row.phase !== 'judgement' ||
      !/^[a-zA-Z0-9-]+$/.test(id) ||
      expected.includes(`${id}.dispatch.json`)
    )
      throw new Error(INVALID)
    const dispatch = records[`${id}.dispatch.json`],
      response = records[`${id}.result.json`]
    if (
      !dispatch ||
      !response ||
      typeof dispatch.dispatched_at !== 'number' ||
      dispatch.dispatched_at < previous
    )
      throw new Error(INVALID)
    previous = dispatch.dispatched_at
    checkDeadline(authority, expiry, previous)
    equal(
      dispatch,
      {
        packet_sha256: saved.packet_sha256,
        row_id: id,
        phase: row.phase,
        request,
        dispatched_at: previous,
        reserved_nanousd: RESERVE_NANOUSD,
      },
      'terminal-dispatch-conflict'
    )
    equal(
      request.model,
      profile.judgement_model,
      'terminal-request-model-conflict'
    )
    if (
      typeof request.body !== 'string' ||
      new TextEncoder().encode(request.body).length > 32768
    )
      throw new Error(INVALID)
    equal(
      request.input_sha256,
      await sha256(
        canonicalizeJson({
          provider: 'gemini',
          model: request.model,
          body: request.body,
        })
      ),
      'terminal-request-hash-conflict'
    )
    equal(
      response.result_sha256,
      await sha256(canonicalizeJson(response.result)),
      'terminal-result-hash-conflict'
    )
    committed += returnedCharge(response, profile.judgement_model_version)
    expected.push(`${id}.dispatch.json`, `${id}.result.json`)
  }
  equal(expected.length, 3 + 2 * Number(review.dispatches), INVALID)
  equal(
    Object.keys(records).sort(),
    expected.sort(),
    'terminal-unexpected-outcome'
  )
  equal(
    committed,
    review.new_reported_charge_nanousd,
    'terminal-reviewed-charge-conflict'
  )
  equal(
    review.current_retained_allocation_nanousd,
    allocation.reserved_nanousd,
    INVALID
  )
  const released = Number(allocation.reserved_nanousd) - committed
  equal(
    released,
    review.eligible_release_after_validated_terminal_settlement_nanousd,
    'terminal-reviewed-release-conflict'
  )
  return {
    kind: TERMINAL_SETTLEMENT,
    review_path: resolve(ref.review_path),
    review_sha256: ref.review_sha256,
    packet_sha256: saved.packet_sha256,
    allocation_id: authority.id,
    run_id: allocation.run_id,
    authority_sha256: allocation.authority_sha256,
    allocation_sha256: review.allocation_sha256,
    local_day: authority.local_day,
    committed_nanousd: committed,
    released_nanousd: released,
    receipts_sha256: hashes,
    provider_attempts: review.dispatches,
    complete: false,
    qualified: false,
    authority_replenished: false,
    invoice_verified: false,
  }
}

export async function terminalSettlementCharge(
  allocationPath: string,
  settlement: Record<string, unknown>
) {
  if (
    typeof settlement.review_path !== 'string' ||
    typeof settlement.review_sha256 !== 'string'
  )
    throw new Error(INVALID)
  const verified = await verifyTerminalAccounting(allocationPath, {
    review_path: settlement.review_path,
    review_sha256: settlement.review_sha256,
  })
  equal(settlement, verified, 'terminal-settlement-conflict')
  return verified.committed_nanousd
}
