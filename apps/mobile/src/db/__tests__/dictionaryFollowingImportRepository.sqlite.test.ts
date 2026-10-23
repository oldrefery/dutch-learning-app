import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  createDictionaryFollowingImportClient,
  type FollowingImportRemote,
} from '@woordenaar/domain'
import { dictionaryFollowingImportRepository as journal } from '../dictionaryFollowingImportRepository'
import { createTestDatabase } from './sqlite.fixture'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
  followingContent,
  AT,
} from './dictionaryFollowing.fixture'
import {
  importOperation,
  importReceipt,
  importState,
  importCapability,
  recoveryOperation,
  recoveryReceipt,
  cancellationOperation,
  cancellationReceipt,
  IMPORT_ID,
} from './dictionaryFollowingImport.fixture'

jest.mock('../initDB')
const FAILURE = 'Injected import storage failure'
const owner = { assert: jest.fn(), check: jest.fn(async () => {}) }
const clientFor = (remote: FollowingImportRemote, enabled = () => true) =>
  createDictionaryFollowingImportClient({
    userId: OWNER_A,
    journal,
    remote,
    enabled,
  })

describe('following protocol2 imports, restart and recovery on SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let rpc: jest.Mock
  beforeEach(() => {
    jest.clearAllMocks()
    owner.assert.mockImplementation(() => {})
    owner.check.mockImplementation(async () => {})
    directory = mkdtempSync(join(tmpdir(), 'following-import-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    rpc = jest.fn(async (name: string) => ({
      data:
        name === 'dictionary_content_capability_v2'
          ? importCapability()
          : name === 'read_dictionary_import_recovery_v2'
            ? importState()
            : importReceipt(),
      error: null,
    }))
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  const reopen = () => {
    db.close()
    db = createTestDatabase(path, false)
  }

  it('keeps the exact nonce through lost replies and file reopen; no private row is created locally', async () => {
    const client = clientFor({ rpc })
    const saved = await client.prepare(importOperation(), owner)
    rpc.mockImplementationOnce(async () => ({
      data: importCapability(),
      error: null,
    }))
    rpc.mockImplementationOnce(async () => {
      throw new Error('Lost reply')
    })
    await expect(client.deliver(saved, owner)).rejects.toThrow('Lost reply')
    reopen()
    const restored = (await journal.list(OWNER_A))[0]
    expect(restored).toEqual(saved)
    const receipt = await clientFor({ rpc }).deliver(restored, owner)
    expect(receipt.result).toEqual(importReceipt())
    const calls = rpc.mock.calls.filter(
      ([name]) => name === 'apply_dictionary_import_intent_v2'
    )
    expect(calls).toHaveLength(2)
    expect(calls[0][1]).toEqual(calls[1][1])
    expect(db.prepare('SELECT COUNT(*) AS count FROM words').get()).toEqual({
      count: 0,
    })
  })

  it('saves a receipt before return and does not repeat a finished import even with flags off', async () => {
    const saved = await journal.prepare(importOperation(), owner.assert)
    await journal.save(saved, importReceipt(), owner.assert)
    reopen()
    const done = await clientFor({ rpc }, () => false).deliver(saved, owner)
    expect(done.result).toEqual(importReceipt())
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a changed published head in an otherwise same-ID receipt without consuming its intent', async () => {
    const saved = await journal.prepare(importOperation(), owner.assert)
    await journal.save(saved, importReceipt(), owner.assert)
    await expect(
      journal.save(
        saved,
        { ...importReceipt(), applied_head_sequence: '9007199254740994' },
        owner.assert
      )
    ).rejects.toThrow('immutable')
    expect((await journal.list(OWNER_A))[0].result).toEqual(importReceipt())
  })

  it('allows only an idempotent-bit change on immutable replay', async () => {
    const saved = await journal.prepare(importOperation(), owner.assert)
    const done = await journal.save(saved, importReceipt(), owner.assert)
    expect(
      await journal.save(
        saved,
        { ...importReceipt(), idempotent: true },
        owner.assert
      )
    ).toEqual(done)
  })

  it('keeps owner journals isolated and rejects indexed corruption', async () => {
    await journal.prepare(importOperation(), owner.assert)
    expect(await journal.list(OWNER_B)).toEqual([])
    db.prepare(
      'UPDATE dictionary_following_import_journal SET operation_id = ?'
    ).run(WORD_A)
    await expect(journal.list(OWNER_A)).rejects.toThrow('indexed identity')
  })

  it('rolls back a receipt when the captured owner changes before commit', async () => {
    const saved = await journal.prepare(importOperation(), owner.assert)
    owner.assert
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('Owner changed')
      })
    await expect(
      journal.save(saved, importReceipt(), owner.assert)
    ).rejects.toThrow('Owner changed')
    expect((await journal.list(OWNER_A))[0].result).toBeNull()
  })

  it('retains intent and personal data after a failed SQLite acknowledgement', async () => {
    const saved = await journal.prepare(importOperation(), owner.assert)
    db.exec(
      `CREATE TRIGGER fail_following_ack BEFORE UPDATE ON dictionary_following_import_journal BEGIN SELECT RAISE(ABORT, '${FAILURE}'); END;`
    )
    await expect(
      journal.save(saved, importReceipt(), owner.assert)
    ).rejects.toThrow(FAILURE)
    reopen()
    expect((await journal.list(OWNER_A))[0]).toEqual(saved)
  })

  it('reserves v1 delivery IDs and never modifies their private content, SRS or queues', async () => {
    db.prepare(
      'INSERT INTO words(word_id,user_id,dutch_lemma,part_of_speech,translations,examples,created_at,updated_at,interval_days,repetition_count,next_review_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      WORD_A,
      OWNER_A,
      'legacy house',
      'noun',
      JSON.stringify(followingContent.translations),
      '[]',
      AT,
      AT,
      40,
      12,
      '2026-11-10'
    )
    const legacy = {
      protocol_version: 1,
      operation_id: IMPORT_ID,
      word_id: WORD_A,
      collection_id: null,
      source: { kind: 'private-copy', content: followingContent },
    }
    db.prepare(
      'INSERT INTO dictionary_import_delivery(word_id,user_id,original_intent_json) VALUES (?,?,?)'
    ).run(WORD_A, OWNER_A, JSON.stringify(legacy))
    const before = db.prepare('SELECT * FROM words').all()
    await expect(
      journal.prepare(importOperation(), owner.assert)
    ).rejects.toThrow('already reserved')
    expect(db.prepare('SELECT * FROM words').all()).toEqual(before)
    expect(
      db
        .prepare('SELECT original_intent_json FROM dictionary_import_delivery')
        .get()
    ).toEqual({ original_intent_json: JSON.stringify(legacy) })
  })

  it('recovery uses fresh CAS state and fences the unresolved original after restart', async () => {
    const original = await journal.prepare(importOperation(), owner.assert)
    rpc.mockImplementation(async (name: string) => ({
      data:
        name === 'read_dictionary_import_recovery_v2'
          ? importState(true)
          : recoveryReceipt(),
      error: null,
    }))
    const recovery = await clientFor({ rpc }, () => false).prepare(
      recoveryOperation(true),
      owner
    )
    reopen()
    await expect(clientFor({ rpc }).deliver(original, owner)).rejects.toThrow(
      'fenced'
    )
    const done = await clientFor({ rpc }, () => false).deliver(recovery, owner)
    expect(done.result).toEqual(recoveryReceipt())
    expect(
      rpc.mock.calls.some(
        ([name]) => name === 'apply_dictionary_import_intent_v2'
      )
    ).toBe(false)
  })

  it('does not prepare a recovery for a stale collection or recovery version', async () => {
    await journal.prepare(importOperation(), owner.assert)
    rpc.mockImplementation(async () => ({
      data: { ...importState(true), recovery_version: 1 },
      error: null,
    }))
    await expect(
      clientFor({ rpc }).prepare(recoveryOperation(true), owner)
    ).rejects.toThrow('placement changed')
    expect(await journal.list(OWNER_A)).toHaveLength(1)
  })

  it('blocks new missing-row recovery when capability or local flags were withdrawn', async () => {
    await journal.prepare(importOperation(), owner.assert)
    const recovery = await journal.prepare(recoveryOperation(), owner.assert)
    await expect(
      clientFor({ rpc }, () => false).deliver(recovery, owner)
    ).rejects.toThrow('unavailable')
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_dictionary_import_recovery_v2',
    ])
    expect((await journal.list(OWNER_A))[1].result).toBeNull()
  })

  it('cancels without analysis/import flags and preserves every reserved root after word absence', async () => {
    const original = await journal.prepare(importOperation(), owner.assert)
    const cancelled = await clientFor({ rpc }, () => false).prepare(
      cancellationOperation(),
      owner
    )
    rpc.mockResolvedValue({ data: cancellationReceipt(), error: null })
    await clientFor({ rpc }, () => false).deliver(cancelled, owner)
    reopen()
    await expect(clientFor({ rpc }).deliver(original, owner)).rejects.toThrow(
      'fenced'
    )
    await expect(
      journal.prepare(recoveryOperation(), owner.assert)
    ).rejects.toThrow('cancelled')
    expect(await journal.list(OWNER_A)).toHaveLength(2)
  })

  it('rejects changed root payloads, competing actions and nonempty fresh results', async () => {
    await journal.prepare(importOperation(), owner.assert)
    const recovery = recoveryOperation()
    if (recovery.kind !== 'recover') throw new Error('Unexpected fixture')
    await expect(
      journal.prepare(
        {
          ...recovery,
          request: {
            ...recovery.request,
            original_intent: {
              ...recovery.request.original_intent,
              collection_id: WORD_A,
            },
          },
        },
        owner.assert
      )
    ).rejects.toThrow('original intent changed')
    await journal.prepare(recovery, owner.assert)
    await expect(
      journal.prepare(cancellationOperation(), owner.assert)
    ).rejects.toThrow('pending')
    await expect(
      journal.prepare(
        { ...importOperation(), result: importReceipt() } as never,
        owner.assert
      )
    ).rejects.toThrow('fresh')
  })
})
