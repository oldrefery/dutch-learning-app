import type { CreationRuntimeOptions } from './bootstrap.ts'

type Handler = (request: Request) => Promise<Response>
const unavailable: Handler = () =>
  Promise.resolve(
    Response.json(
      { code: 'dictionary-creation-disabled' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  )

// Read no credentials and load no SDK until explicitly enabled.
export const createDictionaryCreationRuntime = async (
  readEnv: (name: string) => string | undefined,
  load: (options: CreationRuntimeOptions) => Promise<Handler>
): Promise<Handler> => {
  if (readEnv('DICTIONARY_CREATION_ENDPOINT_ENABLED') !== 'true')
    return unavailable
  try {
    const required = (name: string) => {
      const value = readEnv(name)
      if (!value?.trim() || value !== value.trim())
        throw new Error('invalid-creation-configuration')
      return value
    }
    const origins: unknown = JSON.parse(
      required('DICTIONARY_CREATION_ALLOWED_ORIGINS')
    )
    if (!Array.isArray(origins) || !origins.every(p => typeof p === 'string'))
      return unavailable
    return await load({
      url: required('SUPABASE_URL'),
      anonKey: required('SUPABASE_ANON_KEY'),
      serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
      apiKey: required('DICTIONARY_CREATION_GEMINI_API_KEY'),
      models: {
        generation_model: required('DICTIONARY_CREATION_GENERATION_MODEL'),
        judgement_model: required('DICTIONARY_CREATION_JUDGEMENT_MODEL'),
        generation_model_version: required(
          'DICTIONARY_CREATION_GENERATION_MODEL_VERSION'
        ),
        judgement_model_version: required(
          'DICTIONARY_CREATION_JUDGEMENT_MODEL_VERSION'
        ),
      },
      policySha256: required('DICTIONARY_CREATION_POLICY_SHA256'),
      promptSha256: required('DICTIONARY_CREATION_PROMPT_SHA256'),
      allowedOrigins: origins,
    })
  } catch {
    // Configuration and loader errors may contain secrets. Never expose them.
    return unavailable
  }
}
