/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { createClient } from '@/lib/supabase/server'
import { getReviewWorkspaceData } from './repository'
import { listRecentReviewEvents } from '@/features/history/repository'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const userId = 'synthetic-qa'
const original = {
  answered_correctly: true,
  assessment: 'good',
  event_id: 'event',
  review_mode: 'recognition',
  reviewed_at: '2026-09-06T12:00:00.000Z',
  word_id: 'word',
  next_easiness_factor: 2.5,
  next_interval_days: 6,
  previous_easiness_factor: 2.5,
  previous_interval_days: 1,
  response_time_ms: 500,
}
const effective = {
  ...original,
  assessment: 'again',
  next_easiness_factor: 2.3,
  next_interval_days: 0,
}
const ok = (data: unknown[]) => ({ data, error: null })
const rpc = jest.fn()
const from = jest.fn()
const queries: {
  table: string
  eq: jest.Mock
  order: jest.Mock
  range: jest.Mock
}[] = []
let responses: Record<
  string,
  { data: unknown[] | null; error: { message: string } | null }
>

const mockSnapshotMissing = (capability: { data: unknown; error: unknown }) => {
  rpc.mockImplementation((functionName: string) =>
    Promise.resolve(
      functionName === 'get_web_review_snapshot_v1'
        ? { data: null, error: { code: 'PGRST202' } }
        : capability
    )
  )
}

