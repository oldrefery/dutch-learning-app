import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import {
  createDictionaryAnalysisRemoteClient,
  matchDictionaryAnalysisResponse,
  parseDictionaryAnalysisClientOperation,
  type DictionaryAnalysisRemote,
} from '@woordenaar/domain'
import { dictionaryAnalysisRepository as journal } from '../dictionaryAnalysisRepository'
import { dictionaryFollowingRepository as following } from '../dictionaryFollowingRepository'
import { createTestDatabase } from './sqlite.fixture'
import {
  analysisIntent,
  analysisReceipt,
  ANALYSIS_ID,
  NEXT_ANALYSIS_ID,
} from './dictionaryAnalysis.fixture'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
  AT,
  followingBatch,
} from './dictionaryFollowing.fixture'

jest.mock('../initDB')
const AUTH_CHANGED = 'Authentication changed'
const SYNTHETIC_TOKEN = 'synthetic-token'
const OWNER_MISMATCH = 'owner mismatch'
const owner = { assert: jest.fn(), check: jest.fn(async () => {}) }
const WORDS_QUERY = 'SELECT * FROM words ORDER BY word_id'
const NO_CHANGE = 'no-change'
const UNKNOWN = 'provider-outcome-unknown'
const noop = () => {}

describe('durable shared analysis intent and receipt on file-backed SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let remote: jest.Mocked<DictionaryAnalysisRemote>
  let refresh: jest.Mock
  let enabled: boolean
  const client = () =>
    createDictionaryAnalysisRemoteClient({
      userId: OWNER_A,
      journal,
      remote,
      enabled: () => enabled,
      refresh,
    })
  const reopened = () => {
    db.close()
    db = createTestDatabase(path, false)
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    owner.assert.mockImplementation(noop)
    owner.check.mockImplementation(async () => {})
    directory = mkdtempSync(join(tmpdir(), 'dictionary-analysis-journal-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    db.prepare(
      `INSERT INTO words(word_id,user_id,dutch_lemma,translations,next_review_date,created_at,updated_at,interval_days,repetition_count,easiness_factor)
      VALUES (?,?,'huis','{}','2026-10-11',?,?,7,8,2.35)`
    ).run(WORD_A, OWNER_A, AT, AT)
    const hydration = await following.prepareHydration(OWNER_A, [WORD_A])
    await following.commitHydration(hydration, [followingBatch()], noop)
    enabled = true
    refresh = jest.fn(async () => {})
    remote = {
      rpc: jest.fn(async name => ({
        data:
          name === 'dictionary_content_capability_v2'
            ? {
                dictionary_content_protocol: 2,
                read_protocol_versions: [1, 2],
                command_protocol_versions: [1, 2],
                following_enabled: true,
                shared_analysis_enabled: true,
              }
            : name === 'dictionary_analysis_actor_v1'
              ? { protocol_version: 1, actor_id: OWNER_A, may_analyze: true }
              : analysisReceipt(),
        error: null,
      })),
      getSession: jest.fn(async () => ({
        data: {
          session: { user: { id: OWNER_A }, access_token: SYNTHETIC_TOKEN },
        },
        error: null,
      })),
      invoke: jest.fn<
        ReturnType<DictionaryAnalysisRemote['invoke']>,
        Parameters<DictionaryAnalysisRemote['invoke']>
      >(async () => ({ data: analysisReceipt(), error: null })),
    }
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('saves the exact operation and claim before dispatch; publication leaves words/SRS/queues untouched', async () => {
    const words = db.prepare(WORDS_QUERY).all()
    remote.invoke.mockImplementation(async (name, options) => {
      expect((await journal.read(OWNER_A, WORD_A))?.submitted).toBe(true)
      expect(name).toBe('dictionary-analysis')
      expect(options).toEqual({
        body: analysisIntent().command,
        headers: { Authorization: 'Bearer synthetic-token' },
      })
      return { data: analysisReceipt(), error: null }
    })
    const saved = await client().submit(analysisIntent(), owner)
    expect(saved.response).toEqual(analysisReceipt())
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(db.prepare(WORDS_QUERY).all()).toEqual(words)
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual([])
    expect(
      db.prepare('SELECT * FROM dictionary_content_commands').all()
    ).toEqual([])
    expect(JSON.stringify(await journal.read(OWNER_A, WORD_A))).not.toContain(
      SYNTHETIC_TOKEN
    )
    reopened()
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(saved)
    expect(await journal.read(OWNER_B, WORD_A)).toBeNull()
  })

  it('archives a freshly confirmed finished receipt and submits a new nonce once, retaining history after restart', async () => {
    const words = db.prepare(WORDS_QUERY).all()
    remote.invoke.mockResolvedValueOnce({
      data: analysisReceipt(NO_CHANGE),
      error: null,
    })
    const previous = await client().submit(analysisIntent(), owner)
    const next = analysisIntent()
    next.command.operation_id = NEXT_ANALYSIS_ID
    remote.rpc.mockResolvedValueOnce({
      data: analysisReceipt(NO_CHANGE),
      error: null,
    })
    remote.invoke.mockResolvedValueOnce({
      data: { ...analysisReceipt('accepted'), operation_id: NEXT_ANALYSIS_ID },
      error: null,
    })
    const result = await client().nextAttempt(previous, next, owner)
    expect(result.command.operation_id).toBe(NEXT_ANALYSIS_ID)
    expect(remote.invoke).toHaveBeenCalledTimes(2)
    expect(remote.invoke.mock.calls[1][1].body).toEqual(next.command)
    expect(await journal.history(OWNER_A, WORD_A)).toEqual([previous])
    expect(await journal.history(OWNER_B, WORD_A)).toEqual([])
    reopened()
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(result)
    expect(await journal.history(OWNER_A, WORD_A)).toEqual([previous])
    expect(db.prepare(WORDS_QUERY).all()).toEqual(words)
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual([])
  })

  it.each([null, 'accepted', 'dispatching', 'validating', UNKNOWN] as const)(
    'never frees a submitted slot on unresolved authoritative outcome %s',
    async status => {
      await journal.prepare(analysisIntent(), noop)
      await journal.claim(analysisIntent(), noop)
      const previous = (await journal.read(OWNER_A, WORD_A))!
      const next = analysisIntent()
      next.command.operation_id = NEXT_ANALYSIS_ID
      remote.rpc.mockResolvedValue({
        data: status ? analysisReceipt(status) : null,
        error: null,
      })
      await expect(client().nextAttempt(previous, next, owner)).rejects.toThrow(
        'unresolved'
      )
      expect(await journal.read(OWNER_A, WORD_A)).toEqual(previous)
      expect(await journal.history(OWNER_A, WORD_A)).toEqual([])
      expect(remote.invoke).not.toHaveBeenCalled()
    }
  )

  it('reconciles quarantine through same-result receipt reads without redispatch before an explicit next attempt', async () => {
    remote.invoke.mockResolvedValueOnce({
      data: analysisReceipt(UNKNOWN),
      error: null,
    })
    const previous = await client().submit(analysisIntent(), owner)
    enabled = false
    remote.rpc.mockResolvedValue({
      data: analysisReceipt(NO_CHANGE),
      error: null,
    })
    const confirmed = await client().recover(OWNER_A, WORD_A, owner)
    expect(confirmed?.response).toMatchObject({ status: 'no-change' })
    expect(await journal.history(OWNER_A, WORD_A)).toEqual([])
    const next = analysisIntent()
    next.command.operation_id = NEXT_ANALYSIS_ID
    await expect(client().nextAttempt(confirmed!, next, owner)).rejects.toThrow(
      'unavailable'
    )
    expect(remote.invoke).toHaveBeenCalledTimes(1)
    expect(previous.response).toMatchObject({ status: UNKNOWN })
  })

  it('rolls back history and replacement on owner change or stale head, and never reuses archived IDs', async () => {
    remote.invoke.mockResolvedValueOnce({
      data: analysisReceipt(NO_CHANGE),
      error: null,
    })
    const previous = await client().submit(analysisIntent(), owner)
    const next = analysisIntent()
    next.command.operation_id = NEXT_ANALYSIS_ID
    let checks = 0
    await expect(
      journal.replace(previous, next, () => {
        if (++checks === 3) throw new Error(AUTH_CHANGED)
      })
    ).rejects.toThrow(AUTH_CHANGED)
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(previous)
    expect(await journal.history(OWNER_A, WORD_A)).toEqual([])
    const stale = {
      ...next,
      command: { ...next.command, expected_head_sequence: '9007199254740994' },
    }
    await expect(journal.replace(previous, stale, noop)).rejects.toThrow(
      'Sync shared dictionary'
    )
    await journal.replace(previous, next, noop)
    await expect(journal.replace(previous, next, noop)).rejects.toThrow(
      'changed'
    )
    await expect(
      journal.prepare({ ...analysisIntent(), word_id: OWNER_B }, noop)
    ).rejects.toThrow('reserved')
    expect(() =>
      db
        .prepare(
          'INSERT INTO dictionary_analysis_client_operations(user_id,word_id,operation_id,operation_json) VALUES (?, ?, ?, ?)'
        )
        .run(OWNER_A, OWNER_B, ANALYSIS_ID, JSON.stringify(analysisIntent()))
    ).toThrow('reserved')
    expect(await journal.history(OWNER_A, WORD_A)).toEqual([previous])
  })
  it('keeps newest-first immutable history across multiple explicit replacements', async () => {
    await journal.prepare(analysisIntent(), noop)
    await journal.claim(analysisIntent(), noop)
    const first = await journal.save(
      analysisIntent(),
      analysisReceipt(NO_CHANGE),
      noop
    )
    const secondIntent = {
      ...analysisIntent(),
      command: { ...analysisIntent().command, operation_id: NEXT_ANALYSIS_ID },
    }
    await journal.replace(first, secondIntent, noop)
    await journal.claim(secondIntent, noop)
    const second = await journal.save(
      secondIntent,
      { ...analysisReceipt(NO_CHANGE), operation_id: NEXT_ANALYSIS_ID },
      noop
    )
    const third = {
      ...secondIntent,
      command: {
        ...secondIntent.command,
        operation_id: 'efefefef-efef-4fef-8fef-efefefefefef',
      },
    }
    await journal.replace(second, third, noop)
    reopened()
    expect(await journal.history(OWNER_A, WORD_A)).toEqual([second, first])
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(third)
  })
  it.each(['older-head', 'wrong-revision'] as const)(
    'keeps a published receipt and history untouched on %s next intent',
    async scenario => {
      await journal.prepare(analysisIntent(), noop)
      await journal.claim(analysisIntent(), noop)
      const previous = await journal.save(
        analysisIntent(),
        analysisReceipt(),
        noop
      )
      const receipt = analysisReceipt()
      const candidate = {
        ...analysisIntent(),
        command: {
          ...analysisIntent().command,
          operation_id: NEXT_ANALYSIS_ID,
          expected_head_sequence:
            scenario === 'older-head'
              ? analysisIntent().command.expected_head_sequence
              : receipt.published_head_sequence!,
        },
      }
      await expect(journal.replace(previous, candidate, noop)).rejects.toThrow(
        'Refresh shared content'
      )
      expect(await journal.read(OWNER_A, WORD_A)).toEqual(previous)
      expect(await journal.history(OWNER_A, WORD_A)).toEqual([])
    }
  )
  it('applies history capacity without evicting a finished receipt or reserving a new nonce', async () => {
    await journal.prepare(analysisIntent(), noop)
    await journal.claim(analysisIntent(), noop)
    const previous = await journal.save(
      analysisIntent(),
      analysisReceipt(NO_CHANGE),
      noop
    )
    for (let index = 0; index < 100; index++) {
      const operationId = `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, '0')}`
      const archived = {
        ...previous,
        command: { ...previous.command, operation_id: operationId },
        response: { ...analysisReceipt(NO_CHANGE), operation_id: operationId },
      }
      db.prepare(
        'INSERT INTO dictionary_analysis_client_history(user_id,word_id,operation_id,operation_json) VALUES (?, ?, ?, ?)'
      ).run(OWNER_A, WORD_A, operationId, JSON.stringify(archived))
    }
    const candidate = {
      ...analysisIntent(),
      command: { ...analysisIntent().command, operation_id: NEXT_ANALYSIS_ID },
    }
    await expect(journal.replace(previous, candidate, noop)).rejects.toThrow(
      'limit'
    )
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(previous)
    expect(await journal.history(OWNER_A, WORD_A)).toHaveLength(100)
  })

  it('recovers a lost reply after restart and flag withdrawal using only the actor receipt RPC', async () => {
    remote.invoke.mockRejectedValue(new Error('Connection lost'))
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      'Connection lost'
    )
    reopened()
    enabled = false
    remote.rpc.mockClear()
    const saved = await client().recover(OWNER_A, WORD_A, owner)
    expect(saved?.response).toEqual(analysisReceipt())
    expect(remote.invoke).toHaveBeenCalledTimes(1)
    expect(remote.rpc.mock.calls).toEqual([
      ['get_dictionary_analysis_operation_v2', { p_operation: ANALYSIS_ID }],
    ])
  })

  it('retains a claim even when no server receipt exists; another submit never dispatches', async () => {
    remote.invoke.mockResolvedValue({
      data: null,
      error: new Error('Unavailable'),
    })
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      'read the existing operation'
    )
    remote.rpc.mockResolvedValue({ data: null, error: null })
    const next = analysisIntent()
    next.command.operation_id = NEXT_ANALYSIS_ID
    expect((await client().submit(next, owner)).command.operation_id).toBe(
      ANALYSIS_ID
    )
    expect(remote.invoke).toHaveBeenCalledTimes(1)
    expect((await journal.read(OWNER_A, WORD_A))?.submitted).toBe(true)
  })

  it('resumes an unclaimed intent after restart only on explicit submit, retaining its original ID', async () => {
    await journal.prepare(analysisIntent(), noop)
    reopened()
    remote.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect((await client().recover(OWNER_A, WORD_A, owner))?.submitted).toBe(
      false
    )
    const candidate = analysisIntent()
    candidate.command.operation_id = NEXT_ANALYSIS_ID
    expect((await client().submit(candidate, owner)).command.operation_id).toBe(
      ANALYSIS_ID
    )
    expect(remote.invoke).toHaveBeenCalledTimes(1)
  })

  it('retains the receipt before a cache refresh failure; recovery reads and refreshes without dispatch', async () => {
    refresh.mockRejectedValueOnce(new Error('Refresh offline'))
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      'Refresh offline'
    )
    expect((await journal.read(OWNER_A, WORD_A))?.response).toEqual(
      analysisReceipt()
    )
    reopened()
    await client().recover(OWNER_A, WORD_A, owner)
    expect(remote.invoke).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it.each([false, true])(
    'rejects unavailable fresh submission before reserving an intent (flag enabled: %s)',
    async flag => {
      enabled = flag
      remote.rpc.mockResolvedValue({
        data: {
          dictionary_content_protocol: 2,
          read_protocol_versions: [1, 2],
          command_protocol_versions: [1],
          following_enabled: true,
          shared_analysis_enabled: false,
        },
        error: null,
      })
      await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
        'unavailable'
      )
      expect(await journal.read(OWNER_A, WORD_A)).toBeNull()
      expect(remote.invoke).not.toHaveBeenCalled()
      if (!flag) expect(remote.rpc).not.toHaveBeenCalled()
    }
  )

  it('checks the owner returned with the session before endpoint dispatch', async () => {
    remote.getSession.mockResolvedValue({
      data: {
        session: { user: { id: OWNER_B }, access_token: 'foreign-token' },
      },
      error: null,
    })
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      'authentication'
    )
    expect(remote.invoke).not.toHaveBeenCalled()
    expect((await journal.read(OWNER_A, WORD_A))?.submitted).toBe(true)
  })

  it('stops endpoint dispatch if the feature flag is withdrawn while obtaining the session', async () => {
    remote.getSession.mockImplementation(async () => {
      enabled = false
      return {
        data: {
          session: { user: { id: OWNER_A }, access_token: SYNTHETIC_TOKEN },
        },
        error: null,
      }
    })
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      'unavailable'
    )
    expect(remote.invoke).not.toHaveBeenCalled()
    expect((await journal.read(OWNER_A, WORD_A))?.submitted).toBe(true)
  })

  it('rejects a busy acceptance as a read-only recovery receipt', async () => {
    remote.invoke.mockRejectedValue(new Error('Reply lost'))
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow()
    remote.rpc.mockResolvedValue({
      data: { protocol_version: 2, outcome: 'analysis-in-progress' },
      error: null,
    })
    await expect(client().recover(OWNER_A, WORD_A, owner)).rejects.toThrow(
      'recovery receipt'
    )
    expect((await journal.read(OWNER_A, WORD_A))?.response).toBeNull()
    expect(remote.invoke).toHaveBeenCalledTimes(1)
  })

  it('checks captured owner after submission; a changed owner cannot persist or refresh the reply', async () => {
    remote.invoke.mockImplementation(async () => {
      owner.check.mockRejectedValue(new Error(AUTH_CHANGED))
      return { data: analysisReceipt(), error: null }
    })
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      AUTH_CHANGED
    )
    expect((await journal.read(OWNER_A, WORD_A))?.response).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('rolls back preparation and claiming when the synchronous owner fence changes', async () => {
    let checks = 0
    const changed = () => {
      if (++checks === 2) throw new Error(AUTH_CHANGED)
    }
    await expect(journal.prepare(analysisIntent(), changed)).rejects.toThrow(
      AUTH_CHANGED
    )
    expect(await journal.read(OWNER_A, WORD_A)).toBeNull()
    await journal.prepare(analysisIntent(), noop)
    checks = 0
    await expect(journal.claim(analysisIntent(), changed)).rejects.toThrow(
      AUTH_CHANGED
    )
    expect((await journal.read(OWNER_A, WORD_A))?.submitted).toBe(false)
    expect(await journal.claim(analysisIntent(), noop)).toBe(true)
    expect(await journal.claim(analysisIntent(), noop)).toBe(false)
  })

  it.each(['prepare', 'claim'] as const)(
    'rejects changed cached heads before %s',
    async phase => {
      if (phase === 'claim') await journal.prepare(analysisIntent(), noop)
      db.prepare(
        'UPDATE dictionary_effective_card_cache SET card_json = ?'
      ).run(JSON.stringify(followingBatch('9007199254740994').cards[0]))
      await expect(journal[phase](analysisIntent(), noop)).rejects.toThrow(
        'Sync shared dictionary'
      )
    }
  )

  it('keeps an uncertain operation after word deletion without retaining linguistic payload', async () => {
    await journal.prepare(analysisIntent(), noop)
    await journal.claim(analysisIntent(), noop)
    db.prepare('DELETE FROM words WHERE word_id = ?').run(WORD_A)
    reopened()
    expect((await journal.read(OWNER_A, WORD_A))?.command.operation_id).toBe(
      ANALYSIS_ID
    )
    expect(JSON.stringify(await journal.read(OWNER_A, WORD_A))).not.toContain(
      'house'
    )
  })

  it('rejects corruption of the indexed operation ID before dispatch', async () => {
    await journal.prepare(analysisIntent(), noop)
    db.prepare(
      'UPDATE dictionary_analysis_client_operations SET operation_id = ?'
    ).run(NEXT_ANALYSIS_ID)
    await expect(client().submit(analysisIntent(), owner)).rejects.toThrow(
      OWNER_MISMATCH
    )
    expect(remote.invoke).not.toHaveBeenCalled()
  })

  it('does not refresh for pending, busy or quarantined outcomes and reads their later result', async () => {
    remote.invoke.mockResolvedValue({
      data: { protocol_version: 2, outcome: 'analysis-in-progress' },
      error: null,
    })
    const controller = client()
    await controller.submit(analysisIntent(), owner)
    expect(refresh).not.toHaveBeenCalled()
    remote.rpc.mockResolvedValue({
      data: analysisReceipt(UNKNOWN),
      error: null,
    })
    await controller.recover(OWNER_A, WORD_A, owner)
    expect(refresh).not.toHaveBeenCalled()
    remote.rpc.mockResolvedValue({
      data: analysisReceipt(NO_CHANGE),
      error: null,
    })
    expect(
      (await controller.recover(OWNER_A, WORD_A, owner))?.response
    ).toEqual(analysisReceipt(NO_CHANGE))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(remote.invoke).toHaveBeenCalledTimes(1)
  })

  it('rejects foreign intent owners and corrupted local metadata', async () => {
    await expect(
      client().submit({ ...analysisIntent(), user_id: OWNER_B }, owner)
    ).rejects.toThrow(OWNER_MISMATCH)
    await journal.prepare(analysisIntent(), noop)
    db.prepare(
      'UPDATE dictionary_analysis_client_operations SET operation_json = ?'
    ).run(JSON.stringify({ ...analysisIntent(), user_id: OWNER_B }))
    await expect(journal.read(OWNER_A, WORD_A)).rejects.toThrow(OWNER_MISMATCH)
    expect(remote.invoke).not.toHaveBeenCalled()
  })

  it('retains prior receipt when the server replies for another operation or changes a terminal result', async () => {
    await client().submit(analysisIntent(), owner)
    remote.rpc.mockResolvedValue({
      data: { ...analysisReceipt(), operation_id: NEXT_ANALYSIS_ID },
      error: null,
    })
    await expect(client().recover(OWNER_A, WORD_A, owner)).rejects.toThrow(
      'another request'
    )
    expect((await journal.read(OWNER_A, WORD_A))?.response).toEqual(
      analysisReceipt()
    )
    remote.rpc.mockResolvedValue({
      data: analysisReceipt('rejected'),
      error: null,
    })
    await expect(client().recover(OWNER_A, WORD_A, owner)).rejects.toThrow(
      'Terminal'
    )
  })
})

