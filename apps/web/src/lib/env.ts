interface SupabasePublicConfig {
  url: string
  publishableKey: string
}

const requireEnvironmentValue = (
  name: string,
  value: string | undefined
): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const getSupabasePublicConfig = (): SupabasePublicConfig => ({
  url: requireEnvironmentValue(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  publishableKey: requireEnvironmentValue(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ),
})
