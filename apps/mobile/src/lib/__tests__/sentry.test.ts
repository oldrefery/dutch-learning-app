import * as SentryLib from '@sentry/react-native'
import { supabaseIntegration } from '@supabase/sentry-js-integration'
import { supabase } from '../supabaseClient'
import '../sentry'

const REDACTED = '[REDACTED]'
const PRIVATE_WORD = 'private-word'
const PRIVATE_ID = 'private-id'
const RELEASE = 'release-83'
const REVIEW_OP = 'review.prepare'

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
      user: { id: PRIVATE_ID, email: 'private@example.invalid' },
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

  it('removes inherited private context from slow-review warnings', () => {
    const result = getInitOptions().beforeSend({
      release: RELEASE,
      dist: '83',
      environment: 'production',
      tags: { module: REVIEW_OP, account: PRIVATE_ID },
      extra: {
        'review.word_count': 2500,
        'review.vocabulary_count': 5000,
        'review.duration_ms': 3100,
        'review.mode': 'adaptive',
        'review.platform': 'android',
        'review.update_id': '01a07acf-427b-7a76-8d6d-47d30dee1681',
        content: PRIVATE_WORD,
      },
      user: { id: PRIVATE_ID },
      breadcrumbs: [{ message: PRIVATE_WORD }],
      contexts: { custom: { word: PRIVATE_WORD } },
      request: { url: 'https://example.invalid/private-word' },
    })
    expect(result.extra).toMatchObject({
      'review.word_count': 2500,
      'review.duration_ms': 3100,
      'review.platform': 'android',
      'review.update_id': '01a07acf-427b-7a76-8d6d-47d30dee1681',
    })
    expect(result.release).toBe(RELEASE)
    expect(result.tags).toEqual({ module: REVIEW_OP })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('keeps review timing and trace identity but removes private transaction context', () => {
    const result = getInitOptions().beforeSendTransaction({
      type: 'transaction',
      transaction: REVIEW_OP,
      start_timestamp: 100,
      timestamp: 103,
      release: RELEASE,
      user: { id: PRIVATE_ID },
      tags: { account: PRIVATE_ID },
      breadcrumbs: [{ message: PRIVATE_WORD }],
      extra: { content: PRIVATE_WORD },
      spans: [{ description: PRIVATE_WORD }],
      contexts: {
        custom: { word: PRIVATE_WORD },
        trace: {
          trace_id: 'trace',
          span_id: 'span',
          op: REVIEW_OP,
          status: 'ok',
          data: {
            'review.mode': 'adaptive',
            'review.platform': 'ios',
            'review.update_id': 'embedded',
            'review.outcome': 'ready',
            'review.duration_ms': 3100,
            'review.word_count': 2500,
            'review.vocabulary_count': 5000,
            content: PRIVATE_WORD,
          },
        },
      },
    })
    expect(result).toMatchObject({
      start_timestamp: 100,
      timestamp: 103,
      release: RELEASE,
    })
    expect(result.contexts.trace).toMatchObject({
      trace_id: 'trace',
      span_id: 'span',
      status: 'ok',
      data: {
        'review.duration_ms': 3100,
        'review.platform': 'ios',
        'review.update_id': 'embedded',
      },
    })
    expect(result.spans).toEqual([])
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('rejects unexpected diagnostic values and tolerates missing trace context', () => {
    const options = getInitOptions()
    const warning = options.beforeSend({
      tags: { module: REVIEW_OP },
      extra: {
        'review.mode': PRIVATE_WORD,
        'review.outcome': PRIVATE_WORD,
        'review.word_count': -1,
        'review.duration_ms': Infinity,
        'review.vocabulary_count': PRIVATE_WORD,
        'review.platform': PRIVATE_WORD,
        'review.update_id': PRIVATE_WORD,
      },
    })
    expect(warning.extra).toEqual({
      'review.platform': 'unknown',
      'review.update_id': 'unknown',
      'review.mode': 'unknown',
      'review.outcome': 'unknown',
      'review.word_count': null,
      'review.duration_ms': null,
      'review.vocabulary_count': null,
    })
    expect(
      options.beforeSendTransaction({ transaction: REVIEW_OP }).contexts
    ).toBeUndefined()
  })
})
