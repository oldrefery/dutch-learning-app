import { captureEvent } from '@sentry/nextjs'
import {
  reportAnalysisFailure,
  sanitizeAnalysisEvent,
} from './analysis-telemetry'

jest.mock('@sentry/nextjs', () => ({ captureEvent: jest.fn() }))

it('transmits only diagnostic fields even after SDK enrichment', () => {
  const secret = 'private learner input'
  reportAnalysisFailure(
    'batch',
    'invoke',
    new Error('Russian analysis must use Cyrillic: ' + secret),
    { source: 'gemini', model: 'gemini-3.8-flash', word: secret },
    500
  )
  const [event] = jest.mocked(captureEvent).mock.calls[0]
  const clean = sanitizeAnalysisEvent({
    ...event,
    type: undefined,
    breadcrumbs: [{ message: secret }],
    request: { url: secret },
    user: { id: secret },
    extra: { secret },
    tags: { ...event.tags, collection: secret },
  })
  expect(clean.tags).toEqual({
    analysis_mode: 'batch',
    analysis_stage: 'invoke',
    analysis_reason: 'russian_script',
    analysis_source: 'gemini',
    analysis_model: 'gemini-3.8-flash',
    http_status: 500,
  })
  expect(JSON.stringify(clean)).not.toContain(secret)
})

it('reports incomplete cached responses without assigning a provider model', () => {
  reportAnalysisFailure(
    'single',
    'response',
    new Error('The analysis response was incomplete.'),
    { source: 'cache', model: 'gemini-3.8-flash' }
  )
  expect(jest.mocked(captureEvent).mock.calls[0][0].tags).toMatchObject({
    analysis_reason: 'incomplete',
    analysis_source: 'cache',
    analysis_model: undefined,
  })
})

it.each([400, 401, 403, 429])('skips expected HTTP %i responses', status => {
  reportAnalysisFailure('single', 'invoke', new Error('rejected'), {}, status)
  expect(captureEvent).not.toHaveBeenCalled()
})
