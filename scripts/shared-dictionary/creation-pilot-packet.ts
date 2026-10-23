import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { prepareCreationQualification } from './creation-qualification.ts'

const HISTORY =
  'docs/tasks/shared-dictionary-cefr/evidence/D13A-creation-review-20261011.json'
const SOURCES = [
  'scripts/shared-dictionary/creation-completed-accounting.ts',
  'scripts/shared-dictionary/creation-connectivity.ts',
  'scripts/shared-dictionary/creation-undispatched.ts',
  'scripts/shared-dictionary/creation-undispatched_test.ts',
  'scripts/shared-dictionary/creation-pilot-packet.ts',
  'scripts/shared-dictionary/creation-pilot-journal.ts',
  'scripts/shared-dictionary/creation-pilot-budget.ts',
  'scripts/shared-dictionary/creation-pilot-usage.ts',
  'scripts/shared-dictionary/creation-pilot-runner.ts',
  'scripts/shared-dictionary/creation-pilot-replay.ts',
  'scripts/shared-dictionary/creation-pilot-cli.ts',
  'scripts/shared-dictionary/creation-pilot_test.ts',
  'scripts/shared-dictionary/creation-terminal-evidence.ts',
  'scripts/shared-dictionary/creation-terminal-settlement.ts',
  'scripts/shared-dictionary/creation-terminal-cli.ts',
  'scripts/shared-dictionary/creation-terminal_test.ts',
  'supabase/functions/dictionary-creation/responseSchema_test.ts',
  'scripts/shared-dictionary/semantic-qualification-cli.ts',
]
export async function creationPilotPacket() {
  const readiness = await prepareCreationQualification()
  const history = record(JSON.parse(await Deno.readTextFile(HISTORY)))
  const historical_receipts_sha256: Record<string, string> = {}
  for (const key of [
    'provider_receipts_sha256',
    'new_provider_receipts_sha256',
    'day_pilot_receipts_sha256',
  ])
    for (const [path, hash] of Object.entries(record(history[key]))) {
      if (
        typeof hash !== 'string' ||
        (await sha256(await Deno.readTextFile(path))) !== hash
      )
        throw new Error('historical-provider-evidence-changed')
      historical_receipts_sha256[path] = hash
    }
  const source_sha256 = { ...readiness.packet.source_sha256 }
  for (const path of SOURCES)
    source_sha256[path] = await sha256(await Deno.readTextFile(path))
  const packet = {
    ...readiness.packet,
    schema_version: 7,
    execution_contract: 'creation-pilot-implicit-cache-accounting-v6',
    text_usage_rates_nanousd: {
      standard_input: 750,
      implicit_cached_input: 75,
      output_including_thinking: 3750,
      effective_through: '2026-12-31',
      cached_tokens_included_in_prompt: true,
    },
    readiness_packet_sha256: readiness.packet_sha256,
    historical_receipts_sha256,
    source_sha256,
    completion_requires: {
      fixed_judges: 40,
      generated_and_judged_pairs: 4,
      provider_results: 48,
      structural_guards: 2,
      all_phase_versions_and_usage_valid: true,
    },
    authorization_receipt_required:
      'explicit-reviewed-creation-and-distinct-judge-authority',
    authority_consumption: {
      identity: 'authority-id-in-shared-budget-ledger',
      claim: 'exclusive-synced-allocation-before-run-and-credentials',
      binding: 'exact-receipt-packet-allocation-run',
      settlement_replenishes_authority: false,
      interrupted_claim: 'retain-full-reservation-no-automatic-redispatch',
    },
    connectivity_preflight: 'same-process-no-key-provider-host-before-claim',
    completed_accounting:
      'frozen-sealed-raw-usage-independent-of-current-prompt-no-qualification',
    undispatched_accounting:
      'reviewed-first-judge-unknown-retain-one-reserve-no-authority-renewal',
    terminal_accounting: {
      kind: 'reviewed-terminated-run-v1',
      scope: 'reviewed-known-returned-fixed-judge-prefix-only',
      binds: 'review-bytes-allocation-frozen-packet-complete-journal-usage',
      application: 'exact-calculation-reverified-under-shared-lock',
      automatic_settlement: false,
      authority_replenished: false,
      qualification_granted: false,
    },
  }
  return { packet, packet_sha256: await sha256(canonicalizeJson(packet)) }
}
export type CreationPilotPacket = Awaited<
  ReturnType<typeof creationPilotPacket>
>
export async function verifyCreationPilotPacket(path: string) {
  const saved: unknown = JSON.parse(await Deno.readTextFile(path))
  const current = await creationPilotPacket()
  if (canonicalizeJson(saved) !== canonicalizeJson(current))
    throw new Error('creation-pilot-packet-or-source-changed')
  return current
}
