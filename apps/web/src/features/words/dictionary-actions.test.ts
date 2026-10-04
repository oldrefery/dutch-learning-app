/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { revalidatePath } from 'next/cache'
import { reanalyzeWord, updateWordImage } from './actions'
import { INITIAL_WORD_ACTION_STATE as initial } from './form-state'
import {
  collectionId,
  wordId,
  userId,
  form,
  from,
  invoke,
  rpc,
  queueQuery,
  setupActions,
  expectOwnedWord,
} from './__tests__/action-fixture'

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
const current = {
  word_id: wordId,
  dutch_lemma: 'huis',
  dutch_original: 'mijn huis',
}
const state = {
  word_id: wordId,
  user_id: userId,
  content_version: 3,
  overrides: { plural: { op: 'set', value: 'private plural' } },
}
beforeEach(() => {
  setupActions()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  invoke.mockResolvedValue({
    data: {
      success: true,
      data: {
        dutch_lemma: 'woning',
        dutch_original: 'woning',
        part_of_speech: 'noun',
        article: 'de',
        translations: { en: ['dwelling'] },
      },
    },
    error: null,
  })
  rpc.mockImplementation(
    (
      _name: string,
      args: {
        p_command: {
          operation_id: string
          word_id: string
          kind: string
          expected_content_version: number
        }
      }
    ) => ({
      error: null,
      data: {
        protocol_version: 1,
        operation_id: args.p_command.operation_id,
        word_id: args.p_command.word_id,
        kind: args.p_command.kind,
        content_version: args.p_command.expected_content_version + 1,
      },
    })
  )
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

it('saves reanalysis privately through one versioned command without touching learning fields', async () => {
  const owned = queueQuery(current)
  const contentState = queueQuery(state)
  const result = await reanalyzeWord(
    collectionId,
    wordId,
    initial,
    form({ contentVersion: '3' })
  )
  expect(result.status).toBe('success')
  expectOwnedWord(owned)
  expect(contentState.eq.mock.calls).toEqual([
    ['user_id', userId],
    ['word_id', wordId],
  ])
  expect(rpc).toHaveBeenCalledTimes(1)
  const command = rpc.mock.calls[0][1].p_command
  expect(command).toMatchObject({
    protocol_version: 1,
    word_id: wordId,
    expected_content_version: 3,
    kind: 'detach',
    content: {
      dutch_original: 'mijn huis',
      dutch_lemma: 'woning',
      tts_url: null,
    },
  })
  expect(command.content).not.toHaveProperty('repetition_count')
  expect(command.content).not.toHaveProperty('collection_id')
  expect(owned.update).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout')
})

it('preserves existing linguistic overrides when changing only the private image', async () => {
  const owned = queueQuery(current)
  queueQuery(state)
  const result = await updateWordImage(
    collectionId,
    wordId,
    initial,
    form({
      contentVersion: '3',
      imageUrl: 'https://images.unsplash.com/photo-test',
    })
  )
  expect(result.status).toBe('success')
  expectOwnedWord(owned)
  expect(rpc.mock.calls[0][1].p_command).toMatchObject({
    kind: 'edit-private',
    expected_content_version: 3,
    overrides: {
      ...state.overrides,
      image_url: { op: 'set', value: 'https://images.unsplash.com/photo-test' },
    },
  })
  expect(owned.update).not.toHaveBeenCalled()
})

it.each(['', '2', '-1', 'invalid'])(
  'rejects stale or invalid page versions before requesting analysis: %s',
  async contentVersion => {
    queueQuery(current)
    queueQuery(state)
    const result = await reanalyzeWord(
      collectionId,
      wordId,
      initial,
      form({ contentVersion })
    )
    expect(result).toMatchObject({
      status: 'error',
      message: expect.stringContaining('Reload'),
    })
    expect(invoke).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  }
)

it('does not retry against a newer version when the content changes during analysis', async () => {
  queueQuery(current)
  queueQuery(state)
  rpc.mockResolvedValue({
    data: null,
    error: { message: 'stale-content-version' },
  })
  const result = await reanalyzeWord(
    collectionId,
    wordId,
    initial,
    form({ contentVersion: '3' })
  )
  expect(result).toMatchObject({
    status: 'error',
    message: expect.stringContaining('Reload'),
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(from.mock.calls).toEqual([['words'], ['word_content_state']])
  expect(revalidatePath).not.toHaveBeenCalled()
})

it.each(['unsupported-protocol', 'permission denied', 'connection lost'])(
  'never falls back to legacy writes after command failure: %s',
  async message => {
    const owned = queueQuery(current)
    queueQuery(state)
    rpc.mockResolvedValue({ data: null, error: { message } })
    const result = await updateWordImage(
      collectionId,
      wordId,
      initial,
      form({
        contentVersion: '3',
        imageUrl: 'https://images.unsplash.com/photo-test',
      })
    )
    expect(result.status).toBe('error')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(owned.update).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  }
)

it('does not acknowledge a receipt for a different word', async () => {
  queueQuery(current)
  queueQuery(state)
  rpc.mockResolvedValue({
    data: { protocol_version: 1, word_id: 'foreign' },
    error: null,
  })
  const result = await updateWordImage(
    collectionId,
    wordId,
    initial,
    form({
      contentVersion: '3',
      imageUrl: 'https://images.unsplash.com/photo-test',
    })
  )
  expect(result.status).toBe('error')
  expect(revalidatePath).not.toHaveBeenCalled()
})
