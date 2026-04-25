import * as SentryLib from '@sentry/react-native'
import { supabaseIntegration } from '@supabase/sentry-js-integration'
import { supabase } from '../supabaseClient'
import '../sentry'

jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('Sentry initialization', () => {
  it('keeps Supabase tracing and breadcrumbs without automatic error capture', () => {
    expect(supabaseIntegration).toHaveBeenCalledWith(supabase, SentryLib, {
      tracing: true,
      breadcrumbs: true,
      errors: false,
    })
  })
})
