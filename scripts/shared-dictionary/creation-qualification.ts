import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import type { DictionaryCreationReceiptV2 } from '../../packages/domain/src/dictionary-creation.ts'
import type { QualificationCase } from './semantic-qualification-corpus.ts'
import { creationQualificationCorpus } from './creation-qualification-corpus.ts'
import { contextFor } from './semantic-qualification.ts'
import {
  parseCreationGrant,
  type CreationGrant,
  type CreationPhase,
} from '../../supabase/functions/dictionary-creation/contracts.ts'
import {
  buildCreationGeminiProfile,
  prepareCreationRequest,
  type CreationGeminiProfile,
  type PreparedCreationRequest,
} from '../../supabase/functions/dictionary-creation/geminiModel.ts'
import { inspectCandidate } from '../../supabase/functions/dictionary-analysis/candidateGuards.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { matchesObservedModel } from '../../supabase/functions/dictionary-analysis/observedModel.ts'
import { parseSemanticVerdict } from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import type { EvaluationContext } from '../../supabase/functions/dictionary-analysis/worker.ts'

// Proposed pins; availability and returned versions have not been measured.
export const CREATION_CANDIDATE_MODELS = {
  generation_model: 'gemini-3.8-flash',
  judgement_model: 'gemini-3.6-flash',
  generation_model_version: 'gemini-3.8-flash',
  judgement_model_version: 'gemini-3.6-flash',
} as const
export interface CreationQualificationRequest {
  id: string
  case_id: string
  phase: CreationPhase
  grant: CreationGrant
  receipt: DictionaryCreationReceiptV2
  context: EvaluationContext
  request: PreparedCreationRequest
}
export async function creationFixture(
  item: QualificationCase,
  profile: CreationGeminiProfile
) {
  const context = await contextFor(item)
  const { entry_id, ...identity } = context.input.entry
  const receipt: DictionaryCreationReceiptV2 = {
    protocol_version: 2,
    operation_id: context.receipt.operation_id,
    resolution_id: context.input.anchor.anchor_id,
    entry_id,
    fence: context.receipt.fence,
    status: 'dispatching',
    quota_charged: true,
    result_sha256: null,
    error_code: null,
    published: null,
    published_head_sequence: null,
  }
  const input = {
    schema_version: 1,
    identity,
    anchor: context.input.anchor,
    evidence_sha256: await sha256(
      canonicalizeJson({ synthetic_case: item.id, input: context.input })
    ),
    validator_version: profile.validator_version,
    policy_sha256: profile.policy_sha256,
  }
  const grant = await parseCreationGrant(
    {
      run_id: context.receipt.operation_id,
      fence: receipt.fence,
      provider: 'gemini',
      model: profile.generation_model,
      input,
      input_sha256: await sha256(canonicalizeJson(input)),
    },
    'generation',
    context.receipt.operation_id,
    receipt,
    profile
  )
  return { context, receipt, grant }
}
export async function creationJudgeRequest(
  parent: CreationQualificationRequest,
  result: Record<string, unknown>,
  profile: CreationGeminiProfile,
  id = `${parent.id}-judge`
): Promise<CreationQualificationRequest | null> {
  if (!matchesObservedModel(result, profile.generation_model_version))
    return null
  const context = structuredClone(parent.context)
  context.result = result
  context.receipt.result_sha256 = await sha256(canonicalizeJson(result))
  const candidate = await inspectCandidate(context, [])
  if (!candidate.valid) return null
  const receipt = {
    ...parent.receipt,
    status: 'validating' as const,
    result_sha256: context.receipt.result_sha256,
  }
  const { anchor_sha256, gloss, examples } = context.input.anchor
  const input = {
    schema_version: 1,
    anchor: { anchor_sha256, gloss, examples },
    candidate: candidate.content,
    content_sha256: candidate.content_sha256,
    result_sha256: receipt.result_sha256,
    generation_input_sha256: parent.grant.input_sha256,
    fence: receipt.fence,
    evidence_sha256: parent.grant.input.evidence_sha256,
    validator_version: profile.validator_version,
    policy_sha256: profile.policy_sha256,
    prompt_sha256: profile.prompt_sha256,
  }
  const grant = await parseCreationGrant(
    {
      run_id: parent.grant.run_id,
      fence: receipt.fence,
      provider: 'gemini',
      model: profile.judgement_model,
      prompt_sha256: profile.prompt_sha256,
      input,
      input_sha256: await sha256(canonicalizeJson(input)),
    },
    'judgement',
    parent.grant.run_id,
    receipt,
    profile
  )
  return {
    id,
    case_id: parent.case_id,
    phase: 'judgement',
    grant,
    receipt,
    context,
    request: await prepareCreationRequest('judgement', grant, profile),
  }
}
export function scoreCreationJudge(
  row: CreationQualificationRequest,
  result: Record<string, unknown>,
  profile: CreationGeminiProfile
) {
  const verdict = matchesObservedModel(result, profile.judgement_model_version)
    ? parseSemanticVerdict(
        result.content,
        row.context,
        String(row.grant.input.content_sha256)
      )
    : null
  return {
    decision: verdict?.decision ?? 'invalid',
    model_version: record(result.provider_response).modelVersion ?? null,
  }
}
const SOURCES = [
  'scripts/shared-dictionary/creation-qualification-corpus.ts',
  'scripts/shared-dictionary/creation-qualification-corpus_test.ts',
  'scripts/shared-dictionary/creation-qualification.ts',
  'scripts/shared-dictionary/creation-qualification-cli.ts',
  'scripts/shared-dictionary/semantic-qualification.ts',
  'scripts/shared-dictionary/semantic-qualification-corpus.ts',
  'scripts/shared-dictionary/semantic-qualification-expanded.ts',
  'supabase/functions/dictionary-creation/geminiModel.ts',
  'supabase/functions/dictionary-creation/responseSchema.ts',
  'supabase/functions/dictionary-creation/geminiTransport.ts',
  'supabase/functions/dictionary-creation/contracts.ts',
  'supabase/functions/dictionary-creation/worker.ts',
  'supabase/functions/dictionary-creation/handler.ts',
  'supabase/functions/dictionary-creation/endpoint.ts',
  'supabase/functions/dictionary-creation/store.ts',
  'supabase/functions/dictionary-analysis/protectedInput.ts',
  'supabase/functions/dictionary-analysis/responseSchemas.ts',
  'supabase/functions/dictionary-analysis/semanticModel.ts',
  'supabase/functions/dictionary-analysis/observedModel.ts',
  'supabase/functions/dictionary-analysis/candidateGuards.ts',
  'supabase/functions/dictionary-analysis/geminiTransport.ts',
  'supabase/functions/dictionary-analysis/providerDiagnostics.ts',
  'packages/domain/src/shared-dictionary.ts',
  'packages/domain/src/dictionary-analysis.ts',
  'packages/domain/src/dictionary-creation.ts',
  'supabase/migrations/20261010180000_add_dictionary_creation_acceptance.sql',
  'supabase/migrations/20261010190000_add_dictionary_creation_dispatch.sql',
  'supabase/migrations/20261010200000_add_dictionary_creation_publication.sql',
  'supabase/migrations/20261011210000_add_dictionary_creation_recovery.sql',
  'supabase/migrations/20261011220000_bind_dictionary_observed_model_versions.sql',
]
export async function prepareCreationQualification() {
  const profile = await buildCreationGeminiProfile(CREATION_CANDIDATE_MODELS)
  const corpus = creationQualificationCorpus()
  const requests: CreationQualificationRequest[] = []
  const guards: string[] = []
  for (const item of corpus) {
    const f = await creationFixture(item, profile)
    const parent: CreationQualificationRequest = {
      id: `generation-${item.id}`,
      case_id: item.id,
      phase: 'generation',
      ...f,
      request: await prepareCreationRequest('generation', f.grant, profile),
    }
    const judge = await creationJudgeRequest(
      parent,
      f.context.result,
      profile,
      `${item.id}-1`
    )
    if (!judge) {
      if (item.category !== 'guard')
        throw new Error('unexpected-creation-guard-rejection')
      guards.push(item.id)
    } else requests.push(judge)
  }
  for (const id of [
    'positive-3',
    'expanded-positive-lopen',
    'expanded-positive-licht',
    'expanded-positive-de-knoop-doorhakken',
  ]) {
    const item = corpus.find(c => c.id === id)!
    const f = await creationFixture(item, profile)
    requests.push({
      id: `generation-${item.id}`,
      case_id: item.id,
      phase: 'generation',
      ...f,
      request: await prepareCreationRequest('generation', f.grant, profile),
    })
  }
  const source_sha256: Record<string, string> = {}
  for (const path of SOURCES)
    source_sha256[path] = await sha256(await Deno.readTextFile(path))
  const packet = {
    schema_version: 1,
    qualified: false,
    approved_for_execution: false,
    scope: 'synthetic-creation-grant-pilot-not-release-qualification',
    execution_scope: {
      workflow: 'dictionary-creation',
      request_mode: 'synthetic-committed-grant-request-probes',
      covers: [
        'creation-grant-request-mapping',
        'protected-input-generation',
        'distinct-model-semantic-judging',
        'candidate-guards-and-response-parsing',
      ],
      excludes: [
        'hosted-database-publication',
        'real-user-cards',
        'client-device-behavior',
        'runtime-activation',
      ],
      sql_grant_and_lifecycle_qualification_required: true,
    },
    profile,
    registry_proposal: {
      enabled: false,
      semantic_method: 'independent-gemini-v1',
      generation_model: profile.generation_model,
      generation_model_version: profile.generation_model_version,
      semantic_model: profile.judgement_model,
      semantic_model_version: profile.judgement_model_version,
      semantic_prompt_sha256: profile.prompt_sha256,
      validator_version: profile.validator_version,
      policy_sha256: profile.policy_sha256,
      media_url_prefixes: [],
      audit_reference: 'pending-creation-qualification-review-and-measurement',
    },
    observed_versions_status: 'proposed-pins-not-measured',
    corpus,
    corpus_sha256: await sha256(canonicalizeJson(corpus)),
    label_review: 'proposed-not-independently-human-reviewed',
    qualification_scope: ['noun', 'verb', 'adjective', 'expression'],
    activation_requires_reviewed_scope_enforcement: true,
    requests,
    guards,
    expected_judge_results: 40,
    contingent_judges: 4,
    limits: {
      provider_calls: 48,
      max_request_bytes: 32768,
      max_output_tokens: 8192,
      model_output_ceiling_for_reservation: 65536,
      reserved_usd_per_attempt: 0.28,
      maximum_run_reservation_usd: 13.44,
      usd_authority_ceiling: 15,
      max_attempts_per_60_seconds: 10,
      automatic_retries: 0,
      packet_valid_until: '2026-10-18T00:00:00Z',
      paid_execution_authority:
        'separate-current-day-packet-bound-receipt-required',
    },
    budget: {
      pricing_basis: 'standard-text-no-cache-tools-or-priority',
      input_usd_per_million: 0.75,
      output_including_thinking_usd_per_million: 3.75,
      rates_valid_through: '2026-12-31',
      aggregate_day_ledger_required: true,
      failed_or_unknown_reservation_retained: true,
      prior_day_cost_usd: 0.8142535,
      aggregate_if_reserved_today_usd: 14.2542535,
      calculation_is_authority: false,
      illustration_excludes_existing_creation_allocations: true,
    },
    thresholds: {
      false_acceptances: 0,
      minimum_positive_acceptance: 0.875,
      minimum_negative_rejection: 0.875,
      minimum_uncertain_abstention: 0.833,
      invalid_verdicts: 0,
      missing_or_mismatched_phase_model_versions: 0,
    },
    source_sha256,
  }
  if (requests.length !== 44 || guards.length !== 2)
    throw new Error('invalid-creation-qualification-plan')
  return { packet, packet_sha256: await sha256(canonicalizeJson(packet)) }
}
