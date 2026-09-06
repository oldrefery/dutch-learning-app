import * as SentryLib from '@sentry/react-native'
import { supabaseIntegration } from '@supabase/sentry-js-integration'
import { supabase } from '../supabaseClient'
import '../sentry'

const REDACTED = '[REDACTED]'
const PRIVATE_WORD = 'private-word'

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
    expect(options).toEqual(
      expect.objectContaining({
        environment: 'development',
        release: 'com.oldrefery.dutch-learning-app@1.0.0+1',
        dist: '1',
        tracesSampleRate: 0,
        profilesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      })
    )

    const sanitizedEvent = options.beforeSend({
      extra: {
        email: 'user@example.com',
        url: 'dutchlearning://reset#access_token=secret',
      },
    })

    expect(sanitizedEvent.extra).toEqual({
      email: REDACTED,
      url: `dutchlearning://reset#access_token=${REDACTED}`,
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
      authorization: REDACTED,
      safe: 'visible',
    })
  })

  it('allowlists sync-health events after scope enrichment, removing unrelated private context', () => {
    const result = getInitOptions().beforeSend({
      type: undefined,
      release: 'test-release',
      environment: 'production',
      tags: {
        module: 'sync-health',
        sync_health: 'protocol',
        secretTag: PRIVATE_WORD,
      },
      extra: {
        queue_count: 2,
        queue_resets: -1,
        outage_ms: Infinity,
        content: PRIVATE_WORD,
      },
      user: { id: 'private-id', email: 'private@example.invalid' },
      breadcrumbs: [{ message: PRIVATE_WORD }],
      contexts: { custom: { token: 'private-token' } },
      request: { url: 'https://example.invalid/private-word' },
      exception: { values: [{ value: PRIVATE_WORD }] },
    })
    expect(result.extra).toMatchObject({
      queue_count: 2,
      queue_resets: null,
      outage_ms: null,
    })
    expect(result.tags).toEqual({
      module: 'sync-health',
      sync_health: 'protocol',
    })
    expect(result.release).toBe('test-release')
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('scrubs outgoing transactions and spans', () => {
    const options = getInitOptions()

    const sanitizedTransaction = options.beforeSendTransaction({
      transaction: 'load access_token=transaction-secret',
      contexts: {
        trace: {
          data: {
            clientSecret: 'transaction-client-secret',
          },
        },
      },
    })
    const sanitizedSpan = options.beforeSendSpan({
      description: 'Authorization: Bearer span-secret',
      data: {
        session_id: 'span-session-secret',
      },
    })

    expect(sanitizedTransaction.transaction).toBe(
      `load access_token=${REDACTED}`
    )
    expect(sanitizedTransaction.contexts.trace.data.clientSecret).toBe(REDACTED)
    expect(sanitizedSpan.description).toBe(`Authorization: ${REDACTED}`)
    expect(sanitizedSpan.data.session_id).toBe(REDACTED)
  })

  it('configures replay with explicit privacy masking', () => {
    expect(SentryLib.mobileReplayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
    })
  })
})