beforeEach(() => {
  jest.resetAllMocks()
  queries.length = 0
  responses = {
    collections: ok([{ collection_id: 'collection', name: 'QA' }]),
    words: ok([]),
    review_events: ok([original]),
    effective_review_events: ok([effective]),
  }
  mockSnapshotMissing({ data: 1, error: null })
  from.mockImplementation((table: string) => {
    const query = {
      table,
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      in: jest.fn(),
      order: jest.fn(),
      range: jest.fn(),
      limit: jest.fn(),
      then: (resolve: (value: (typeof responses)[string]) => unknown) =>
        Promise.resolve(responses[table]).then(resolve),
    }
    for (const method of [
      query.select,
      query.eq,
      query.is,
      query.in,
      query.order,
    ])
      method.mockReturnValue(query)
    query.range.mockImplementation((start: number, end: number) =>
      Promise.resolve({
        ...responses[table],
        data: responses[table].data?.slice(start, end + 1) ?? null,
      })
    )
    query.limit.mockImplementation(() => Promise.resolve(responses[table]))
    queries.push(query)
    return query
  })
  jest
    .mocked(createClient)
    .mockResolvedValue({ rpc, from } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
})

it('feeds effective assessments to adaptive decisions and history without changing original evidence', async () => {
  const workspace = await getReviewWorkspaceData(userId)
  const history = await listRecentReviewEvents(userId)
  expect(workspace.correctionsAvailable).toBe(true)
  expect(workspace.events).toEqual([
    {
      answeredCorrectly: true,
      assessment: 'again',
      eventId: 'event',
      reviewMode: 'recognition',
      reviewedAt: original.reviewed_at,
      wordId: 'word',
    },
  ])
  expect(history).toHaveLength(1)
  expect(history[0]).toMatchObject({
    assessment: 'again',
    nextIntervalDays: 0,
    nextEasinessFactor: 2.3,
    answeredCorrectly: true,
    responseTimeMs: 500,
  })
  expect(from).not.toHaveBeenCalledWith('review_events')
  for (const query of queries)
    expect(query.eq).toHaveBeenCalledWith('user_id', userId)
})

it('uses one validated snapshot RPC when the migrated contract is available', async () => {
  rpc.mockImplementation((functionName: string) =>
    Promise.resolve(
      functionName === 'get_web_review_snapshot_v1'
        ? {
            data: {
              protocolVersion: 1,
              correctionsAvailable: true,
              collections: [{ collection_id: 'collection', name: 'QA' }],
              words: [
                {
                  article: null,
                  collection_id: 'collection',
                  dutch_lemma: 'fiets',
                  dutch_original: 'fiets',
                  easiness_factor: 2.5,
                  image_url: null,
                  interval_days: 1,
                  last_reviewed_at: null,
                  next_review_date: '2026-09-12',
                  part_of_speech: 'noun',
                  repetition_count: 0,
                  translations: ['bike'],
                  tts_url: '',
                  word_id: 'word',
                },
              ],
              events: [effective],
            },
            error: null,
          }
        : { data: 1, error: null }
    )
  )

  await expect(getReviewWorkspaceData(userId)).resolves.toMatchObject({
    correctionsAvailable: true,
    words: [
      expect.objectContaining({
        id: 'word',
        ttsUrl: null,
        translations: ['bike'],
      }),
    ],
    events: [expect.objectContaining({ assessment: 'again' })],
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_web_review_snapshot_v1')
  expect(from).not.toHaveBeenCalled()
})

it('fails closed for malformed or unauthorized snapshot responses', async () => {
  rpc.mockResolvedValue({ data: { protocolVersion: 1 }, error: null })
  await expect(getReviewWorkspaceData(userId)).rejects.toThrow(
    'Could not load the review workspace'
  )

  rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
  await expect(getReviewWorkspaceData(userId)).rejects.toThrow(
    'Could not load the review workspace'
  )
  expect(from).not.toHaveBeenCalled()
})

it.each(['PGRST202', '42883'])(
  'keeps the old server readable when the capability is missing: %s',
  async code => {
    mockSnapshotMissing({ data: null, error: { code } })
    const workspace = await getReviewWorkspaceData(userId)
    const history = await listRecentReviewEvents(userId)
    expect(workspace.correctionsAvailable).toBe(false)
    expect(workspace.events[0].assessment).toBe('good')
    expect(history[0].assessment).toBe('good')
    expect(from).not.toHaveBeenCalledWith('effective_review_events')
  }
)

it('fails closed on a capability network error instead of silently serving old ratings', async () => {
  mockSnapshotMissing({ data: null, error: { code: 'NETWORK' } })
  await expect(getReviewWorkspaceData(userId)).rejects.toThrow(
    'verify review correction support'
  )
  await expect(listRecentReviewEvents(userId)).rejects.toThrow(
    'verify review correction support'
  )
  expect(from).toHaveBeenCalledWith('collections')
  expect(from).toHaveBeenCalledWith('words')
  expect(from).not.toHaveBeenCalledWith('review_events')
  expect(from).not.toHaveBeenCalledWith('effective_review_events')
})

it('does not fall back to uncorrected events when the effective view fails', async () => {
  responses.effective_review_events = {
    data: null,
    error: { message: 'Unavailable view' },
  }
  await expect(getReviewWorkspaceData(userId)).rejects.toThrow(
    'review workspace'
  )
  await expect(listRecentReviewEvents(userId)).rejects.toThrow(
    'learning history'
  )
  expect(from).not.toHaveBeenCalledWith('review_events')
})

it('preserves deterministic ordering for paginated effective evidence', async () => {
  responses.effective_review_events = ok(
    Array.from({ length: 501 }, (_, index) => ({
      ...effective,
      event_id: `event-${index}`,
    }))
  )
  const workspace = await getReviewWorkspaceData(userId)
  const query = queries.find(
    query => query.table === 'effective_review_events'
  )!
  expect(query.order.mock.calls).toEqual([
    ['reviewed_at', { ascending: false }],
    ['event_id', { ascending: false }],
  ])
  expect(
    queries
      .filter(query => query.table === 'effective_review_events')
      .flatMap(query => query.range.mock.calls)
  ).toEqual([
    [0, 499],
    [500, 999],
  ])
  expect(workspace.events).toHaveLength(501)
  expect(workspace.events[500].assessment).toBe('again')
})
