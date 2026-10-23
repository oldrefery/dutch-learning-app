import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import {
  parseDictionaryAnalysisReceiptV2,
  type DictionaryAnalysisReceiptV2,
} from '../../../packages/domain/src/dictionary-analysis.ts'
import type { DictionaryAnalysisValidationV1 } from '../../../packages/domain/src/dictionary-publication.ts'
import { inspectCandidate } from './candidateGuards.ts'
import type { GeminiTransport } from './geminiTransport.ts'
import { record, sha256 } from './protectedInput.ts'
import { matchesObservedModel, observedModelVersion } from './observedModel.ts'
import {
  parseSemanticVerdict,
  prepareSemanticRequest,
  type SemanticPolicy,
} from './semanticModel.ts'
import type { EvaluationContext } from './worker.ts'

export interface SemanticStore {
  read(actor: string, operation: string, fence: string): Promise<unknown>
  start(
    actor: string,
    operation: string,
    fence: string,
    policy: SemanticPolicy,
    contentHash: string,
    inputHash: string
  ): Promise<unknown>
  journal(
    actor: string,
    operation: string,
    fence: string,
    result: Record<string, unknown>,
    requestId: string
  ): Promise<unknown>
  failure(
    actor: string,
    operation: string,
    fence: string,
    outcome: string,
    evidence: string | null
  ): Promise<unknown>
}
export type SemanticEvaluation =
  | DictionaryAnalysisValidationV1
  | { kind: 'pending'; receipt: DictionaryAnalysisReceiptV2 }
const parsePacket = (value: unknown, context: EvaluationContext) => {
  const packet = record(value),
    receipt = parseDictionaryAnalysisReceiptV2(packet.receipt)
  if (
    !receipt.success ||
    receipt.data.operation_id !== context.receipt.operation_id ||
    receipt.data.entry_id !== context.receipt.entry_id ||
    receipt.data.expected_revision_id !==
      context.receipt.expected_revision_id ||
    receipt.data.expected_head_sequence !==
      context.receipt.expected_head_sequence ||
    receipt.data.fence !== context.receipt.fence ||
    receipt.data.result_sha256 !== context.receipt.result_sha256
  )
    throw new Error('invalid-semantic-receipt')
  return {
    receipt: receipt.data,
    check: packet.check === null ? null : record(packet.check),
    dispatch: packet.dispatch === true,
  }
}
export const createIndependentEvaluator =
  (dependencies: {
    store: SemanticStore
    transport: GeminiTransport
    policy: SemanticPolicy
  }) =>
  async (
    context: EvaluationContext,
    actor: string
  ): Promise<SemanticEvaluation> => {
    const { store, policy, transport } = dependencies
    const candidate = await inspectCandidate(context, policy.media_url_prefixes)
    const base = {
      validator_version: policy.validator_version,
      policy_sha256: policy.policy_sha256,
      anchor_sha256: context.input.anchor.anchor_sha256,
      input_sha256: context.input_sha256,
      result_sha256: context.receipt.result_sha256!,
    }
    const empty = {
      content: null,
      content_sha256: null,
      cefr_input_sha256: null,
    }
    if (!candidate.valid)
      return {
        ...base,
        ...empty,
        outcome: 'rejected',
        decision_code: candidate.decision_code,
        meaning_evidence_sha256: await sha256(
          canonicalizeJson({
            method: 'strict-candidate-guards-v1',
            decision: candidate.decision_code,
            ...base,
          })
        ),
      }
    const request = await prepareSemanticRequest(context, candidate, policy)
    let packet = parsePacket(
      await store.read(
        actor,
        context.receipt.operation_id,
        context.receipt.fence
      ),
      context
    )
    if (packet.receipt.status !== 'validating')
      return { kind: 'pending', receipt: packet.receipt }
    if (!matchesObservedModel(context.result, policy.generation_model_version))
      return {
        ...base,
        ...empty,
        outcome: 'review-required',
        decision_code: 'meaning-uncertain',
        meaning_evidence_sha256: await sha256(
          canonicalizeJson({
            method: 'observed-model-version-v1',
            ...base,
            expected: policy.generation_model_version,
            observed: observedModelVersion(context.result),
          })
        ),
      }
    if (!packet.check || packet.check.status === 'dispatching')
      packet = parsePacket(
        await store.start(
          actor,
          context.receipt.operation_id,
          context.receipt.fence,
          policy,
          candidate.content_sha256,
          request.input_sha256
        ),
        context
      )
    if (packet.dispatch) {
      if (
        !packet.check ||
        packet.check.quota_charged !== true ||
        packet.check.input_sha256 !== request.input_sha256 ||
        packet.check.content_sha256 !== candidate.content_sha256 ||
        packet.check.fence !== context.receipt.fence ||
        packet.check.validator_version !== policy.validator_version ||
        packet.check.policy_sha256 !== policy.policy_sha256 ||
        packet.check.model !== policy.model ||
        packet.check.prompt_sha256 !== policy.prompt_sha256 ||
        packet.check.status !== 'dispatching'
      )
        throw new Error('invalid-semantic-dispatch')
      const result = await transport.invoke(
        request,
        `semantic:${context.receipt.operation_id}:${context.receipt.fence}`
      )
      packet = parsePacket(
        result.kind === 'returned'
          ? await store.journal(
              actor,
              context.receipt.operation_id,
              context.receipt.fence,
              result.result,
              result.requestId
            )
          : await store.failure(
              actor,
              context.receipt.operation_id,
              context.receipt.fence,
              result.kind,
              result.evidence_sha256
            ),
        context
      )
    }
    if (
      packet.receipt.status !== 'validating' ||
      packet.check?.status === 'dispatching' ||
      packet.check?.status === 'provider-outcome-unknown'
    )
      return { kind: 'pending', receipt: packet.receipt }
    const check = packet.check
    if (!check) throw new Error('invalid-semantic-contract')
    if (
      check.fence !== context.receipt.fence ||
      check.validator_version !== policy.validator_version ||
      check.policy_sha256 !== policy.policy_sha256 ||
      check.model !== policy.model ||
      check.prompt_sha256 !== policy.prompt_sha256 ||
      check.content_sha256 !== candidate.content_sha256 ||
      check.input_sha256 !== request.input_sha256
    )
      throw new Error('semantic-profile-conflict')
    const verdict =
      check.status === 'returned' &&
      matchesObservedModel(record(check.result), policy.model_version)
        ? parseSemanticVerdict(
            record(check.result).content,
            context,
            candidate.content_sha256
          )
        : null
    const evidence = await sha256(
      canonicalizeJson({
        method: 'independent-gemini-v1',
        judge_input_sha256: check.input_sha256,
        judge_result_sha256: check.result_sha256,
        verdict,
      })
    )
    if (!verdict || verdict.decision === 'uncertain')
      return {
        ...base,
        ...empty,
        meaning_evidence_sha256: evidence,
        outcome: 'review-required',
        decision_code: 'meaning-uncertain',
      }
    if (verdict.decision === 'different-meaning')
      return {
        ...base,
        ...empty,
        meaning_evidence_sha256: evidence,
        outcome: 'rejected',
        decision_code: 'meaning-mismatch',
      }
    return {
      ...base,
      meaning_evidence_sha256: evidence,
      outcome: 'accepted',
      decision_code: 'same-meaning',
      content: candidate.content,
      content_sha256: candidate.content_sha256,
      cefr_input_sha256: candidate.cefr_input_sha256,
    }
  }
