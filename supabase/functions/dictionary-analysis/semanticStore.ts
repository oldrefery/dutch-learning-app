import type { RpcClient } from './store.ts'
import type { SemanticStore } from './independentEvaluator.ts'
export const createSemanticStore = (service: RpcClient): SemanticStore => {
  const key = (actor: string, operation: string, fence: string) => ({
    p_actor: actor,
    p_operation: operation,
    p_fence: fence,
  })
  const call = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const response = await service.rpc(name, args)
    if (response.error) throw new Error('semantic-storage-unavailable')
    return response.data
  }
  return {
    read: (actor, operation, fence) =>
      call('get_dictionary_semantic_check_v1', key(actor, operation, fence)),
    start: (actor, operation, fence, policy, contentHash, inputHash) =>
      call('start_dictionary_semantic_check_v1', {
        ...key(actor, operation, fence),
        p_version: policy.validator_version,
        p_policy_sha256: policy.policy_sha256,
        p_model: policy.model,
        p_prompt_sha256: policy.prompt_sha256,
        p_content_sha256: contentHash,
        p_input_sha256: inputHash,
      }),
    journal: (actor, operation, fence, result, requestId) =>
      call('journal_dictionary_semantic_result_v1', {
        ...key(actor, operation, fence),
        p_result: result,
        p_provider_request_id: requestId,
      }),
    failure: (actor, operation, fence, outcome, evidence) =>
      call('record_dictionary_semantic_failure_v1', {
        ...key(actor, operation, fence),
        p_outcome: outcome,
        p_evidence_sha256: evidence,
      }),
  }
}
