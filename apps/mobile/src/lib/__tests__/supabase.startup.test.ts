jest.mock('../supabaseClient')

it('loads application services without embedding development login credentials', () => {
  const original = process.env
  process.env = { ...original }
  delete process.env.EXPO_PUBLIC_DEV_USER_EMAIL
  delete process.env.EXPO_PUBLIC_DEV_USER_PASSWORD
  try {
    jest.isolateModules(() => {
      const services =
        jest.requireActual<typeof import('../supabase')>('../supabase')
      expect(services.wordService).toBeDefined()
      expect(services.collectionService).toBeDefined()
    })
  } finally {
    process.env = original
  }
})
