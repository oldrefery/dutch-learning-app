/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import {
  reanalyzeWord,
  updateWordImage,
  refreshPublishedDictionaryAnalysis,
} from './actions'
import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import type { DictionaryAnalysisClientOperation } from '@woordenaar/domain'
import { INITIAL_WORD_ACTION_STATE } from './form-state'
import { followingBatch } from '@/features/dictionary/__fixtures__/following'
import {
  collectionId,
  wordId,
  form,
  from,
  invoke,
  rpc,
  queueQuery,
  setupActions,
} from './__tests__/action-fixture'

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const priorContent = process.env.DICTIONARY_CONTENT_ENABLED
const priorFollowing = process.env.DICTIONARY_FOLLOWING_ENABLED
beforeEach(() => {
  setupActions()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  process.env.DICTIONARY_FOLLOWING_ENABLED = 'true'
  rpc.mockResolvedValue({ data: followingBatch([wordId]), error: null })
})
afterAll(() => {
  for (const [name, value] of [
    ['DICTIONARY_CONTENT_ENABLED', priorContent],
    ['DICTIONARY_FOLLOWING_ENABLED', priorFollowing],
  ]) {
    if (value === undefined) delete process.env[name!]
    else process.env[name!] = value
  }
})

it('rejects following private reanalysis before invoking Gemini or any content mutation', async () => {
  const owned = queueQuery({
    word_id: wordId,
    dutch_lemma: 'huis',
    dutch_original: null,
  })
  const result = await reanalyzeWord(
    collectionId,
    wordId,
    INITIAL_WORD_ACTION_STATE,
    form({ contentVersion: '9007199254740993' })
  )
  expect(result).toEqual({
    status: 'error',
    message: expect.stringContaining('shared dictionary analysis'),
  })
  expect(invoke).not.toHaveBeenCalled()
  expect(owned.update).not.toHaveBeenCalled()
  expect(from).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_dictionary_effective_content_v2', {
    p_word_ids: [wordId],
  })
})

it('rejects private image overlays for a following reference', async () => {
  const owned = queueQuery({ word_id: wordId })
  const result = await updateWordImage(
    collectionId,
    wordId,
    INITIAL_WORD_ACTION_STATE,
    form({
      contentVersion: '9007199254740993',
      imageUrl: 'https://images.unsplash.com/photo-test',
    })
  )
  expect(result).toMatchObject({
    status: 'error',
    message: expect.stringContaining('Private changes'),
  })
  expect(invoke).not.toHaveBeenCalled()
  expect(owned.update).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledTimes(1)
})

it.each(['PGRST202', '42501', 'NETWORK'])(
  'does not use paid legacy analysis if following preflight fails with %s',
  async code => {
    queueQuery({ word_id: wordId, dutch_lemma: 'huis', dutch_original: null })
    rpc.mockResolvedValue({ data: null, error: { code } })
    const result = await reanalyzeWord(
      collectionId,
      wordId,
      INITIAL_WORD_ACTION_STATE,
      form({ contentVersion: '3' })
    )
    expect(result.status).toBe('error')
    expect(invoke).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
  }
)

const publicationOperation = (): DictionaryAnalysisClientOperation => {
  const batch = followingBatch([wordId]),
    card = batch.cards[0]
  const command = {
    protocol_version: 2 as const,
    operation_id: '88888888-8888-4888-8888-888888888888',
    entry_id: card.reference.entry_id,
    expected_revision_id: card.reference.revision_id,
    expected_head_sequence: card.head_sequence,
  }
  return {
    user_id: '44444444-4444-4444-8444-444444444444',
    word_id: wordId,
    command,
    submitted: true,
    response: {
      ...command,
      status: 'no-change',
      fence: card.head_sequence,
      quota_charged: true,
      result_sha256: 'a'.repeat(64),
      error_code: null,
      published_revision_id: card.reference.revision_id,
      published_head_sequence: card.head_sequence,
    },
  }
}
it('validates a saved publication with owner-only reads and invalidates all app views even for read-only actors', async () => {
  const operation = publicationOperation()
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: operation.user_id,
    email: null,
    accessLevel: 'read_only',
  })
  await refreshPublishedDictionaryAnalysis(operation)
  expect(rpc).toHaveBeenCalledWith('get_dictionary_effective_content_v2', {
    p_word_ids: [wordId],
  })
  expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout')
  expect(from).not.toHaveBeenCalled()
  expect(invoke).not.toHaveBeenCalled()
})
it.each([
  'foreign-owner',
  'following-disabled',
  'offline',
  'missing-revision',
  'unpublished',
] as const)(
  'does not invalidate views for %s publication reads',
  async kind => {
    const operation = publicationOperation()
    jest.mocked(revalidatePath).mockClear()
    jest.mocked(requireAuthContext).mockResolvedValue({
      userId: operation.user_id,
      email: null,
      accessLevel: 'read_only',
    })
    if (kind === 'foreign-owner')
      operation.user_id = '55555555-5555-4555-8555-555555555555'
    if (kind === 'following-disabled')
      process.env.DICTIONARY_FOLLOWING_ENABLED = 'false'
    if (kind === 'offline')
      rpc.mockResolvedValue({ data: null, error: { code: 'NETWORK' } })
    if (kind === 'missing-revision') {
      const batch = followingBatch([wordId])
      batch.revisions = []
      rpc.mockResolvedValue({ data: batch, error: null })
    }
    if (kind === 'unpublished') operation.response = null
    await expect(
      refreshPublishedDictionaryAnalysis(operation)
    ).rejects.toThrow()
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  }
)
