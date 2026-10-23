import { basename, resolve } from 'node:path'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  equal,
  verifyRunBinding,
  checkDeadline,
} from './creation-pilot-journal.ts'
import { RESERVE_NANOUSD } from './creation-pilot-usage.ts'
import {
  pinnedJson,
  pinnedText,
  terminalReview,
  frozenJournal,
  verifyTerminalAccounting,
  UNDISPATCHED_REVIEW,
  type TerminalReviewReference,
} from './creation-terminal-evidence.ts'

export const UNDISPATCHED_SETTLEMENT = 'reviewed-undispatched-reservation-v1'
const INVALID = 'invalid-undispatched-evidence'

// Deliberately narrow: one stopped first-judge unknown, zero returned, no redispatch.
export async function verifyReviewedAccounting(
  allocationPath: string,
  ref: TerminalReviewReference
) {
  const review = await terminalReview(ref)
  if (review.kind !== UNDISPATCHED_REVIEW)
    return verifyTerminalAccounting(allocationPath, ref)
  const allocation = await pinnedJson(allocationPath, review.allocation_sha256)
  const authority = await verifyRunBinding(allocation)
  equal(basename(allocationPath), `${authority.id}.allocation.json`, INVALID)
  equal(authority.id, review.authority_id, INVALID)
  equal(allocation.run_id, review.run_id, INVALID)
  equal(allocation.local_day, authority.local_day, INVALID)
  equal(allocation.reserved_nanousd, 48 * RESERVE_NANOUSD, INVALID)
  const directory = String(allocation.run_directory)
  equal(directory, resolve(directory), INVALID)
  const { records, hashes } = await frozenJournal(directory, review)
  const run = records['run.json'],
    saved = records['packet.json']
  if (!run || !saved) throw new Error(INVALID)
  await verifyRunBinding(run)
  for (const key of Object.keys(run)) equal(run[key], allocation[key], INVALID)
  const packet = record(saved.packet)
  equal(saved.packet_sha256, await sha256(canonicalizeJson(packet)), INVALID)
  equal(saved.packet_sha256, allocation.packet_sha256, INVALID)
  equal(saved.packet_sha256, review.packet_sha256, INVALID)
  equal(packet.source_sha256, review.frozen_runner_sources_sha256, INVALID)
  if (!Array.isArray(packet.requests) || packet.requests.length !== 44)
    throw new Error(INVALID)
  const row = record(packet.requests[0]),
    request = record(row.request)
  if (row.phase !== 'judgement' || !/^[a-zA-Z0-9-]+$/.test(String(row.id)))
    throw new Error(INVALID)
  const id = String(row.id)
  equal(
    Object.keys(records).sort(),
    [
      'packet.json',
      'run.json',
      'termination.json',
      `${id}.dispatch.json`,
      `${id}.failure.json`,
    ].sort(),
    INVALID
  )
  const dispatch = records[`${id}.dispatch.json`]
  const expiry = record(packet.limits).packet_valid_until
  if (
    typeof expiry !== 'string' ||
    !Number.isFinite(Date.parse(expiry)) ||
    typeof dispatch.dispatched_at !== 'number' ||
    dispatch.dispatched_at < Number(allocation.allocated_at)
  )
    throw new Error(INVALID)
  checkDeadline(authority, expiry, Number(allocation.allocated_at))
  checkDeadline(authority, expiry, dispatch.dispatched_at)
  equal(
    dispatch,
    {
      packet_sha256: saved.packet_sha256,
      row_id: id,
      phase: 'judgement',
      request,
      dispatched_at: dispatch.dispatched_at,
      reserved_nanousd: RESERVE_NANOUSD,
    },
    INVALID
  )
  if (
    typeof request.body !== 'string' ||
    new TextEncoder().encode(request.body).length > 32768
  )
    throw new Error(INVALID)
  equal(request.model, record(packet.profile).judgement_model, INVALID)
  equal(
    request.input_sha256,
    await sha256(
      canonicalizeJson({
        provider: 'gemini',
        model: request.model,
        body: request.body,
      })
    ),
    INVALID
  )
  equal(
    records[`${id}.failure.json`],
    { kind: 'provider-outcome-unknown', evidence_sha256: null },
    INVALID
  )
  equal(
    records['termination.json'],
    {
      state: 'stopped-review-required',
      automatic_retries: 0,
      full_allocation_retained: true,
      provider_attempts: 1,
      packet_sha256: saved.packet_sha256,
    },
    INVALID
  )
  const launchRef = record(review.launch_source)
  equal(launchRef.path, resolve(directory, '../launch.ts'), INVALID)
  await pinnedText(String(launchRef.path), launchRef.sha256)
  const exitRef = record(review.runner_exit)
  equal(exitRef.path, resolve(directory, '../runner-exit.json'), INVALID)
  const exit = await pinnedJson(String(exitRef.path), exitRef.sha256)
  if (
    exit.exit_code !== 1 ||
    exit.stopped_review_required !== true ||
    typeof exit.finished_at !== 'string' ||
    !Number.isFinite(Date.parse(exit.finished_at)) ||
    Date.parse(exit.finished_at) < dispatch.dispatched_at
  )
    throw new Error(INVALID)
  equal(review.never_dispatched_capacity, 47, INVALID)
  equal(
    review.current_retained_allocation_nanousd,
    48 * RESERVE_NANOUSD,
    INVALID
  )
  equal(
    review.per_dispatch_worst_case_reserve_nanousd,
    RESERVE_NANOUSD,
    INVALID
  )
  equal(review.required_unknown_liability_nanousd, RESERVE_NANOUSD, INVALID)
  equal(
    review.eligible_undispatched_release_nanousd,
    47 * RESERVE_NANOUSD,
    INVALID
  )
  equal(review.original_outcome_must_remain_unknown, true, INVALID)
  equal(review.new_actual_cost_nanousd, null, INVALID)
  return {
    kind: UNDISPATCHED_SETTLEMENT,
    review_path: resolve(ref.review_path),
    review_sha256: ref.review_sha256,
    packet_sha256: saved.packet_sha256,
    allocation_id: authority.id,
    run_id: allocation.run_id,
    authority_sha256: allocation.authority_sha256,
    allocation_sha256: review.allocation_sha256,
    local_day: authority.local_day,
    committed_nanousd: RESERVE_NANOUSD,
    released_nanousd: 47 * RESERVE_NANOUSD,
    receipts_sha256: hashes,
    provider_attempts: 1,
    known_reported_charge_nanousd: 0,
    unknown_liability_nanousd: RESERVE_NANOUSD,
    actual_charge_nanousd: null,
    complete: false,
    qualified: false,
    authority_replenished: false,
    invoice_verified: false,
  }
}
export async function undispatchedSettlementCharge(
  allocationPath: string,
  settlement: Record<string, unknown>
) {
  if (
    typeof settlement.review_path !== 'string' ||
    typeof settlement.review_sha256 !== 'string'
  )
    throw new Error(INVALID)
  const verified = await verifyReviewedAccounting(allocationPath, {
    review_path: settlement.review_path,
    review_sha256: settlement.review_sha256,
  })
  equal(verified.kind, UNDISPATCHED_SETTLEMENT, INVALID)
  equal(settlement, verified, INVALID)
  return verified.committed_nanousd
}
