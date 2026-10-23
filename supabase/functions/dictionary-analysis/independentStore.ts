import { createAnalysisStore, type RpcClient } from './store.ts'
import type { SemanticPolicy } from './semanticModel.ts'

export const createIndependentAnalysisStore = (
  caller: RpcClient,
  service: RpcClient,
  policy: SemanticPolicy
) =>
  createAnalysisStore(
    {
      rpc: (name, args) =>
        caller.rpc(
          name === 'accept_dictionary_analysis_v2'
            ? 'accept_dictionary_independent_analysis_v2'
            : name,
          name === 'accept_dictionary_analysis_v2'
            ? {
                ...args,
                p_model: policy.generation_model,
                p_version: policy.validator_version,
                p_policy_sha256: policy.policy_sha256,
                p_semantic_model: policy.model,
                p_prompt_sha256: policy.prompt_sha256,
                p_media_url_prefixes: [...policy.media_url_prefixes],
              }
            : args
        ),
    },
    {
      rpc: (name, args) => {
        if (name !== 'start_dictionary_analysis_dispatch_v1')
          return service.rpc(name, args)
        const { p_provider: _provider, ...dispatch } = args
        return service.rpc(
          'start_dictionary_independent_analysis_dispatch_v1',
          {
            ...dispatch,
            p_version: policy.validator_version,
            p_policy_sha256: policy.policy_sha256,
          }
        )
      },
    }
  )
