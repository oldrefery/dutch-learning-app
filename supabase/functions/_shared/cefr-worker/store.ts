import type { Database } from '../../../../packages/supabase-contracts/src/database.target.generated.ts'
import type { CefrWorkerStore } from './handler.ts'

type Functions = Database['public']['Functions']
export type CefrRpcName =
  | 'start_dictionary_cefr_run_v1'
  | 'authorize_dictionary_cefr_dispatch_v1'
  | 'finish_dictionary_cefr_attempt_v1'
  | 'finish_dictionary_cefr_run_v1'
export type CefrRpcCall = <Name extends CefrRpcName>(
  name: Name,
  args: Functions[Name]['Args'],
  signal: AbortSignal
) => PromiseLike<{ data: unknown; error: unknown }>

// Bind this callback to a server-only client. No URL, credentials or client SDK
// is constructed here. Generated target contracts constrain every RPC argument.
export const createCefrRpcStore = (
  rpc: CefrRpcCall,
  timeoutMs = 8000
): CefrWorkerStore => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
    throw new Error('Invalid CEFR persistence timeout')
  const call = async <Name extends CefrRpcName>(
    name: Name,
    args: Functions[Name]['Args'],
    signal?: AbortSignal
  ): Promise<unknown> => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancel: (() => void) | undefined
    const cancelled = new Promise<never>((_resolve, reject) => {
      cancel = () => {
        controller.abort()
        reject(new Error('CEFR persistence cancelled'))
      }
      timer = setTimeout(cancel, timeoutMs)
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) cancel()
    })
    try {
      if (signal?.aborted) return await cancelled
      const result = await Promise.race([
        Promise.resolve(rpc(name, args, controller.signal)),
        cancelled,
      ])
      if (result.error || result.data === null || result.data === undefined)
        throw new Error('CEFR persistence failed')
      return result.data
    } catch {
      throw new Error('CEFR persistence failed')
    } finally {
      clearTimeout(timer)
      if (cancel) signal?.removeEventListener('abort', cancel)
    }
  }
  return {
    start: (policyId, runId) =>
      call('start_dictionary_cefr_run_v1', {
        p_policy_id: policyId,
        p_run_id: runId,
      }),
    authorize: (job, signal) =>
      call(
        'authorize_dictionary_cefr_dispatch_v1',
        {
          p_reservation_id: job.reservation_id,
          p_lease_token: job.lease_token,
        },
        signal
      ),
    finish: (job, result) =>
      call('finish_dictionary_cefr_attempt_v1', {
        p_reservation_id: job.reservation_id,
        p_lease_token: job.lease_token,
        p_outcome: result.outcome,
        ...(result.outcome === 'estimated'
          ? { p_level: result.level, p_confidence: result.confidence }
          : {}),
        ...(result.outcome === 'retry' && result.retryAfterSeconds !== undefined
          ? { p_retry_after_seconds: result.retryAfterSeconds }
          : {}),
        ...(result.usage
          ? {
              p_usage: {
                provider_request_id: result.usage.provider_request_id,
                input_tokens: result.usage.input_tokens,
                output_tokens: result.usage.output_tokens,
                reasoning_tokens: result.usage.reasoning_tokens,
              },
            }
          : {}),
      }),
    summarize: runId =>
      call('finish_dictionary_cefr_run_v1', { p_run_id: runId }),
  }
}
