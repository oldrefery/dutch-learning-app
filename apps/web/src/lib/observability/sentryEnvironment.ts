export type SentryEnvironment = 'development' | 'preview' | 'production'

const SENTRY_ENVIRONMENTS: ReadonlySet<string> = new Set([
  'development',
  'preview',
  'production',
])

export function resolveSentryEnvironment(
  vercelEnvironment: string | undefined,
  nodeEnvironment: string | undefined
): SentryEnvironment {
  if (vercelEnvironment && SENTRY_ENVIRONMENTS.has(vercelEnvironment)) {
    return vercelEnvironment as SentryEnvironment
  }

  return nodeEnvironment === 'production' ? 'production' : 'development'
}
