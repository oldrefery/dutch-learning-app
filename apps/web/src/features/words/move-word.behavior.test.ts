/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { moveWord } from './actions'
import { INITIAL_WORD_ACTION_STATE as initial } from './form-state'
import {
  collectionId,
  wordId,
  targetId,
  userId,
  collectionPath,
  form,
  from,
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

beforeEach(setupActions)

it('blocks a move when authentication fails', async () => {
  const error = new Error('Session expired')
  jest.mocked(requireAuthContext).mockRejectedValueOnce(error)
  await expect(
    moveWord(
      collectionId,
      wordId,
      initial,
      form({ targetCollectionId: targetId })
    )
  ).rejects.toBe(error)
  expect(createClient).not.toHaveBeenCalled()
  expectNoSuccessEffects()
})

it.each([
  ['invalid', wordId, targetId],
  [collectionId, 'invalid', targetId],
  [collectionId, wordId, 'invalid'],
  [collectionId, wordId, null],
])(
  'rejects malformed move identifiers: %s / %s / %s',
  async (collection, word, target) => {
    expect(
      await moveWord(
        collection,
        word,
        initial,
        form(target ? { targetCollectionId: target } : {})
      )
    ).toEqual({
      status: 'error',
      message: null,
      fieldErrors: { targetCollectionId: 'Choose a valid collection.' },
    })
    expect(createClient).not.toHaveBeenCalled()
    expectNoSuccessEffects()
  }
)

it('rejects moving to the current collection', async () => {
  expect(
    await moveWord(
      collectionId,
      wordId,
      initial,
      form({ targetCollectionId: collectionId })
    )
  ).toEqual({
    status: 'error',
    message: null,
    fieldErrors: { targetCollectionId: 'Choose a different collection.' },
  })
  expect(createClient).not.toHaveBeenCalled()
})

it.each([
  { data: null, error: null },
  { data: { collection_id: targetId }, error: { code: '42501' } },
])(
  'refuses to update a word when the destination is not accessible: %j',
  async ({ data, error }) => {
    const target = queueQuery(data, error)
    expect(
      await moveWord(
        collectionId,
        wordId,
        initial,
        form({ targetCollectionId: targetId })
      )
    ).toEqual({
      status: 'error',
      message: null,
      fieldErrors: { targetCollectionId: 'Choose a collection you own.' },
    })
    expect(from.mock.calls).toEqual([['collections']])
    expect(target.select.mock.calls).toEqual([['collection_id']])
    expect(target.eq.mock.calls).toEqual([
      ['collection_id', targetId],
      ['user_id', userId],
    ])
    expect(target.update).not.toHaveBeenCalled()
    expectNoSuccessEffects()
  }
)

it.each([
  { data: null, error: null },
  { data: { word_id: wordId }, error: { code: '42501' } },
])(
  'does not redirect after a missing, stale or failed word update: %j',
  async ({ data, error }) => {
    queueQuery({ collection_id: targetId })
    const word = queueQuery(data, error)
    expect(
      await moveWord(
        collectionId,
        wordId,
        initial,
        form({ targetCollectionId: targetId })
      )
    ).toEqual({
      status: 'error',
      message: 'Could not move the word. Please try again.',
    })
    expectOwnedWord(word)
    expectNoSuccessEffects()
  }
)

it('moves only collection membership, preserves SRS, and refreshes both collections', async () => {
  queueQuery({ collection_id: targetId })
  const word = queueQuery()
  await expect(
    moveWord(
      collectionId,
      wordId,
      initial,
      form({ targetCollectionId: targetId })
    )
  ).rejects.toBe(redirectSignal)
  expect(from.mock.calls).toEqual([['collections'], ['words']])
  expect(word.update.mock.calls).toEqual([[{ collection_id: targetId }]])
  expect(word.select.mock.calls).toEqual([['word_id']])
  expectOwnedWord(word)
  expect(jest.mocked(revalidatePath).mock.calls).toEqual([
    ['/app/collections'],
    [collectionPath],
    [`/app/collections/${targetId}`],
  ])
  expect(jest.mocked(redirect).mock.calls).toEqual([
    [`/app/collections/${targetId}/words/${wordId}`],
  ])
})
