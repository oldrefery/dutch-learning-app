import { createClient } from '@supabase/supabase-js'
import { withAnalysisCors } from '../dictionary-analysis/cors.ts'
import { validateCreationProfile, type CreationProfile } from './contracts.ts'
import { createDictionaryCreationHandler } from './handler.ts'
import { createCreationStore } from './store.ts'
import type { CreationTransport } from './worker.ts'

// Explicit dependencies; the separately gated runtime owns environment loading.
// Tests inject fake HTTP/transport. Real profile qualification is separate.
export const createDictionaryCreationEndpoint = (options: {
  url: string
  anonKey: string
  serviceRoleKey: string
  profile: CreationProfile
  transport: CreationTransport
  allowedOrigins: readonly string[]
  fetch?: typeof fetch
}) => {
  validateCreationProfile(options.profile)
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
  return withAnalysisCors(
    createDictionaryCreationHandler({
      verifyUser: async token => {
        const { data, error } = await verifier.auth.getUser(token)
        return error ? null : (data.user?.id ?? null)
      },
      forCaller: (token, actor) => ({
        store: createCreationStore(
          createClient(options.url, options.anonKey, {
            auth,
            global: {
              fetch: http,
              headers: { Authorization: `Bearer ${token}` },
            },
          }),
          service
        ),
        transport: {
          invoke: (phase, grant) =>
            options.transport.invoke(phase, grant, actor),
        },
        profile: options.profile,
      }),
    }),
    options.allowedOrigins
  )
}
