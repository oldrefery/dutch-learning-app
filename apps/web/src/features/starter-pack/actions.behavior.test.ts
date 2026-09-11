/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { importStarterPack } from './actions'
import { INITIAL_STARTER_PACK_IMPORT_STATE } from './form-state'
import {
  loadOfficialStarterPack,
  NEW_STARTER_PACK_COLLECTION_ID,
} from './starter-pack-domain'

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/fetch-all-rows', () => ({
  fetchAllRows: jest.fn(),
}))

const USER_ID = 'official-content-test-user'
const COLLECTION_ID = '11111111-1111-4111-8111-111111111111'
const manifest = loadOfficialStarterPack()
const entry = manifest.entries[0]
const importedRow = {
  article: entry.article,
  collection_id: COLLECTION_ID,
  dutch_lemma: entry.dutchLemma,
  part_of_speech: entry.partOfSpeech,
}

const form = (targetCollectionId = NEW_STARTER_PACK_COLLECTION_ID) => {
  const data = new FormData()
  data.set('packId', manifest.packId)
  data.set('packVersion', manifest.version)
  data.set('targetCollectionId', targetCollectionId)
  data.append('entryIds', entry.entryId)
  return data
}

const createQuery = () => {
  const query = {
    delete: jest.fn(),
    eq: jest.fn(),
    insert: jest.fn(),
    maybeSingle: jest.fn(),
    select: jest.fn(),
    single: jest.fn(),
    error: null,
  }
  query.delete.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.single.mockResolvedValue({
    data: { collection_id: COLLECTION_ID, name: manifest.title },
    error: null,
  })
  query.maybeSingle.mockResolvedValue({
    data: { collection_id: COLLECTION_ID, name: 'Existing collection' },
    error: null,
  })
  return query
}

describe('official content import persistence', () => {
  let query: ReturnType<typeof createQuery>
  let rpc: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    query = createQuery()
    rpc = jest.fn().mockResolvedValue({ data: [importedRow], error: null })
    jest.mocked(requireAuthContext).mockResolvedValue({
      userId: USER_ID,
      email: 'fixture@example.com',
      accessLevel: 'full_access',
    })
    jest.mocked(createClient).mockResolvedValue({
      from: jest.fn().mockReturnValue(query),
      rpc,
    } as never)
    jest.mocked(fetchAllRows).mockResolvedValue({ data: [], error: null })
  })

  it('reports the verified count from the target collection', async () => {
    jest
      .mocked(fetchAllRows)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [importedRow], error: null })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form()
    )

    expect(result).toMatchObject({
      status: 'success',
      importedCount: 1,
      collectionId: COLLECTION_ID,
    })
    expect(query.delete).not.toHaveBeenCalled()
    expect(jest.mocked(revalidatePath)).toHaveBeenCalledTimes(3)
  })

  it('treats a lost RPC response as success when the requested word committed', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'network lost' } })
    jest
      .mocked(fetchAllRows)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [importedRow], error: null })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form()
    )

    expect(result).toMatchObject({ status: 'success', importedCount: 1 })
    expect(query.delete).not.toHaveBeenCalled()
  })

  it('removes a confirmed empty new collection after an RPC failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rolled back' } })
    jest
      .mocked(fetchAllRows)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form()
    )

    expect(result.status).toBe('error')
    expect(query.delete).toHaveBeenCalledTimes(1)
    expect(query.eq).toHaveBeenCalledWith('collection_id', COLLECTION_ID)
    expect(query.eq).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('keeps the collection when an ambiguous failure cannot be verified', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'network lost' } })
    jest
      .mocked(fetchAllRows)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form()
    )

    expect(result).toMatchObject({
      status: 'error',
      collectionId: COLLECTION_ID,
    })
    expect(result.message).toContain('kept')
    expect(query.delete).not.toHaveBeenCalled()
  })

  it('does not delete or modify an existing target after a failed import', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rolled back' } })
    jest
      .mocked(fetchAllRows)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form(COLLECTION_ID)
    )

    expect(result.status).toBe('error')
    expect(query.delete).not.toHaveBeenCalled()
  })

  it('requires read-only accounts to choose an existing collection', async () => {
    jest.mocked(requireAuthContext).mockResolvedValue({
      userId: USER_ID,
      email: 'read-only@example.com',
      accessLevel: 'read_only',
    })
    jest.mocked(fetchAllRows).mockResolvedValueOnce({ data: [], error: null })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form()
    )

    expect(result).toEqual({
      status: 'error',
      message: 'Read-only accounts must import into an existing collection.',
    })
    expect(query.insert).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('skips a repeated submit once the word exists without creating an empty collection', async () => {
    jest.mocked(fetchAllRows).mockResolvedValueOnce({
      data: [importedRow],
      error: null,
    })

    const result = await importStarterPack(
      INITIAL_STARTER_PACK_IMPORT_STATE,
      form()
    )

    expect(result).toEqual({
      status: 'error',
      message: 'The selected words already exist in your collections.',
    })
    expect(query.insert).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
