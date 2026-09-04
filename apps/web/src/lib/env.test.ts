import { getSupabasePublicConfig } from './env'

const ORIGINAL_ENV = process.env

describe('getSupabasePublicConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('returns the configured public values', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'

    expect(getSupabasePublicConfig()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'publishable-key',
    })
  })

  test.each([
    ['NEXT_PUBLIC_SUPABASE_URL', undefined, 'publishable-key'],
    [
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'https://example.supabase.co',
      undefined,
    ],
  ])('rejects a missing %s', (name, url, publishableKey) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey

    expect(() => getSupabasePublicConfig()).toThrow(
      `Missing required environment variable: ${name}`
    )
  })
})
