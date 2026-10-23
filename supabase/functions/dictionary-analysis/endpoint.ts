import { createClient } from '@supabase/supabase-js'
import { createDictionaryAnalysisHandler } from './handler.ts'
import { createIndependentAnalysisStore } from './independentStore.ts'
import { createIndependentEvaluator } from './independentEvaluator.ts'
import { createSemanticStore } from './semanticStore.ts'
import { buildSemanticPolicy } from './semanticModel.ts'
import { createGeminiTransport } from './geminiTransport.ts'
import { withAnalysisCors } from './cors.ts'

export interface IndependentEndpointOptions {
  url: string
  anonKey: string
  serviceRoleKey: string
  apiKey: string
  model: string
  modelVersion: string
  semanticModel: string
  semanticModelVersion: string
  mediaUrlPrefixes: readonly string[]
  allowedOrigins: readonly string[]
  fetch?: typeof fetch
}

// Explicit configuration only. Constructing/importing this factory makes no call.
export const createIndependentDictionaryAnalysisEndpoint = async (
  options: IndependentEndpointOptions
) => {
  const policy = await buildSemanticPolicy(
    options.semanticModel,
    options.mediaUrlPrefixes,
    options.model,
    { generation: options.modelVersion, judge: options.semanticModelVersion }
  )
  const auth = {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  }
  const http = options.fetch ?? fetch
  const verifier = createClient(options.url, options.anonKey, {
    auth,
    global: { fetch: http },
  })
  const service = createClient(options.url, options.serviceRoleKey, {
    auth,
    global: { fetch: http },
  })
  const transport = createGeminiTransport({
    apiKey: options.apiKey,
    fetch: http,
  })
  const evaluate = createIndependentEvaluator({
    store: createSemanticStore(service),
    transport,
    policy,
  })
  return withAnalysisCors(
    createDictionaryAnalysisHandler({
      verifyUser: async token => {
        const { data, error } = await verifier.auth.getUser(token)
        return error ? null : (data.user?.id ?? null)
      },
      forCaller: token => ({
        store: createIndependentAnalysisStore(
          createClient(options.url, options.anonKey, {
            auth,
            global: {
              fetch: http,
              headers: { Authorization: `Bearer ${token}` },
            },
          }),
          service,
          policy
        ),
        transport,
        model: policy.generation_model,
        evaluate,
      }),
    }),
    options.allowedOrigins
  )
}
