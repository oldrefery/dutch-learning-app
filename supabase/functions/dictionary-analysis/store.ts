import type { AnalysisStore } from './worker.ts'

export interface RpcClient {
  rpc(
    name: string,
    parameters: Record<string, unknown>
  ): PromiseLike<{
    data: unknown
    error: { message: string } | null
  }>
}
const ACCEPTANCE_ERRORS = {
  'authentication-required': 401,
  'invalid-analysis-command': 400,
  'analysis-permission-required': 403,
  'shared-analysis-disabled': 503,
  'entry-unavailable': 404,
  'head-conflict': 409,
  'operation-payload-conflict': 409,
  'meaning-anchor-required': 409,
  'rate-limit-exceeded': 429,
} as const
export class AnalysisAcceptanceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code)
  }
}
export const createAnalysisStore = (
  caller: RpcClient,
  service: RpcClient
): AnalysisStore => {
  const call = async (
    client: RpcClient,
    name: string,
    parameters: Record<string, unknown>
  ): Promise<unknown> => {
    const response = await client.rpc(name, parameters)
    // Database errors may contain payload/SQL details. Do not return/log them.
    if (response.error) {
      // Only an exact, documented acceptance code is safe for a public response.
      const code = response.error.message
      if (
        name === 'accept_dictionary_analysis_v2' &&
        Object.hasOwn(ACCEPTANCE_ERRORS, code)
      )
        throw new AnalysisAcceptanceError(
          ACCEPTANCE_ERRORS[code as keyof typeof ACCEPTANCE_ERRORS],
          code
        )
      throw new Error('analysis-storage-unavailable')
    }
    return response.data
  }
  const key = (actor: string, operation: string, fence: string) => ({
    p_actor: actor,
    p_operation: operation,
    p_fence: fence,
  })
  return {
    accept: command =>
      call(caller, 'accept_dictionary_analysis_v2', { p_command: command }),
    read: (actor, operation, fence) =>
      call(
        service,
        'get_dictionary_analysis_work_v1',
        key(actor, operation, fence)
      ),
    dispatch: (actor, operation, fence, model, hash) =>
      call(service, 'start_dictionary_analysis_dispatch_v1', {
        ...key(actor, operation, fence),
        p_provider: 'gemini',
        p_model: model,
        p_input_sha256: hash,
      }),
    journal: (actor, operation, fence, result, requestId) =>
      call(service, 'journal_dictionary_analysis_result_v1', {
        ...key(actor, operation, fence),
        p_result: result,
        p_provider_request_id: requestId,
      }),
    failure: (actor, operation, fence, outcome, evidence) =>
      call(service, 'record_dictionary_analysis_failure_v1', {
        ...key(actor, operation, fence),
        p_outcome: outcome,
        p_evidence_sha256: evidence,
      }),
    validate: (actor, operation, fence, validation) =>
      call(service, 'record_dictionary_analysis_validation_v1', {
        ...key(actor, operation, fence),
        p_validation: validation,
      }),
    publish: (actor, operation, fence, id) =>
      call(service, 'publish_dictionary_analysis_v1', {
        ...key(actor, operation, fence),
        p_validation: id,
      }),
  }
}
