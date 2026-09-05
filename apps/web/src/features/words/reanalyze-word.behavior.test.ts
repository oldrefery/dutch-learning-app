/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { reanalyzeWord } from './actions'
import { INITIAL_WORD_ACTION_STATE as initial } from './form-state'
import {
  collectionId,
  wordId,
  collectionPath,
  wordPath,
  form,
  from,
  invoke,
  queueQuery,
  setupActions,
  expectOwnedWord,
  expectNoSuccessEffects,
} from './__tests__/action-fixture'

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const current = {
  word_id: wordId,
  dutch_lemma: 'huis',
  dutch_original: 'mijn huis',
}
const response = {
  success: true,
  data: {
    dutch_lemma: 'woning',
    dutch_original: 'provider text',
    part_of_speech: 'noun',
    article: 'de',
    translations: { en: ['dwelling'] },
  },
}
const run = () => reanalyzeWord(collectionId, wordId, initial, form())

beforeEach(() => {
  setupActions()
  invoke.mockResolvedValue({ data: response, error: null })
})

it('requires authentication before reading or invoking the analysis service', async () => {
  const error = new Error('Session expired')
  jest.mocked(requireAuthContext).mockRejectedValueOnce(error)
  await expect(run()).rejects.toBe(error)
  expect(createClient).not.toHaveBeenCalled()
  expect(invoke).not.toHaveBeenCalled()
})

it('requires full access before reanalysis', async () => {
  jest.mocked(requireAuthContext).mockResolvedValueOnce({
    userId: 'limited-user',
    email: null,
    accessLevel: 'read_only',
  })
  expect(await run()).toEqual({
    status: 'error',
    message: 'Full access is required to reanalyze words.',
  })
  expect(createClient).not.toHaveBeenCalled()
})

it.each([
  ['invalid', wordId],
  [collectionId, 'invalid'],
])('rejects invalid identifiers %s / %s', async (collection, word) => {
  expect(await reanalyzeWord(collection, word, initial, form())).toEqual({
    status: 'error',
    message: 'The word could not be found.',
  })
  expect(createClient).not.toHaveBeenCalled()
})

it.each([
  { data: null, error: null },
  { data: current, error: { code: '42501' } },
])(
  'does not analyze inaccessible or deleted words: %j',
  async ({ data, error }) => {
    const read = queueQuery(data, error)
    expect(await run()).toEqual({
      status: 'error',
      message: 'The word could not be found.',
    })
    expectOwnedWord(read)
    expect(invoke).not.toHaveBeenCalled()
    expectNoSuccessEffects()
  }
)

it.each([
  [new Error('Service unavailable'), 'Service unavailable'],
  [new Error(''), 'Could not reanalyze this word. Please try again.'],
  [{}, 'Could not reanalyze this word. Please try again.'],
])(
  'does not write after an analysis service failure: %j',
  async (error, message) => {
    queueQuery(current)
    invoke.mockResolvedValueOnce({
      data: null,
      error,
    })
    expect(await run()).toEqual({
      status: 'error',
      message,
    })
    expect(from.mock.calls).toEqual([['words']])
    expectNoSuccessEffects()
  }
)

it.each([
  [null, 'The analysis service returned no data.'],
  [{ success: false, error: 'Quota exceeded' }, 'Quota exceeded'],
  [{ success: true, data: {} }, 'The analysis response was incomplete.'],
])(
  'rejects unusable analysis instead of overwriting the word: %j',
  async (data, message) => {
    queueQuery(current)
    invoke.mockResolvedValueOnce({ data, error: null })
    expect(await run()).toEqual({ status: 'error', message })
    expect(from.mock.calls).toEqual([['words']])
    expectNoSuccessEffects()
  }
)

it.each(['mijn huis', null])(
  'preserves the original input (%s) and never overwrites learning progress',
  async original => {
    const read = queueQuery({ ...current, dutch_original: original })
    const write = queueQuery()
    expect(await run()).toEqual({
      status: 'success',
      message: 'Fresh analysis saved. Learning progress was preserved.',
    })
    expect(read.select.mock.calls).toEqual([
      ['dutch_lemma, dutch_original, word_id'],
    ])
    expect(invoke.mock.calls).toEqual([
      ['gemini-handler', { body: { word: 'huis', forceRefresh: true } }],
    ])
    expectOwnedWord(read)
    expectOwnedWord(write)
    const payload = write.update.mock.calls[0][0]
    expect(payload).toMatchObject({
      dutch_lemma: 'woning',
      dutch_original: original ?? 'huis',
      article: 'de',
      translations: { en: ['dwelling'], ru: [] },
    })
    for (const key of [
      'easiness_factor',
      'interval_days',
      'repetition_count',
      'next_review_date',
      'last_reviewed_at',
      'user_id',
      'collection_id',
    ]) {
      expect(payload).not.toHaveProperty(key)
    }
    expect(write.select.mock.calls).toEqual([['word_id']])
    expect(jest.mocked(revalidatePath).mock.calls).toEqual([
      ['/app/collections'],
      [collectionPath],
      [wordPath],
    ])
  }
)

it('retries a unique-key conflict without changing the semantic key or progress', async () => {
  queueQuery(current)
  const first = queueQuery(null, { code: '23505' })
  const fallback = queueQuery()
  expect((await run()).status).toBe('success')
  expect(from.mock.calls).toEqual([['words'], ['words'], ['words']])
  expect(invoke).toHaveBeenCalledTimes(1)
  expectOwnedWord(first)
  expectOwnedWord(fallback)
  const firstPayload = first.update.mock.calls[0][0]
  const fallbackPayload = fallback.update.mock.calls[0][0]
  for (const key of ['dutch_lemma', 'part_of_speech', 'article']) {
    expect(firstPayload).toHaveProperty(key)
    expect(fallbackPayload).not.toHaveProperty(key)
  }
  expect(fallbackPayload).toEqual(
    Object.fromEntries(
      Object.entries(firstPayload).filter(
        ([key]) => !['dutch_lemma', 'part_of_speech', 'article'].includes(key)
      )
    )
  )
  expect(fallback.select.mock.calls).toEqual([['word_id']])
})

it.each([
  { data: null, error: null },
  { data: { word_id: wordId }, error: { code: '42501' } },
])('does not retry ordinary write failures: %j', async ({ data, error }) => {
  queueQuery(current)
  queueQuery(data, error)
  expect(await run()).toEqual({
    status: 'error',
    message: 'Could not save the refreshed analysis. Please try again.',
  })
  expect(from).toHaveBeenCalledTimes(2)
  expectNoSuccessEffects()
})

it.each([
  { data: null, error: null },
  { data: { word_id: wordId }, error: { code: '23505' } },
])(
  'does not hide or infinitely retry a failed conflict fallback: %j',
  async ({ data, error }) => {
    queueQuery(current)
    queueQuery(null, { code: '23505' })
    const fallback = queueQuery(data, error)
    expect(await run()).toEqual({
      status: 'error',
      message: 'Could not save the refreshed analysis. Please try again.',
    })
    expect(from).toHaveBeenCalledTimes(3)
    expectOwnedWord(fallback)
    expectNoSuccessEffects()
  }
)
