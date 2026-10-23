import type { GeminiTransport } from '../dictionary-analysis/geminiTransport.ts'
import type { CreationTransport } from './worker.ts'
import {
  prepareCreationRequest,
  verifyCreationGeminiProfile,
  type CreationGeminiProfile,
} from './geminiModel.ts'

// Explicit injection only: no env reader, serve entrypoint or live default.
export async function createCreationGeminiTransport(options: {
  profile: CreationGeminiProfile
  transport: GeminiTransport
}): Promise<CreationTransport> {
  const profile = structuredClone(options.profile)
  await verifyCreationGeminiProfile(profile)
  return {
    async invoke(phase, grant) {
      const request = await prepareCreationRequest(phase, grant, profile)
      // Return raw observed versions for durable journalling and SQL rejection.
      return options.transport.invoke(
        request,
        `${grant.run_id}:${phase}:${grant.fence}`
      )
    },
  }
}
