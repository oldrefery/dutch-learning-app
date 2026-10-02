import { supabase, wordService } from '@/lib/supabase'
import {
  dictionaryImportRepository,
  type LocalDictionaryImport,
} from '@/db/dictionaryImportRepository'
import { createMockWord } from '@/__tests__/helpers/factories'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import {
  dictionaryImportSync,
  DictionaryImportConflictError,
} from '../dictionaryImportSync'

jest.mock('@/lib/supabase')
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
jest.mock('@/db/dictionaryImportRepository', () => ({
  dictionaryImportRepository: {
    getPending: jest.fn(),
    acceptReceipt: jest.fn(),
    markError: jest.fn(),
    retryConflict: jest.fn(),
  },
}))
const USER = '10000000-0000-4000-8000-000000000001'
const WORD = '20000000-0000-4000-8000-000000000001'
const UNAVAILABLE_SOURCE = 'official-pack-unavailable'
const intent: LocalDictionaryImport['intent'] = {
  protocol_version: 1,
  operation_id: '40000000-0000-4000-8000-000000000001',
  word_id: WORD,
  collection_id: '30000000-0000-4000-8000-000000000001',
  source: {
    kind: 'private-copy',
    content: wordToDictionaryContent(createMockWord()),
  },
}
const pending: LocalDictionaryImport = {
  userId: USER,
  intent,
  status: 'pending',
  existingWordId: null,
  lastError: null,
}
const receipt = {
  protocol_version: 1,
  operation_id: intent.operation_id,
  word_id: WORD,
  outcome: 'inserted',
  existing_word_id: null,
  idempotent: true,
}
const response = (data: unknown) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
})

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(supabase.auth, { getUser: jest.fn() })
  jest
    .mocked(supabase.auth.getUser)
    .mockResolvedValue({ data: { user: { id: USER } }, error: null } as Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >)
  jest
    .mocked(dictionaryImportRepository.getPending)
    .mockResolvedValue([pending])
  jest.mocked(dictionaryImportRepository.acceptReceipt).mockResolvedValue()
  jest.mocked(dictionaryImportRepository.markError).mockResolvedValue()
  jest.mocked(supabase.rpc).mockResolvedValue(response(receipt))
})

it('replays the immutable persisted input after a lost response', async () => {
  jest.mocked(supabase.rpc).mockRejectedValueOnce(new Error('Lost reply'))
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow('Lost reply')
  expect(dictionaryImportRepository.acceptReceipt).not.toHaveBeenCalled()
  await expect(dictionaryImportSync.push(USER)).resolves.toBe(1)
  expect(supabase.rpc).toHaveBeenNthCalledWith(
    1,
    'apply_dictionary_import_intent_v1',
    { p_intent: intent }
  )
  expect(supabase.rpc).toHaveBeenNthCalledWith(
    2,
    'apply_dictionary_import_intent_v1',
    { p_intent: intent }
  )
  expect(dictionaryImportRepository.acceptReceipt).toHaveBeenCalledWith(
    USER,
    intent,
    receipt
  )
})

it('does not acknowledge a successful remote write after account change', async () => {
  jest.mocked(supabase.rpc).mockImplementationOnce(() => {
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'other-owner' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    return response(receipt) as unknown as ReturnType<typeof supabase.rpc>
  })
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(
    'Authentication changed'
  )
  expect(dictionaryImportRepository.acceptReceipt).not.toHaveBeenCalled()
})

it('records a durable identity conflict and never acknowledges it as an import success', async () => {
  const conflict = {
    ...receipt,
    outcome: 'identity-conflict',
    existing_word_id: '20000000-0000-4000-8000-000000000002',
  }
  jest.mocked(supabase.rpc).mockResolvedValue(response(conflict))
  await expect(dictionaryImportSync.push(USER)).rejects.toBeInstanceOf(
    DictionaryImportConflictError
  )
  expect(dictionaryImportRepository.acceptReceipt).toHaveBeenCalledWith(
    USER,
    intent,
    conflict
  )
  jest.mocked(dictionaryImportRepository.getPending).mockResolvedValue([
    {
      ...pending,
      status: 'conflict',
      existingWordId: conflict.existing_word_id,
    },
  ])
  jest.mocked(supabase.rpc).mockClear()
  await expect(dictionaryImportSync.push(USER)).rejects.toBeInstanceOf(
    DictionaryImportConflictError
  )
  expect(supabase.rpc).not.toHaveBeenCalled()
})

it('retains the intent when the receipt is malformed or the source/target is unavailable', async () => {
  jest
    .mocked(supabase.rpc)
    .mockResolvedValue(response({ ...receipt, word_id: 'foreign' }))
  await expect(dictionaryImportSync.push(USER)).rejects.toThrow(
    'Invalid dictionary import receipt'
  )
  expect(dictionaryImportRepository.acceptReceipt).not.toHaveBeenCalled()
  jest.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: {
      message: UNAVAILABLE_SOURCE,
      code: 'P0001',
      details: '',
      hint: '',
      name: 'PostgrestError',
    },
    count: null,
    status: 400,
    statusText: 'Error',
  })
  await expect(dictionaryImportSync.push(USER)).rejects.toMatchObject({
    message: UNAVAILABLE_SOURCE,
  })
  expect(dictionaryImportRepository.markError).toHaveBeenCalledWith(
    USER,
    intent.operation_id,
    UNAVAILABLE_SOURCE
  )
  expect(dictionaryImportRepository.acceptReceipt).not.toHaveBeenCalled()
})

it('allows a deliberate retry with the same personal ID only after the duplicate is absent', async () => {
  jest
    .mocked(dictionaryImportRepository.getPending)
    .mockResolvedValue([{ ...pending, status: 'conflict' }])
  jest
    .mocked(wordService.checkWordExists)
    .mockResolvedValueOnce({ word_id: 'another-card' } as Awaited<
      ReturnType<typeof wordService.checkWordExists>
    >)
  await expect(
    dictionaryImportSync.retryConflict(USER, WORD)
  ).rejects.toBeInstanceOf(DictionaryImportConflictError)
  expect(dictionaryImportRepository.retryConflict).not.toHaveBeenCalled()
  jest.mocked(wordService.checkWordExists).mockResolvedValueOnce(null)
  await expect(
    dictionaryImportSync.retryConflict(USER, WORD)
  ).resolves.toBeUndefined()
  expect(dictionaryImportRepository.retryConflict).toHaveBeenCalledWith(
    USER,
    intent,
    expect.any(String)
  )
  expect(supabase.rpc).not.toHaveBeenCalled()
})
