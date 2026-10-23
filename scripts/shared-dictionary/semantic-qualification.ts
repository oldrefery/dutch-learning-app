import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { inspectCandidate } from '../../supabase/functions/dictionary-analysis/candidateGuards.ts'
import {
  buildSemanticPolicy,
  parseSemanticVerdict,
  prepareSemanticRequest,
} from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import {
  prepareGeminiRequest,
  record,
  sha256,
  type PreparedGeminiRequest,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import type { EvaluationContext } from '../../supabase/functions/dictionary-analysis/worker.ts'
import {
  qualificationCorpus,
  type QualificationCase,
} from './semantic-qualification-corpus.ts'
import { matchesObservedModel } from '../../supabase/functions/dictionary-analysis/observedModel.ts'

export const MODEL = 'gemini-3.8-flash'
export const MAX_CALLS = 48
export interface QualificationRequest {
  id: string
  case_id: string
  kind: 'judge' | 'generation'
  context: EvaluationContext
  request: PreparedGeminiRequest
}
export const contextFor = async (
  item: QualificationCase
): Promise<EvaluationContext> => {
  const input = structuredClone(item.input)
  input.anchor.anchor_sha256 = await sha256(
    canonicalizeJson({
      gloss: input.anchor.gloss,
      examples: input.anchor.examples,
    })
  )
  const result = {
    content: item.content,
    provider_response: { modelVersion: MODEL },
  }
  return {
    receipt: {
      protocol_version: 2,
      operation_id: '22222222-2222-4222-8222-222222222222',
      entry_id: input.entry.entry_id,
      expected_revision_id: '44444444-4444-4444-8444-444444444444',
      expected_head_sequence: '1',
      fence: '1',
      status: 'validating',
      quota_charged: true,
      result_sha256: await sha256(canonicalizeJson(result)),
      error_code: null,
      published_revision_id: null,
      published_head_sequence: null,
    },
    input,
    input_sha256: await sha256(canonicalizeJson(input)),
    result,
  }
}
export async function generatedJudge(
  parent: QualificationRequest,
  result: Record<string, unknown>
): Promise<QualificationRequest | null> {
  if (!matchesObservedModel(result, MODEL)) return null
  const context = structuredClone(parent.context)
  context.result = result
  context.receipt.result_sha256 = await sha256(canonicalizeJson(result))
  const inspected = await inspectCandidate(context, [])
  if (!inspected.valid) return null
  return {
    id: `${parent.id}-judge`,
    case_id: parent.case_id,
    kind: 'judge',
    context,
    request: await prepareSemanticRequest(
      context,
      inspected,
      await buildSemanticPolicy(MODEL, [], MODEL, {
        generation: MODEL,
        judge: MODEL,
      })
    ),
  }
}
export async function prepareQualification() {
  const corpus = qualificationCorpus()
  const policy = await buildSemanticPolicy(MODEL, [], MODEL, {
    generation: MODEL,
    judge: MODEL,
  })
  const requests: QualificationRequest[] = []
  const guards: string[] = []
  for (const item of corpus) {
    const context = await contextFor(item)
    const inspected = await inspectCandidate(context, [])
    if (!inspected.valid) {
      if (item.category !== 'guard')
        throw new Error(`Invalid linguistic fixture: ${item.id}`)
      guards.push(item.id)
      continue
    }
    if (item.category === 'guard')
      throw new Error(`Guard did not reject: ${item.id}`)
    for (let repeat = 1; repeat <= 1; repeat++)
      requests.push({
        id: `${item.id}-${repeat}`,
        case_id: item.id,
        kind: 'judge',
        context,
        request: await prepareSemanticRequest(context, inspected, policy),
      })
  }
  for (const id of [
    'positive-3',
    'expanded-positive-lopen',
    'expanded-positive-licht',
    'expanded-positive-de-knoop-doorhakken',
  ]) {
    const item = corpus.find(row => row.id === id)!
    const context = await contextFor(item)
    requests.push({
      id: `generation-${id}`,
      case_id: id,
      kind: 'generation',
      context,
      request: await prepareGeminiRequest(context.input, MODEL),
    })
  }
  if (
    requests.length +
      requests.filter(row => row.kind === 'generation').length !==
    MAX_CALLS
  )
    throw new Error('Qualification call count changed')
  for (const row of requests)
    if (new TextEncoder().encode(row.request.body).length > 32768)
      throw new Error('Qualification request exceeds budget')
  return {
    schema_version: 1,
    qualified: false,
    scope: 'synthetic-pilot-not-release-qualification',
    execution_scope: {
      workflow: 'dictionary-analysis',
      request_mode: 'direct-request-probes',
      covers: [
        'protected-input-generation',
        'independent-semantic-judging',
        'candidate-guards-and-response-parsing',
      ],
      excludes: [
        'dictionary-creation',
        'database-publication',
        'client-device-behavior',
        'runtime-activation',
      ],
      creation_requirement:
        'Qualify a separate compatible generator/judge profile and the creation grant/transport path.',
    },
    model: MODEL,
    policy,
    corpus_sha256: await sha256(canonicalizeJson(corpus)),
    label_review: 'proposed-not-independently-human-reviewed',
    judge_repeats_per_case: 1,
    expected_judge_results: requests.filter(row => row.kind === 'judge').length,
    generation_cases: requests
      .filter(row => row.kind === 'generation')
      .map(row => row.case_id),
    qualification_scope: ['noun', 'verb', 'adjective', 'expression'],
    activation_requires_reviewed_scope_enforcement: true,
    corpus,
    guards,
    requests,
    limits: {
      provider_calls: MAX_CALLS,
      max_request_bytes: 32768,
      max_output_tokens: 8192,
      model_output_ceiling_for_reservation: 65536,
      usd_authority_ceiling: 15,
      reserved_usd_per_attempt: 0.28,
      max_attempts_per_60_seconds: 10,
      automatic_retries: 0,
      approval_expires_at: '2026-10-18T00:00:00Z',
    },
    thresholds: {
      false_acceptances: 0,
      minimum_positive_acceptance: 0.875,
      minimum_negative_rejection: 0.875,
      minimum_uncertain_abstention: 0.833,
      invalid_verdicts: 0,
      missing_or_mixed_model_versions: 0,
    },
  }
}
export function scoreJudge(
  row: QualificationRequest,
  envelope: Record<string, unknown>,
  contentHash: string,
  expectedVersion = MODEL
) {
  const provider = record(envelope.provider_response)
  const verdict = parseSemanticVerdict(
    matchesObservedModel(envelope, expectedVersion) ? envelope.content : null,
    row.context,
    contentHash
  )
  return {
    decision: verdict?.decision ?? 'invalid',
    model_version:
      typeof provider.modelVersion === 'string' ? provider.modelVersion : null,
    usage: provider.usageMetadata ?? null,
    response_id:
      typeof provider.responseId === 'string' ? provider.responseId : null,
  }
}
export function summarizeQualification(
  rows: {
    category: QualificationCase['category']
    decision: string
    model_version: string | null
  }[],
  expectedResults = 40
) {
  const count = (category: string, decision: string) =>
    rows.filter(row => row.category === category && row.decision === decision)
      .length
  const rate = (category: string, decision: string) => {
    const total = rows.filter(row => row.category === category).length
    return total ? count(category, decision) / total : 0
  }
  const versions = [
    ...new Set(rows.map(row => row.model_version).filter(Boolean)),
  ]
  return {
    qualified: false,
    human_failure_review_required: true,
    expected_judge_results: expectedResults,
    completed_judge_results: rows.length,
    false_acceptances: rows.filter(
      row => row.category !== 'positive' && row.decision === 'same-meaning'
    ).length,
    positive_acceptance: rate('positive', 'same-meaning'),
    negative_rejection: rate('negative', 'different-meaning'),
    uncertain_abstention: rate('uncertain', 'uncertain'),
    invalid_verdicts: rows.filter(row => row.decision === 'invalid').length,
    observed_model_versions: versions,
    complete_single_version:
      rows.length === expectedResults &&
      versions.length === 1 &&
      rows.every(row => !!row.model_version),
    limitation:
      'Small proposed synthetic corpus; no population accuracy or automatic production qualification claim.',
  }
}
