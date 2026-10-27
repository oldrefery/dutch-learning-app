import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import { record, sha256 } from '../dictionary-analysis/protectedInput.ts'
import type { RpcClient } from '../dictionary-analysis/store.ts'
import type { GeminiTransport } from '../dictionary-analysis/geminiTransport.ts'

/** A committed business grant also needs a one-time, bound monetary claim.
 * SQL journals settle usage; this adapter never retries or releases liability. */
export const withDictionaryPaidSpend = (options: {
  actor: string
  bindingSha256: string
  service: RpcClient
  transport: GeminiTransport
  now?: () => number
}): GeminiTransport => {
  if (!/^[0-9a-f]{64}$/.test(options.bindingSha256))
    throw new Error('invalid-paid-release-binding')
  return {
    async invoke(request, attemptId) {
      const body = record(JSON.parse(request.body))
      const config = record(body.generationConfig)
      const output = config.maxOutputTokens
      if (
        !Number.isSafeInteger(output) ||
        typeof output !== 'number' ||
        output < 1 ||
        output > 8192 ||
        request.input_sha256 !==
          (await sha256(
            canonicalizeJson({
              provider: 'gemini',
              model: request.model,
              body: request.body,
            })
          ))
      )
        throw new Error('invalid-paid-request')
      const bytes = new TextEncoder().encode(request.body).byteLength
      if (bytes > 32768) throw new Error('invalid-paid-request')
      const claim = await options.service.rpc(
        'claim_dictionary_paid_attempt_v1',
        {
          p_actor: options.actor,
          p_invocation_key: attemptId,
          p_model: request.model,
          p_binding_sha256: options.bindingSha256,
          p_request_sha256: request.input_sha256,
          p_request_bytes: bytes,
          p_output_tokens: output,
        }
      )
      if (claim.error) throw new Error('paid-dispatch-unavailable')
      const grant = record(claim.data)
      if (
        grant.allowed !== true ||
        typeof grant.attempt_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          grant.attempt_id
        ) ||
        grant.request_sha256 !== request.input_sha256 ||
        grant.invocation_key !== attemptId ||
        grant.model !== request.model ||
        grant.binding_sha256 !== options.bindingSha256
      )
        throw new Error('paid-dispatch-unavailable')
      const expiry =
        typeof grant.expires_at === 'string'
          ? Date.parse(grant.expires_at)
          : Number.NaN
      if (!Number.isFinite(expiry) || (options.now?.() ?? Date.now()) >= expiry)
        throw new Error('paid-dispatch-expired')
      return options.transport.invoke(request, attemptId)
    },
  }
}
