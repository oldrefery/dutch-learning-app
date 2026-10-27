import type { GeminiTransport } from '../dictionary-analysis/geminiTransport.ts'
import type { CreationTransport } from './worker.ts'
import type { RpcClient } from '../dictionary-analysis/store.ts'
import { withDictionaryPaidSpend } from '../_shared/dictionaryPaidSpend.ts'
import {
  prepareCreationRequest,
  verifyCreationGeminiProfile,
  type CreationGeminiProfile,
} from './geminiModel.ts'

// Explicit injection only: no env reader, serve entrypoint or live default.
export async function createCreationGeminiTransport(options: {
  profile: CreationGeminiProfile
  transport: GeminiTransport
  paid?: { bindingSha256: string; service: RpcClient }
}): Promise<CreationTransport> {
  const profile = structuredClone(options.profile)
  await verifyCreationGeminiProfile(profile)
  return {
    async invoke(phase, grant, actor) {
      const request = await prepareCreationRequest(phase, grant, profile)
      let transport = options.transport
      if (options.paid) {
        if (!actor) throw new Error('paid-actor-required')
        transport = withDictionaryPaidSpend({
          actor,
          bindingSha256: options.paid.bindingSha256,
          service: options.paid.service,
          transport: options.transport,
        })
      }
      // Return raw observed versions for durable journalling and SQL rejection.
      return transport.invoke(
        request,
        `${grant.run_id}:${phase}:${grant.fence}`
      )
    },
  }
}
