import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  createDictionaryFollowingImportClient,
  createDictionaryFollowingTransferClient,
  parseFollowingTransferSession,
  FOLLOWING_TRANSFER_TEXT_LIMIT,
  type FollowingTransferSession,
} from '@woordenaar/domain'
import { dictionaryFollowingTransferRepository as journal } from '../dictionaryFollowingTransferRepository'
import { dictionaryFollowingImportRepository as imports } from '../dictionaryFollowingImportRepository'
import { createTestDatabase } from './sqlite.fixture'
import { OWNER_A, OWNER_B, WORD_A } from './dictionaryFollowing.fixture'
import {
  IMPORT_ID,
  importCapability,
  importReceipt,
} from './dictionaryFollowingImport.fixture'
import {
  TRANSFER_ID,
  transferSession,
  transferRevision,
} from './dictionaryFollowingTransfer.fixture'

jest.mock('../initDB')
const owner = { assert: jest.fn(), check: jest.fn(async () => {}) }
const freshIds = () =>
  jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
const SELECT_SESSIONS = 'SELECT * FROM dictionary_following_transfer_sessions'
const CHANGED = 'Following transfer session is immutable'
const PACK_ID = 'official-pack'
const PACK_VERSION = '1.0.0'
const SELECT_WORDS = 'SELECT * FROM words'
const PACK_UNAVAILABLE = 'official-pack-unavailable'
describe('durable transfer documents and exact selection on file-backed SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let enabled: boolean
  let readPublished: jest.Mock
  let rpc: jest.Mock
  const client = () =>
    createDictionaryFollowingTransferClient({
      userId: OWNER_A,
      journal,
      enabled: () => enabled,
      createId: freshIds(),
      readPublished,
      imports: createDictionaryFollowingImportClient({
        userId: OWNER_A,
        journal: imports,
        enabled: () => enabled,
        remote: { rpc },
      }),
    })
  const reopen = () => {
    db.close()
    db = createTestDatabase(path, false)
  }
  beforeEach(() => {
    jest.clearAllMocks()
    owner.assert.mockImplementation(() => {})
    owner.check.mockImplementation(async () => {})
    directory = mkdtempSync(join(tmpdir(), 'following-transfer-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    enabled = true
    readPublished = jest.fn(async () => [transferRevision])
    rpc = jest.fn(async (name: string) => ({
      data:
        name === 'dictionary_content_capability_v2'
          ? importCapability()
          : importReceipt(),
      error: null,
    }))
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  it('restores shared token/source IDs offline after restart and keeps revoked delivery roots without personal writes', async () => {
    const draft = {
      ...transferSession(),
      shared_collection: {
        share_token: OWNER_B,
        collection_id: OWNER_B,
        word_ids: [WORD_A, IMPORT_ID, OWNER_A, OWNER_B],
      },
    }
    await client().prepare(draft, owner)
    reopen()
    const planned = await client().resolve(TRANSFER_ID, owner)
    expect(planned.plan?.intents[0].intent.source).toMatchObject({
      kind: 'shared-collection',
      share_token: OWNER_B,
      word_id: WORD_A,
    })
    await client().queueEntry(TRANSFER_ID, 0, owner)
    reopen()
    const root = (await imports.list(OWNER_A))[0]
    expect(root.request).toEqual(planned.plan?.intents[0].intent)
    expect(db.prepare(SELECT_WORDS).all()).toEqual([])
    const revoked = 'shared-source-unavailable'
    rpc.mockImplementation(async name =>
      name === 'dictionary_content_capability_v2'
        ? { data: importCapability(), error: null }
        : { data: null, error: new Error(revoked) }
    )
    await expect(client().deliverEntry(TRANSFER_ID, 0, owner)).rejects.toThrow(
      revoked
    )
    reopen()
    expect(await imports.list(OWNER_A)).toEqual([root])
    expect(await journal.list(OWNER_A)).toEqual([planned])
    expect(await journal.list(OWNER_B)).toEqual([])
    await expect(
      client().prepare(
        {
          ...draft,
          shared_collection: {
            ...draft.shared_collection,
            share_token: OWNER_A,
          },
        },
        owner
      )
    ).rejects.toThrow(CHANGED)
    expect(db.prepare(SELECT_WORDS).all()).toEqual([])
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'dictionary_content_capability_v2',
      'apply_dictionary_import_intent_v2',
    ])
  })
  it('restores official provenance after SQLite restart and reserves the same source without personal writes', async () => {
    const draft = {
      ...transferSession(),
      official_pack: {
        pack_id: PACK_ID,
        version: PACK_VERSION,
        manifest_sha256: 'a'.repeat(64),
        entry_ids: ['one', 'two', 'three', 'four'],
      },
    }
    await client().prepare(draft, owner)
    reopen()
    const planned = await client().resolve(TRANSFER_ID, owner)
    expect(planned.plan?.intents[0].intent.source).toMatchObject({
      kind: 'official-pack',
      pack_entry_id: 'one',
      pack_id: PACK_ID,
      version: PACK_VERSION,
    })
    reopen()
    expect(await journal.list(OWNER_A)).toEqual([planned])
    await client().queueEntry(TRANSFER_ID, 0, owner)
    reopen()
    const root = (await imports.list(OWNER_A))[0]
    expect(root.request).toEqual(planned.plan?.intents[0].intent)
    expect(await journal.list(OWNER_B)).toEqual([])
    expect(db.prepare(SELECT_WORDS).all()).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
    await expect(
      client().prepare(
        {
          ...draft,
          official_pack: { ...draft.official_pack, version: '2.0.0' },
        },
        owner
      )
    ).rejects.toThrow(CHANGED)
  })
  it('retains the same official request after withdrawal or lost delivery instead of replaying a private import', async () => {
    const draft = {
      ...transferSession(),
      official_pack: {
        pack_id: PACK_ID,
        version: PACK_VERSION,
        manifest_sha256: 'a'.repeat(64),
        entry_ids: ['one', 'two', 'three', 'four'],
      },
    }
    await client().prepare(draft, owner)
    await client().resolve(TRANSFER_ID, owner)
    await client().queueEntry(TRANSFER_ID, 0, owner)
    const queued = (await imports.list(OWNER_A))[0]
    rpc.mockImplementation(async name =>
      name === 'dictionary_content_capability_v2'
        ? { data: importCapability(), error: null }
        : { data: null, error: new Error(PACK_UNAVAILABLE) }
    )
    await expect(client().deliverEntry(TRANSFER_ID, 0, owner)).rejects.toThrow(
      PACK_UNAVAILABLE
    )
    reopen()
    expect(await imports.list(OWNER_A)).toEqual([queued])
    expect((await journal.list(OWNER_A))[0].official_pack).toEqual(
      draft.official_pack
    )
    expect(db.prepare(SELECT_WORDS).all()).toEqual([])
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'dictionary_content_capability_v2',
      'apply_dictionary_import_intent_v2',
    ])
    expect(rpc.mock.calls[1][1]).toEqual({ p_intent: queued.request })
  })
  it('saves all original content before dependency reads and restores a draft after restart', async () => {
    await client().prepare(transferSession(), owner)
    expect(readPublished).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    reopen()
    expect(await journal.list(OWNER_A)).toEqual([transferSession()])
    expect(await imports.list(OWNER_A)).toEqual([])
    expect(db.prepare(SELECT_WORDS).all()).toEqual([])
  })
  it('atomically saves nonce mapping and private/unresolved review before root reservation', async () => {
    await client().prepare(transferSession(), owner)
    const result = await client().resolve(TRANSFER_ID, owner)
    expect(readPublished).toHaveBeenCalledWith(
      [transferRevision.revision_id],
      owner
    )
    expect(result.plan?.review).toEqual([
      { index: 1, reason: 'content-difference' },
      { index: 2, reason: 'unresolved-reference' },
    ])
    expect(result.document).toEqual(transferSession().document)
    reopen()
    const reloaded = await client().resolve(TRANSFER_ID, owner)
    expect(reloaded).toEqual(result)
    expect(readPublished).toHaveBeenCalledTimes(1)
    await client().queueEntry(TRANSFER_ID, 0, owner)
    expect((await imports.list(OWNER_A))[0].request).toEqual(
      result.plan?.intents[0].intent
    )
    await expect(client().queueEntry(TRANSFER_ID, 1, owner)).rejects.toThrow(
      'requires review'
    )
    expect(rpc).not.toHaveBeenCalled()
  })
  it('requires explicit reservation and retries a lost import reply with the same index/nonce', async () => {
    await client().prepare(transferSession(), owner)
    await client().resolve(TRANSFER_ID, owner)
    await expect(client().deliverEntry(TRANSFER_ID, 0, owner)).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
    await client().queueEntry(TRANSFER_ID, 0, owner)
    rpc
      .mockImplementationOnce(async () => ({
        data: importCapability(),
        error: null,
      }))
      .mockImplementationOnce(async () => {
        throw new Error('Lost reply')
      })
    await expect(client().deliverEntry(TRANSFER_ID, 0, owner)).rejects.toThrow(
      'Lost reply'
    )
    reopen()
    await client().deliverEntry(TRANSFER_ID, 0, owner)
    const requests = rpc.mock.calls.filter(
      ([name]) => name === 'apply_dictionary_import_intent_v2'
    )
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual(requests[1])
    enabled = false
    await client().deliverEntry(TRANSFER_ID, 0, owner)
    expect(
      rpc.mock.calls.filter(
        ([name]) => name === 'apply_dictionary_import_intent_v2'
      )
    ).toHaveLength(2)
    expect((await journal.list(OWNER_A))[0].document).toEqual(
      transferSession().document
    )
  })
  it('keeps an unplanned document after failed reads or flag withdrawal during resolution', async () => {
    await client().prepare(transferSession(), owner)
    readPublished.mockRejectedValueOnce(new Error('Offline'))
    await expect(client().resolve(TRANSFER_ID, owner)).rejects.toThrow(
      'Offline'
    )
    readPublished.mockImplementationOnce(async () => {
      enabled = false
      return [transferRevision]
    })
    await expect(client().resolve(TRANSFER_ID, owner)).rejects.toThrow(
      'unavailable'
    )
    expect(await journal.list(OWNER_A)).toEqual([transferSession()])
    expect(await imports.list(OWNER_A)).toEqual([])
  })
  it('fences owner changes during document commit and rolls back before any dispatch', async () => {
    owner.assert
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('Owner changed')
      })
    await expect(
      journal.prepare(transferSession(), owner.assert)
    ).rejects.toThrow('Owner changed')
    expect(db.prepare(SELECT_SESSIONS).all()).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })
  it('retains the draft after an atomic plan write fails', async () => {
    await journal.prepare(transferSession(), owner.assert)
    db.exec(
      "CREATE TRIGGER reject_transfer BEFORE UPDATE ON dictionary_following_transfer_sessions BEGIN SELECT RAISE(ABORT, 'Storage failed'); END"
    )
    await expect(
      journal.decide(
        transferSession(),
        [transferRevision],
        freshIds(),
        owner.assert
      )
    ).rejects.toThrow('Storage failed')
    expect(await journal.list(OWNER_A)).toEqual([transferSession()])
    expect(await imports.list(OWNER_A)).toEqual([])
  })
  it('rejects changed target/selection/content and competing decisions without overwriting the saved mapping', async () => {
    const input = transferSession()
    await journal.prepare(input, owner.assert)
    for (const value of [
      { ...input, collection_id: OWNER_B },
      { ...input, selected_indexes: [1] },
      {
        ...input,
        document: { ...input.document, collection: { name: 'Changed' } },
      },
    ])
      await expect(journal.prepare(value, owner.assert)).rejects.toThrow(
        CHANGED
      )
    const saved = await journal.decide(
      input,
      [transferRevision],
      freshIds(),
      owner.assert
    )
    await expect(
      journal.decide(input, [], freshIds(), owner.assert)
    ).rejects.toThrow(CHANGED)
    expect(await journal.prepare(input, owner.assert)).toEqual(saved)
    expect(await journal.decide(saved, [], freshIds(), owner.assert)).toEqual(
      saved
    )
  })
  it('isolates two owners and refuses owner/index corruption', async () => {
    await journal.prepare(transferSession(), owner.assert)
    await journal.prepare(
      { ...transferSession(), user_id: OWNER_B },
      owner.assert
    )
    expect((await journal.list(OWNER_B))[0].user_id).toBe(OWNER_B)
    const foreign = { ...transferSession(), user_id: OWNER_B }
    await expect(client().prepare(foreign, owner)).rejects.toThrow(
      'owner mismatch'
    )
    db.prepare(
      'UPDATE dictionary_following_transfer_sessions SET session_id = ? WHERE user_id = ?'
    ).run(IMPORT_ID, OWNER_A)
    await expect(journal.list(OWNER_A)).rejects.toThrow('indexed identity')
  })
  it('fails closed for schema1, duplicate selection, forged decisions and nonce collisions', async () => {
    const input = transferSession()
    expect(() =>
      parseFollowingTransferSession({
        ...input,
        document: { ...input.document, schema_version: 1 },
      })
    ).toThrow()
    expect(() =>
      parseFollowingTransferSession({ ...input, selected_indexes: [0, 0] })
    ).toThrow()
    await journal.prepare(input, owner.assert)
    await expect(
      journal.decide(input, [transferRevision], () => IMPORT_ID, owner.assert)
    ).rejects.toThrow()
    const saved = await journal.decide(
      input,
      [transferRevision],
      freshIds(),
      owner.assert
    )
    const forged = JSON.parse(JSON.stringify(saved)) as FollowingTransferSession
    if (!forged.plan) throw new Error('Missing fixture plan')
    forged.plan.intents[0].index = 1
    expect(() => parseFollowingTransferSession(forged)).toThrow()
    expect(() =>
      parseFollowingTransferSession({
        ...saved,
        plan: { ...saved.plan, review: [] },
      })
    ).toThrow()
  })
  it('never evicts documents and leaves the prior set intact on count/size overflow', async () => {
    for (let i = 0; i < 10; i++)
      await journal.prepare(
        {
          ...transferSession(),
          session_id: `14141414-1414-4141-8141-${String(i).padStart(12, '0')}`,
        },
        owner.assert
      )
    const before = db.prepare(SELECT_SESSIONS).all()
    await expect(
      journal.prepare(transferSession(), owner.assert)
    ).rejects.toThrow('limit')
    expect(db.prepare(SELECT_SESSIONS).all()).toEqual(before)
    db.prepare(
      'UPDATE dictionary_following_transfer_sessions SET payload_json = ? WHERE sequence = 1'
    ).run(
      JSON.stringify({ padding: 'x'.repeat(FOLLOWING_TRANSFER_TEXT_LIMIT) })
    )
    await expect(journal.list(OWNER_A)).rejects.toThrow('limit')
  })
})
