/**
 * Mock Supabase Client
 * Used in tests instead of real client
 */

export const mockSupabaseClient = {
  auth: {
    signUp: jest.fn().mockResolvedValue({
      data: { user: { id: 'mock-user-id-123' } },
      error: null,
    }),
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { user: { id: 'mock-user-id-123', email: 'test@test.com' } },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    getSession: jest.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: 'mock-user-id-123', email: 'test@test.com' },
        },
      },
      error: null,
    }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },

  from: jest.fn((tableName: string) => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: '1', name: 'Test' },
          error: null,
        }),
        order: jest.fn().mockReturnValue({
          asc: jest.fn().mockReturnValue({
            then: jest.fn(),
          }),
        }),
        then: jest.fn(),
      }),
      order: jest.fn().mockReturnValue({
        asc: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        desc: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
      then: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),

    insert: jest.fn().mockResolvedValue({
      data: [{ id: '1' }],
      error: null,
    }),

    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [{ id: '1' }],
        error: null,
      }),
    }),

    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),

    upsert: jest.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  })),

  rpc: jest.fn().mockResolvedValue({
    data: { result: 'success' },
    error: null,
  }),

  channel: jest.fn(() => ({
    on: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
    }),
    unsubscribe: jest.fn(),
  })),
}

export const createClient = jest.fn(() => mockSupabaseClient)

export const getSupabaseMock = () => mockSupabaseClient
