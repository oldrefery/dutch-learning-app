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
  const getInitOptions = () => (SentryLib.init as jest.Mock).mock.calls[0][0]

  it('keeps Supabase tracing and breadcrumbs without automatic error capture', () => {
    expect(supabaseIntegration).toHaveBeenCalledWith(supabase, SentryLib, {
      tracing: true,
      breadcrumbs: true,
      errors: false,
    })
  })

  it('disables default PII collection and scrubs outgoing events', () => {
    const options = getInitOptions()

    expect(options.sendDefaultPii).toBe(false)

    const sanitizedEvent = options.beforeSend({
      extra: {
        email: 'user@example.com',
        url: 'dutchlearning://reset#access_token=secret',
      },
    })

    expect(sanitizedEvent.extra).toEqual({
      email: '[REDACTED]',
      url: 'dutchlearning://reset#access_token=[REDACTED]',
    })
  })

  it('scrubs outgoing breadcrumbs', () => {
    const options = getInitOptions()

    const sanitizedBreadcrumb = options.beforeBreadcrumb({
      category: 'auth',
      data: {
        authorization: 'Bearer secret-token',
        safe: 'visible',
      },
    })

    expect(sanitizedBreadcrumb.data).toEqual({
      authorization: '[REDACTED]',
      safe: 'visible',
    })
  })
})
