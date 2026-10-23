import type { RpcClient } from '../dictionary-analysis/store.ts'
import { CreationCandidateInvalid, type CreationStore } from './worker.ts'

const ACCEPTANCE_ERRORS = {
  'authentication-required': 401,
  'invalid-creation-command': 400,
  'invalid-creation-recovery-command': 400,
  'analysis-permission-required': 403,
  'dictionary-creation-disabled': 503,
  'dictionary-creation-recovery-disabled': 503,
  'creation-profile-unavailable': 503,
  'operation-payload-conflict': 409,
  'resolved-new-meaning-required': 409,
  'reviewed-identity-unavailable': 409,
  'owned-creation-recovery-review-required': 409,
  'creation-recovery-review-expired-or-revoked': 409,
  'creation-recovery-review-stale': 409,
  'creation-recovery-frontier-conflict': 409,
  'rate-limit-exceeded': 429,
} as const
export class CreationAcceptanceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code)
  }
}
export const createCreationStore = (
  caller: RpcClient,
  service: RpcClient
): CreationStore => {
  const call = async (
    client: RpcClient,
    name: string,
    parameters: Record<string, unknown>
  ) => {
    const response = await client.rpc(name, parameters)
    if (response.error) {
      const code = response.error.message
      if (
        name === 'start_dictionary_creation_judgement_v1' &&
        code === 'creation-candidate-invalid'
      )
        throw new CreationCandidateInvalid(code)
      if (
        [
          'accept_dictionary_creation_v2',
          'accept_dictionary_creation_recovery_v2',
        ].includes(name) &&
        Object.hasOwn(ACCEPTANCE_ERRORS, code)
      )
        throw new CreationAcceptanceError(
          ACCEPTANCE_ERRORS[code as keyof typeof ACCEPTANCE_ERRORS],
          code
        )
      // Never expose SQL details, private prompts, provider bodies or credentials.
      throw new Error('creation-storage-unavailable')
    }
    return response.data
  }
  const key = (run: string, fence: string) => ({ p_run: run, p_fence: fence })
  return {
    accept: command =>
      call(
        caller,
        'recovery_id' in command
          ? 'accept_dictionary_creation_recovery_v2'
          : 'accept_dictionary_creation_v2',
        { p_command: command }
      ),
    read: (actor, operation) =>
      call(service, 'get_dictionary_creation_work_v1', {
        p_actor: actor,
        p_operation: operation,
      }),
    dispatch: (phase, run, fence) =>
      call(
        service,
        phase === 'generation'
          ? 'start_dictionary_creation_dispatch_v1'
          : 'start_dictionary_creation_judgement_v1',
        key(run, fence)
      ),
    journal: (phase, grant, result, requestId) =>
      call(
        service,
        phase === 'generation'
          ? 'record_dictionary_creation_result_v1'
          : 'record_dictionary_creation_judgement_v1',
        {
          ...key(grant.run_id, grant.fence),
          p_input_sha256: grant.input_sha256,
          p_result: result,
          p_provider_request_id: requestId,
        }
      ),
    failure: (phase, grant, known, evidence) =>
      call(
        service,
        phase === 'generation'
          ? 'record_dictionary_creation_failure_v1'
          : 'fail_dictionary_creation_judgement_v1',
        {
          ...key(grant.run_id, grant.fence),
          p_input_sha256: grant.input_sha256,
          p_known_failure: known,
          p_evidence_sha256: evidence,
        }
      ),
    validate: (run, fence) =>
      call(service, 'validate_dictionary_creation_v1', key(run, fence)),
    publish: (run, fence, validation) =>
      call(service, 'publish_dictionary_creation_v1', {
        ...key(run, fence),
        p_validation: validation,
      }),
  }
}
