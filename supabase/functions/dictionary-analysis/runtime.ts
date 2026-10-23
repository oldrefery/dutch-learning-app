import type { IndependentEndpointOptions } from './endpoint.ts'

type Handler = (request: Request) => Promise<Response>
const unavailable: Handler = () =>
  Promise.resolve(
    Response.json(
      { code: 'shared-analysis-disabled' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  )

// Disabled by default, including absent/misspelled enablement. Do not read any
// credential, create clients or import the SDK until explicit enablement exists.
export const createDictionaryAnalysisRuntime = async (
  readEnv: (name: string) => string | undefined,
  load: (options: IndependentEndpointOptions) => Promise<Handler>
): Promise<Handler> => {
  if (readEnv('DICTIONARY_ANALYSIS_ENDPOINT_ENABLED') !== 'true')
    return unavailable
  try {
    const required = (name: string) => {
      const value = readEnv(name)
      if (!value?.trim()) throw new Error('invalid-endpoint-configuration')
      return value
    }
    const list = (name: string): string[] => {
      const value: unknown = JSON.parse(required(name))
      if (!Array.isArray(value) || !value.every(p => typeof p === 'string'))
        throw new Error('invalid-endpoint-configuration')
      return value
    }
    return await load({
      url: required('SUPABASE_URL'),
      anonKey: required('SUPABASE_ANON_KEY'),
      serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
      apiKey: required('DICTIONARY_ANALYSIS_GEMINI_API_KEY'),
      model: required('DICTIONARY_ANALYSIS_GENERATION_MODEL'),
      modelVersion: required('DICTIONARY_ANALYSIS_GENERATION_MODEL_VERSION'),
      semanticModel: required('DICTIONARY_ANALYSIS_SEMANTIC_MODEL'),
      semanticModelVersion: required(
        'DICTIONARY_ANALYSIS_SEMANTIC_MODEL_VERSION'
      ),
      mediaUrlPrefixes: list('DICTIONARY_ANALYSIS_MEDIA_URL_PREFIXES'),
      allowedOrigins: list('DICTIONARY_ANALYSIS_ALLOWED_ORIGINS'),
    })
  } catch {
    // Never log configuration errors, raw keys, provider bodies or SQL.
    return unavailable
  }
}
