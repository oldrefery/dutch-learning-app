import { createClient } from '@supabase/supabase-js'
import { createPasswordRecoveryClient } from '../passwordRecoveryClient'

jest.mock('@supabase/supabase-js')

describe('createPasswordRecoveryClient', () => {
  it('creates an isolated client without session persistence or refresh', () => {
    createPasswordRecoveryClient()

    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )
  })
})
