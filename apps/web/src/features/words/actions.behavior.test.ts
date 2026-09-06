/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { deleteWord, resetWordProgress, updateWordImage } from './actions'
import { INITIAL_WORD_ACTION_STATE as initial } from './form-state'
import {
  collectionId,
  wordId,
  collectionPath,
  wordPath,
  form,
  from,
  rpc,
  queueQuery,
  setupActions,
  expectOwnedWord,
  expectNoSuccessEffects,
  redirectSignal,
} from './__tests__/action-fixture'

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const scenarios: {
  name: string
  action: typeof resetWordProgress
  fields: Record<string, string>
  failure: string
}[] = [
  {
    name: 'reset',
    action: resetWordProgress,
    fields: {
      resetId: '44444444-4444-4444-8444-444444444444',
      resetAt: '2026-09-05T12:00:00.000Z',
      reviewDate: '2026-09-05',
    },
    failure: 'Could not reset word progress. Please try again.',
  },
  {
    name: 'delete',
    action: deleteWord,
    fields: { confirmation: 'delete' },
    failure: 'Could not delete the word. Please try again.',
  },
  {
    name: 'image',
    action: updateWordImage,
    fields: { imageUrl: 'https://images.unsplash.com/photo-1' },
    failure: 'Could not update the image. Please try again.',
  },
]

beforeEach(() => {
  setupActions()
  jest.useFakeTimers().setSystemTime(new Date('2026-09-05T12:00:00.000Z'))
})
afterEach(() => jest.useRealTimers())

describe.each(scenarios)(
  '$name persistence',
  ({ name, action, fields, failure }) => {
    it('stops before accessing data when authentication fails', async () => {
      const error = new Error('Session expired')
      jest.mocked(requireAuthContext).mockRejectedValueOnce(error)
      await expect(
        action(collectionId, wordId, initial, form(fields))
      ).rejects.toBe(error)
      expect(createClient).not.toHaveBeenCalled()
      expectNoSuccessEffects()
    })

    it.each([
      ['invalid', wordId],
      [collectionId, 'invalid'],
    ])('rejects invalid identifiers %s / %s', async (collection, word) => {
      expect(await action(collection, word, initial, form(fields))).toEqual({
        status: 'error',
        message: 'The word could not be found.',
      })
      expect(createClient).not.toHaveBeenCalled()
      expectNoSuccessEffects()
    })

    it.each([
      { data: null, error: null },
      { data: { word_id: wordId }, error: { code: '42501' } },
    ])(
      'does not report success for a denied, missing or failed write: %j',
      async ({ data, error }) => {
        const query = queueQuery(data, error)
        rpc.mockResolvedValue({ data: data ? [data] : null, error })
        expect(
          await action(collectionId, wordId, initial, form(fields))
        ).toEqual({ status: 'error', message: failure })
        if (name === 'reset') {
          expect(from).not.toHaveBeenCalled()
          expect(rpc).toHaveBeenCalledWith(
            'reset_word_learning_progress',
            expect.objectContaining({
              p_word_id: wordId,
              p_collection_id: collectionId,
            })
          )
        } else {
          expect(from.mock.calls).toEqual([['words']])
          expectOwnedWord(query)
          expect(query.select.mock.calls).toEqual([['word_id']])
        }
        expectNoSuccessEffects()
      }
    )
  }
)

it('sends an identified reset command and refreshes every progress view', async () => {
  rpc.mockResolvedValue({ data: [{ word_id: wordId }], error: null })
  expect(
    await resetWordProgress(
      collectionId,
      wordId,
      initial,
      form(scenarios[0].fields)
    )
  ).toEqual({ status: 'success', message: 'Word progress reset.' })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('reset_word_learning_progress', {
    p_word_id: wordId,
    p_collection_id: collectionId,
    p_reset_id: scenarios[0].fields.resetId,
    p_reset_at: scenarios[0].fields.resetAt,
    p_review_date: '2026-09-05',
  })
  expect(from).not.toHaveBeenCalled()
  expect(jest.mocked(revalidatePath).mock.calls).toEqual([
    ['/app/collections'],
    [collectionPath],
    [wordPath],
  ])
  expect(redirect).not.toHaveBeenCalled()
})

