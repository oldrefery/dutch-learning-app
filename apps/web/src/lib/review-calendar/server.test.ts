import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getReviewCalendar } from './server'
import {
  calculateReviewStreak,
  listCollectionOverviews,
} from '@/features/collections/repository'

jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const rpc = jest.fn()
const from = jest.fn()
const cookieGet = jest.fn()
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-13T23:05:00Z'))
  cookieGet.mockReturnValue({ value: 'Europe/Amsterdam' })
  jest
    .mocked(cookies)
    .mockResolvedValue({ get: cookieGet } as unknown as Awaited<
      ReturnType<typeof cookies>
    >)
  jest
    .mocked(createClient)
    .mockResolvedValue({ rpc, from } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
})
afterEach(() => jest.useRealTimers())

test('reads browser zone and passes its calendar day to the existing aggregate RPC', async () => {
  rpc.mockResolvedValue({ data: [], error: null })
  expect(await getReviewCalendar()).toEqual({
    dateKey: '2026-11-14',
    timeZone: 'Europe/Amsterdam',
  })
  await listCollectionOverviews('owner')
  expect(rpc).toHaveBeenCalledWith('get_web_collection_overviews_v1', {
    p_today: '2026-11-14',
  })
  expect(from).not.toHaveBeenCalled()
})

test('missing RPC uses the same day for fallback; no mutation method is needed', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
  const collections = [
    {
      collection_id: 'c',
      name: 'Words',
      created_at: '2026-01-01',
      updated_at: null,
      is_shared: false,
    },
  ]
  const words = ['2026-11-13', '2026-11-14', '2026-11-15'].map((date, i) => ({
    collection_id: 'c',
    next_review_date: date,
    repetition_count: 5,
    easiness_factor: 2.5,
    word_id: `w-${i}`,
  }))
  from.mockImplementation((table: string) => {
    const result = {
      data: table === 'collections' ? collections : words,
      error: null,
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn(),
      range: jest.fn(async () => result),
    }
    query.order.mockImplementation(() =>
      table === 'collections' ? Promise.resolve(result) : query
    )
    return query
  })
  expect(await listCollectionOverviews('owner')).toEqual([
    expect.objectContaining({ totalWords: 3, masteredWords: 3, dueWords: 2 }),
  ])
})

test('invalid or missing time zone has a deterministic UTC bootstrap', async () => {
  cookieGet.mockReturnValue({ value: 'bad/zone' })
  expect(await getReviewCalendar()).toEqual({
    dateKey: '2026-11-13',
    timeZone: 'UTC',
  })
  cookieGet.mockReturnValue(undefined)
  expect((await getReviewCalendar()).dateKey).toBe('2026-11-13')
})

test('streak groups review timestamps by the same browser calendar', () => {
  const events = ['2026-11-13T23:05:00Z', '2026-11-12T23:05:00Z']
  const before = [...events]
  expect(
    calculateReviewStreak(
      events,
      new Date('2026-11-14T12:00:00'),
      'Europe/Amsterdam'
    )
  ).toBe(2)
  expect(events).toEqual(before)
})