describe('shared analysis exact receipt progression', () => {
  it('accepts semantic unknown quarantine and explicit server recovery with the same durable result', () => {
    const validating = analysisReceipt('validating')
    const unknown = matchDictionaryAnalysisResponse(
      analysisIntent().command,
      analysisReceipt(UNKNOWN),
      validating
    )
    expect(
      matchDictionaryAnalysisResponse(
        analysisIntent().command,
        validating,
        unknown
      )
    ).toEqual(validating)
  })
  it.each(['accepted', 'dispatching'] as const)(
    'rejects regression to %s and changed durable result',
    status => {
      expect(() =>
        matchDictionaryAnalysisResponse(
          analysisIntent().command,
          analysisReceipt(status),
          analysisReceipt('validating')
        )
      ).toThrow('Stale')
      expect(() =>
        matchDictionaryAnalysisResponse(
          analysisIntent().command,
          { ...analysisReceipt('validating'), result_sha256: 'b'.repeat(64) },
          analysisReceipt('validating')
        )
      ).toThrow('result changed')
    }
  )
  it.each([
    { ...analysisReceipt(), published_head_sequence: '9007199254740993' },
    {
      ...analysisReceipt(NO_CHANGE),
      published_head_sequence: '9007199254740994',
    },
    { ...analysisReceipt(), fence: '9007199254740998' },
    { ...analysisReceipt(), entry_id: OWNER_B },
    { ...analysisIntent(), submitted: false, response: analysisReceipt() },
    { ...analysisIntent(), access_token: 'forbidden' },
  ])('rejects mismatched boundaries and invalid local shape', value => {
    expect(() =>
      'submitted' in value
        ? parseDictionaryAnalysisClientOperation(value)
        : matchDictionaryAnalysisResponse(
            analysisIntent().command,
            value,
            analysisReceipt('validating')
          )
    ).toThrow()
  })
})
