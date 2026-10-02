/** @jest-environment node */
import { revalidatePath } from 'next/cache'
import { adoptDictionaryRevision } from './actions'
import { INITIAL_WORD_ACTION_STATE as initial } from '@/features/words/form-state'
import {
  collectionId,
  wordId,
  userId,
  form,
  from,
  rpc,
  queueQuery,
  setupActions,
} from '@/features/words/__tests__/action-fixture'
import { effectiveCard } from './__fixtures__/cards'

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
const candidate = {
  entry_id: effectiveCard().reference.entry_id,
  revision_id: '33333333-3333-4333-8333-333333333333',
}
const overrides = {
  image_url: { op: 'set', value: 'https://images.unsplash.com/private' },
}
beforeEach(() => {
  setupActions()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  rpc.mockImplementation(
    (name: string, args: { p_command?: { operation_id: string } }) =>
      Promise.resolve(
        name === 'get_dictionary_effective_content_v1'
          ? {
              data: { protocol_version: 1, cards: [effectiveCard(wordId)] },
              error: null,
            }
          : {
              data: {
                protocol_version: 1,
                operation_id: args.p_command!.operation_id,
                word_id: wordId,
                kind: 'adopt-revision',
                content_version: 4,
              },
              error: null,
            }
      )
  )
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})
const run = (revisionId = candidate.revision_id) =>
  adoptDictionaryRevision(
    collectionId,
    wordId,
    initial,
    form({ revisionId, contentVersion: '3' })
  )

it('adopts only the explicitly displayed newer revision of the same meaning and preserves overrides', async () => {
  const word = queueQuery({ word_id: wordId })
  const head = queueQuery(candidate)
  queueQuery({
    word_id: wordId,
    user_id: userId,
    content_version: 3,
    overrides,
  })
  expect(await run()).toMatchObject({ status: 'success' })
  expect(word.eq).toHaveBeenCalledWith('user_id', userId)
  expect(word.eq).toHaveBeenCalledWith('collection_id', collectionId)
  expect(head.eq).toHaveBeenCalledWith('entry_id', candidate.entry_id)
  expect(rpc.mock.calls[1][1].p_command).toMatchObject({
    word_id: wordId,
    kind: 'adopt-revision',
    expected_content_version: 3,
    reference: candidate,
    overrides,
  })
  expect(word.update).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout')
})

it('rejects a changed revision head instead of silently adopting a different update', async () => {
  queueQuery({ word_id: wordId })
  queueQuery(candidate)
  expect(await run('44444444-4444-4444-8444-444444444444')).toMatchObject({
    status: 'error',
    message: expect.stringContaining('Reload'),
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(revalidatePath).not.toHaveBeenCalled()
})

it('does not inspect dictionary data for a foreign, moved or deleted card', async () => {
  queueQuery(null)
  expect(await run()).toMatchObject({ status: 'error' })
  expect(rpc).not.toHaveBeenCalled()
})

it('keeps adoption unavailable while the client flag is off', async () => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  expect(await run()).toMatchObject({ status: 'error' })
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})
