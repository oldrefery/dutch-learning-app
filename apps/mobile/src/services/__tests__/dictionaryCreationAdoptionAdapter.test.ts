import { supabase } from '@/lib/supabase'
import { dictionaryCreationRepository as journal } from '@/db/dictionaryCreationRepository'
import { dictionaryFollowingImportRepository as imports } from '@/db/dictionaryFollowingImportRepository'
import {
  loadFollowingImport as loadImported,
  loadFollowingExistingCard as loadExisting,
} from '../dictionaryFollowingImportHydration'
import { createMobileCreationAdoptionService } from '../dictionaryCreationAdoptionService'
import {
  CREATION_OWNER as OWNER,
  CREATION_OTHER as OTHER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationPublishedFixture as published,
  creationAdoptionFixture as adoption,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'
import {
  parseFollowingImportRows,
  type DictionaryCreationJournalRow,
  type DictionaryAnalysisAuth,
} from '@woordenaar/domain'
jest.mock('@/db/dictionaryCreationRepository', () => ({
  dictionaryCreationRepository: { read: jest.fn(), save: jest.fn() },
}))
jest.mock('@/db/dictionaryFollowingImportRepository', () => ({
  dictionaryFollowingImportRepository: { list: jest.fn() },
}))
jest.mock('../dictionaryFollowingImportHydration', () => ({
  loadFollowingImport: jest.fn(),
  loadFollowingExistingCard: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))
const setupSdk = () => {
  Object.assign(supabase, { auth, rpc })
}
const makeService = (signal: AbortSignal) =>
  createMobileCreationAdoptionService(OWNER, () => {}, signal)
let row: DictionaryCreationJournalRow
let listeners: Set<Parameters<DictionaryAnalysisAuth['onAuthStateChange']>[0]>
let current: string
const auth: DictionaryAnalysisAuth = {
  getUser: async () => ({ data: { user: { id: current } }, error: null }),
  onAuthStateChange: listener => {
    listeners.add(listener)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(listener)
          },
        },
      },
    }
  },
}
const state = () => ({
  protocol_version: 2,
  original_operation_id: id(7),
  word_id: id(8),
  recovery_version: 0,
  inserted_once: true,
  state: 'active',
  collection_id: id(9),
})
const abortSignal = jest.fn(async (signal: AbortSignal) => {
  expect(signal.aborted).toBe(false)
  return { data: state(), error: null }
})
const rpc = jest.fn(() => ({ abortSignal }))
const controller = () => new AbortController()
const setupRow = () => {
  const draft = prepared(initial())
  row = adoption(
    published({ ...draft, session: { ...draft.session, submitted: true } })
  )
  row.adoption = {
    ...row.adoption!,
    submitted: true,
    response: {
      protocol_version: 2,
      operation_id: id(7),
      word_id: id(8),
      idempotent: false,
      outcome: 'inserted',
      existing_word_id: null,
      reference: { entry_id: id(5), revision_id: id(6) },
      applied_reference: { entry_id: id(5), revision_id: id(6) },
      applied_head_sequence: '9007199254740995',
    },
  }
}
beforeEach(() => {
  jest.clearAllMocks()
  current = OWNER
  listeners = new Set()
  setupRow()
  jest.mocked(journal.read).mockImplementation(async () => row)
  jest.mocked(journal.save).mockImplementation(async (_old, next) => next)
  jest.mocked(imports.list).mockImplementation(async () =>
    parseFollowingImportRows(
      [
        {
          user_id: OWNER,
          kind: 'import',
          request: row.adoption!.request,
          result: row.adoption!.response,
        },
      ],
      OWNER
    )
  )
  abortSignal.mockImplementation(async () => ({ data: state(), error: null }))
  setupSdk()
})
afterEach(() => {
  expect(listeners.size).toBe(0)
})
it('constructs without SDK, RPC, journal or cache access', () => {
  makeService(controller().signal)
  expect(rpc).not.toHaveBeenCalled()
  expect(journal.read).not.toHaveBeenCalled()
  expect(loadImported).not.toHaveBeenCalled()
})
it('uses the exact saved intent and attaches the captured lifetime to the RPC builder', async () => {
  await makeService(controller().signal).check(row)
  expect(rpc).toHaveBeenCalledWith('read_dictionary_import_recovery_v2', {
    p_intent: row.adoption!.request,
  })
  expect(abortSignal).toHaveBeenCalledTimes(1)
  expect(abortSignal.mock.calls[0][0].aborted).toBe(true)
})
it('latches A-B-A during SDK reply and aborts the actual RPC signal', async () => {
  abortSignal.mockImplementation(async signal => {
    expect(signal.aborted).toBe(false)
    current = OTHER
    listeners.forEach(listener =>
      listener('SIGNED_IN', { user: { id: OTHER } })
    )
    current = OWNER
    listeners.forEach(listener =>
      listener('SIGNED_IN', { user: { id: OWNER } })
    )
    expect(signal.aborted).toBe(true)
    return { data: state(), error: null }
  })
  await expect(makeService(controller().signal).check(row)).rejects.toThrow(
    'Authentication changed'
  )
  expect(journal.save).toHaveBeenCalledTimes(1)
  expect(loadImported).not.toHaveBeenCalled()
})
it('delegates loading to the existing guarded personal/shared loader without any apply RPC', async () => {
  await makeService(controller().signal).load(row)
  expect(loadImported).toHaveBeenCalledTimes(1)
  expect(loadExisting).not.toHaveBeenCalled()
  expect(rpc.mock.calls.map(() => 'state')).toHaveLength(1)
  expect(abortSignal).toHaveBeenCalledTimes(1)
})