it.each<Record<string, string>>([
  {},
  { resetId: 'invalid' },
  { resetAt: 'invalid' },
  { reviewDate: 'invalid' },
  { reviewDate: 'x2026-09-05' },
  { reviewDate: '2026-09-05x' },
])(
  'rejects malformed reset command fields before accessing the database: %j',
  async fields => {
    const values = Object.keys(fields).length
      ? { ...scenarios[0].fields, ...fields }
      : fields
    const result = await resetWordProgress(
      collectionId,
      wordId,
      initial,
      form(values)
    )
    expect(result).toEqual({
      status: 'error',
      message: 'The reset request is invalid. Please reload and try again.',
    })
    expect(createClient).not.toHaveBeenCalled()
    expectNoSuccessEffects()
  }
)

it.each([
  { data: [] },
  { data: [null] },
  { data: [{ word_id: collectionId }] },
  { data: [{ word_id: wordId }, { word_id: wordId }] },
])(
  'rejects incomplete or mismatched reset acknowledgements: %j',
  async ({ data }) => {
    rpc.mockResolvedValue({ data, error: null })
    const result = await resetWordProgress(
      collectionId,
      wordId,
      initial,
      form(scenarios[0].fields)
    )
    expect(result.status).toBe('error')
    expectNoSuccessEffects()
  }
)

it('requires explicit deletion confirmation before writing', async () => {
  expect(await deleteWord(collectionId, wordId, initial, form())).toEqual({
    status: 'error',
    message: null,
    fieldErrors: { confirmation: 'Confirm that you want to delete this word.' },
  })
  expect(createClient).not.toHaveBeenCalled()
  expectNoSuccessEffects()
})

it('soft-deletes only the owned live word before redirecting', async () => {
  const query = queueQuery()
  await expect(
    deleteWord(collectionId, wordId, initial, form({ confirmation: 'delete' }))
  ).rejects.toBe(redirectSignal)
  expect(query.update.mock.calls).toEqual([
    [{ deleted_at: '2026-09-05T12:00:00.000Z' }],
  ])
  expectOwnedWord(query)
  expect(jest.mocked(revalidatePath).mock.calls).toEqual([
    ['/app/collections'],
    [collectionPath],
  ])
  expect(jest.mocked(redirect).mock.calls).toEqual([[collectionPath]])
})

it('requires full access to change an image', async () => {
  jest.mocked(requireAuthContext).mockResolvedValueOnce({
    userId: 'limited-user',
    email: null,
    accessLevel: 'read_only',
  })
  expect(
    await updateWordImage(
      collectionId,
      wordId,
      initial,
      form({ imageUrl: 'https://images.unsplash.com/photo-1' })
    )
  ).toEqual({
    status: 'error',
    message: 'Full access is required to change word images.',
  })
  expect(createClient).not.toHaveBeenCalled()
})

it('rejects unsafe image URLs before writing', async () => {
  expect(
    await updateWordImage(
      collectionId,
      wordId,
      initial,
      form({ imageUrl: 'javascript:alert(1)' })
    )
  ).toMatchObject({ status: 'error' })
  expect(createClient).not.toHaveBeenCalled()
  expectNoSuccessEffects()
})

it('changes only the image and refreshes its two views', async () => {
  const query = queueQuery()
  expect(
    await updateWordImage(
      collectionId,
      wordId,
      initial,
      form({ imageUrl: 'https://images.unsplash.com/photo-1' })
    )
  ).toEqual({ status: 'success', message: 'Word image updated.' })
  expect(query.update.mock.calls).toEqual([
    [{ image_url: 'https://images.unsplash.com/photo-1' }],
  ])
  expectOwnedWord(query)
  expect(jest.mocked(revalidatePath).mock.calls).toEqual([
    [collectionPath],
    [wordPath],
  ])
})
