import { createGeminiTransport } from '../dictionary-analysis/geminiTransport.ts'
import { createDictionaryCreationEndpoint } from './endpoint.ts'
import { buildCreationGeminiProfile } from './geminiModel.ts'
import { createCreationGeminiTransport } from './geminiTransport.ts'

export interface CreationRuntimeOptions {
  url: string
  anonKey: string
  serviceRoleKey: string
  apiKey: string
  models: Parameters<typeof buildCreationGeminiProfile>[0]
  policySha256: string
  promptSha256: string
  allowedOrigins: readonly string[]
  fetch?: typeof fetch
}

// Constructing the endpoint makes no network call. SQL still gates each operation.
export const createConfiguredCreationEndpoint = async (
  options: CreationRuntimeOptions
) => {
  const profile = await buildCreationGeminiProfile(options.models)
  if (
    profile.policy_sha256 !== options.policySha256 ||
    profile.prompt_sha256 !== options.promptSha256
  )
    throw new Error('creation-profile-binding-mismatch')
  const http = options.fetch ?? fetch
  const transport = await createCreationGeminiTransport({
    profile,
    transport: createGeminiTransport({ apiKey: options.apiKey, fetch: http }),
  })
  return createDictionaryCreationEndpoint({
    url: options.url,
    anonKey: options.anonKey,
    serviceRoleKey: options.serviceRoleKey,
    profile,
    transport,
    allowedOrigins: options.allowedOrigins,
    fetch: http,
  })
}
