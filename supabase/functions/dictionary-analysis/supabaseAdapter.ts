import { createClient } from '@supabase/supabase-js'
import { createDictionaryAnalysisHandler } from './handler.ts'
import { createAnalysisStore } from './store.ts'
import { createGeminiTransport } from './geminiTransport.ts'
import type { AnalysisWorkerDependencies } from './worker.ts'

// No Deno.serve entrypoint or environment loading: a separately qualified evaluator
// and explicit release configuration are still required before exposing this flow.
export const createSupabaseDictionaryAnalysisHandler = (options: {
  url: string
  anonKey: string
  serviceRoleKey: string
  apiKey: string
  model: string
  evaluate: AnalysisWorkerDependencies['evaluate']
}) => {
  const auth = {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  }
  const verifier = createClient(options.url, options.anonKey, { auth })
  const service = createClient(options.url, options.serviceRoleKey, { auth })
  const transport = createGeminiTransport({ apiKey: options.apiKey, fetch })
  return createDictionaryAnalysisHandler({
    verifyUser: async token => {
      const { data, error } = await verifier.auth.getUser(token)
      return error ? null : (data.user?.id ?? null)
    },
    forCaller: token => ({
      store: createAnalysisStore(
        createClient(options.url, options.anonKey, {
          auth,
          global: { headers: { Authorization: `Bearer ${token}` } },
        }),
        service
      ),
      transport,
      model: options.model,
      evaluate: options.evaluate,
    }),
  })
}
