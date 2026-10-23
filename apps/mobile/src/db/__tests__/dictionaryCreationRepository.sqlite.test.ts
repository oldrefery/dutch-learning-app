import {
  parseCreationJournalRows,
  parseDictionaryCreationOwnerCommandV2,
  type DictionaryCreationJournal,
  type DictionaryCreationJournalOwner,
} from '@woordenaar/domain'
import {
  CREATION_OWNER as OWNER,
  CREATION_OTHER as OTHER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationReceiptFixture as receipt,
  creationPublishedFixture as published,
  creationAdoptionFixture as adoption,
  creationOwnerFixture,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { dictionaryCreationRepository } from '../dictionaryCreationRepository'
import { createTestDatabase } from './sqlite.fixture'
jest.mock('../initDB')
describe('creation journals on file-backed SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let journal: DictionaryCreationJournal
  let owner: DictionaryCreationJournalOwner
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
  }
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'dictionary-creation-journal-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    journal = dictionaryCreationRepository
    owner = creationOwnerFixture()
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const UNKNOWN = 'provider-outcome-unknown'
  const FAILED = 'provider-failed'
  const create = async (recovery = false) => {
    const fresh = await journal.prepare(initial(), owner)
    return journal.save(fresh, prepared(fresh, recovery), owner)
  }
  const submit = async (recovery = false) =>
    (await journal.claim(await create(recovery), owner)).row
  it('restores original query/hint and exact prepared command without dispatch or changing nonce', async () => {
    const row = await create()
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(row)
    expect((await journal.list(OWNER, owner))[0].session.submitted).toBe(false)
    expect(await journal.prepare(initial(), owner)).toEqual(row)
  })
  it('commits submitted before transport; restart requires status reconciliation', async () => {
    const row = await submit()
    restart()
    const restored = await journal.read(
      OWNER,
      row.session.request.resolution_id,
      owner
    )
    expect(restored).toEqual(row)
    expect(await journal.claim(row, owner)).toEqual({ row, claimed: false })
  })
  it('retains exact four-key recovery intent and accepts the bound three-key server receipt', async () => {
    const row = await submit(true)
    const saved = await journal.save(
      row,
      { ...row, session: { ...row.session, response: receipt(row) } },
      owner
    )
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(saved)
    expect(saved.session.command).toHaveProperty('recovery_id', id(4))
    expect(
      parseDictionaryCreationOwnerCommandV2({
        ...saved.session.command,
        actor_id: OWNER,
      }).success
    ).toBe(false)
  })
  it('retains late quarantined result hash and cannot downgrade unknown to known failure', async () => {
    const row = await submit()
    const unknown = await journal.save(
      row,
      {
        ...row,
        session: {
          ...row.session,
          response: receipt(row, {
            status: UNKNOWN,
            error_code: 'transport-unknown',
          }),
        },
      },
      owner
    )
    const late = await journal.save(
      unknown,
      {
        ...unknown,
        session: {
          ...unknown.session,
          response: receipt(row, {
            status: UNKNOWN,
            error_code: 'transport-unknown',
            result_sha256: 'a'.repeat(64),
          }),
        },
      },
      owner
    )
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(late)
    await expect(
      journal.save(
        late,
        {
          ...late,
          session: {
            ...late.session,
            response: receipt(row, {
              status: FAILED,
              error_code: 'failed',
              result_sha256: 'a'.repeat(64),
            }),
          },
        },
        owner
      )
    ).rejects.toThrow()
  })
  it.each([FAILED, UNKNOWN] as const)(
    'allows independent judge %s after validating',
    async status => {
      const row = await submit()
      const validated = await journal.save(
        row,
        {
          ...row,
          session: {
            ...row.session,
            response: receipt(row, {
              status: 'validating',
              result_sha256: 'a'.repeat(64),
            }),
          },
        },
        owner
      )
      const failed = await journal.save(
        validated,
        {
          ...validated,
          session: {
            ...validated.session,
            response: receipt(row, {
              status,
              error_code: 'judge-error',
              result_sha256: 'a'.repeat(64),
            }),
          },
        },
        owner
      )
      restart()
      expect(
        await journal.read(OWNER, row.session.request.resolution_id, owner)
      ).toEqual(failed)
    }
  )
  it('keeps publication distinct from adoption and survives each claim/receipt restart', async () => {
    const row = await submit()
    const pub = await journal.save(row, published(row), owner)
    expect(pub.adoption).toBeNull()
    restart()
    const intent = await journal.save(pub, adoption(pub), owner)
    const claimed = (await journal.claimAdoption(intent, owner)).row
    restart()
    expect(await journal.claimAdoption(intent, owner)).toEqual({
      row: claimed,
      claimed: false,
    })
    const request = claimed.adoption!.request
    const result = {
      protocol_version: 2 as const,
      operation_id: request.operation_id,
      word_id: request.word_id,
      idempotent: false,
      outcome: 'inserted' as const,
      existing_word_id: null,
      reference: { entry_id: id(5), revision_id: id(6) },
      applied_reference: { entry_id: id(5), revision_id: id(6) },
      applied_head_sequence: '9007199254740995',
    }
    const saved = await journal.save(
      claimed,
      { ...claimed, adoption: { ...claimed.adoption!, response: result } },
      owner
    )
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(saved)
    expect(saved.session.response).toEqual(pub.session.response)
    expect(saved).not.toHaveProperty('hydrated')
    expect(
      await journal.save(
        saved,
        {
          ...saved,
          adoption: {
            ...saved.adoption!,
            response: { ...result, idempotent: true },
          },
        },
        owner
      )
    ).toEqual(saved)
    await expect(
      journal.save(
        saved,
        {
          ...saved,
          adoption: {
            ...saved.adoption!,
            response: { ...result, word_id: id(99) },
          },
        },
        owner
      )
    ).rejects.toThrow()
  })
  it('adopts an already published resolution with a separate nonce and no creation submission', async () => {
    const row = await journal.prepare(initial(), owner)
    const reference = {
      reference: { entry_id: id(5), revision_id: id(6) },
      content_sha256: 'b'.repeat(64),
    }
    const resolved = await journal.save(
      row,
      {
        ...row,
        session: {
          ...row.session,
          resolution: {
            ...row.session.request,
            outcome: 'existing-meaning',
            resolved_identity_id: null,
            published: reference,
            decision_code: null,
          },
        },
      },
      owner
    )
    const intent = adoption(
      published({
        ...prepared(initial()),
        session: { ...prepared(initial()).session, submitted: true },
      })
    )
    const saved = await journal.save(
      resolved,
      { ...resolved, adoption: intent.adoption },
      owner
    )
    const claimed = (await journal.claimAdoption(saved, owner)).row
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(claimed)
    expect(claimed.session.command).toBeNull()
    expect(claimed.session.submitted).toBe(false)
  })
  it('fails closed on the aggregate text limit before replacing any retained intent', () => {
    const rows = Array.from({ length: 100 }, (_, n) => {
      const row = initial(n + 1)
      row.session.request.original_query = 'x'.repeat(240)
      row.session.request.meaning_hint = 'x'.repeat(1000)
      return prepared(row)
    })
    expect(() => parseCreationJournalRows(rows, OWNER)).toThrow()
  })
  it('rejects adoption before publication and creation nonce reuse', async () => {
    const row = await submit()
    await expect(
      journal.save(
        row,
        { ...row, adoption: adoption(published(row)).adoption },
        owner
      )
    ).rejects.toThrow()
    const pub = await journal.save(row, published(row), owner)
    const a = adoption(pub)
    await expect(
      journal.save(
        pub,
        {
          ...a,
          adoption: {
            ...a.adoption!,
            request: {
              ...a.adoption!.request,
              operation_id: row.session.command!.operation_id,
            },
          },
        },
        owner
      )
    ).rejects.toThrow()
  })
  it.each([
    'rejected',
    'review-required',
    'identity-conflict',
    'authorization-revoked',
    FAILED,
  ] as const)(
    'retains terminal %s without allowing a new nonce or receipt',
    async status => {
      const row = await submit()
      const saved = await journal.save(
        row,
        {
          ...row,
          session: {
            ...row.session,
            response: receipt(row, {
              status,
              error_code: 'terminal',
              result_sha256: 'a'.repeat(64),
            }),
          },
        },
        owner
      )
      restart()
      expect(
        await journal.read(OWNER, row.session.request.resolution_id, owner)
      ).toEqual(saved)
      await expect(
        journal.save(saved, published(saved), owner)
      ).rejects.toThrow()
      expect((await journal.claim(saved, owner)).claimed).toBe(false)
    }
  )
  it('retains zero-charge busy and published existing-meaning responses without reserving adoption prematurely', async () => {
    const row = await submit()
    const busy = await journal.save(
      row,
      {
        ...row,
        session: {
          ...row.session,
          response: {
            protocol_version: 2,
            operation_id: row.session.command!.operation_id,
            resolution_id: row.session.request.resolution_id,
            outcome: 'creation-in-progress',
            quota_charged: false,
          },
        },
      },
      owner
    )
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(busy)
    await expect(journal.save(busy, published(busy), owner)).rejects.toThrow()
    await expect(journal.claimAdoption(busy, owner)).rejects.toThrow('missing')
  })
  it('rejects stale saves, original hint/epoch mutation, command changes and submission rollback', async () => {
    const row = await create()
    const claimed = (await journal.claim(row, owner)).row
    for (const next of [
      row,
      { ...claimed, owner_epoch: id(99) },
      {
        ...claimed,
        session: {
          ...claimed.session,
          request: { ...claimed.session.request, meaning_hint: 'A seat.' },
        },
      },
      {
        ...claimed,
        session: {
          ...claimed.session,
          command: { ...claimed.session.command!, operation_id: id(99) },
        },
      },
    ])
      await expect(journal.save(claimed, next, owner)).rejects.toThrow()
    await expect(journal.save(row, claimed, owner)).rejects.toThrow(
      'snapshot changed'
    )
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(claimed)
  })
  it('rejects terminal publication changes and durable result hash replacement', async () => {
    const row = await submit()
    const pub = await journal.save(row, published(row), owner)
    const response = receipt(row, {
      status: 'published',
      result_sha256: 'c'.repeat(64),
      published: {
        reference: { entry_id: id(5), revision_id: id(6) },
        content_sha256: 'b'.repeat(64),
      },
      published_head_sequence: '9007199254740995',
    })
    await expect(
      journal.save(
        pub,
        { ...pub, session: { ...pub.session, response } },
        owner
      )
    ).rejects.toThrow()
  })
  it('isolates owners and rejects latched A-to-B-to-A and failed fresh Auth checks', async () => {
    const row = await create()
    const other: DictionaryCreationJournalOwner = {
      ...creationOwnerFixture(),
      user_id: OTHER,
    }
    expect(await journal.list(OTHER, other)).toEqual([])
    await expect(journal.list(OWNER, other)).rejects.toThrow('owner changed')
    owner.check = async () => {
      throw new Error('Fresh Auth failed')
    }
    await expect(journal.claim(row, owner)).rejects.toThrow('Fresh Auth failed')
    owner.check = async () => {}
    owner.assert = () => {
      throw new Error('Auth changed A-B-A')
    }
    await expect(journal.list(OWNER, owner)).rejects.toThrow('A-B-A')
    owner = creationOwnerFixture()
    expect(
      (await journal.read(OWNER, row.session.request.resolution_id, owner))
        ?.session.submitted
    ).toBe(false)
  })
  it('fails closed at the bounded row limit with all previous intents retained', async () => {
    for (let n = 1; n <= 100; n++) await journal.prepare(initial(n), owner)
    await expect(journal.prepare(initial(101), owner)).rejects.toThrow()
    restart()
    expect(await journal.list(OWNER, owner)).toHaveLength(100)
  })
  it('rejects malformed rows, private credential fields, foreign owner and duplicate nonce metadata', () => {
    const row = prepared(initial())
    for (const values of [
      [{ ...row, access_token: 'synthetic-secret' }],
      [{ ...row, session: { ...row.session, user_id: OTHER } }],
      [
        row,
        {
          ...prepared(initial(2)),
          session: {
            ...prepared(initial(2)).session,
            command: {
              ...prepared(initial(2)).session.command!,
              operation_id: row.session.command!.operation_id,
            },
          },
        },
      ],
    ])
      expect(() => parseCreationJournalRows(values, OWNER)).toThrow()
  })

  it('leaves personal learning and queues untouched; deleting a card cannot cascade a creation receipt', async () => {
    db.prepare(
      `INSERT INTO words(word_id,user_id,dutch_lemma,translations,next_review_date,created_at,updated_at,interval_days,repetition_count,easiness_factor)
      VALUES (?,?,'bank','{}','2026-10-11','2026-10-11','2026-10-11',7,8,2.35)`
    ).run(id(8), OWNER)
    const before = db.prepare('SELECT * FROM words').all()
    const row = await submit()
    const saved = await journal.save(row, published(row), owner)
    expect(db.prepare('SELECT * FROM words').all()).toEqual(before)
    for (const table of [
      'learning_commands',
      'dictionary_content_commands',
      'dictionary_following_import_journal',
      'dictionary_card_content',
    ])
      expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual([])
    db.prepare('DELETE FROM words WHERE word_id = ?').run(id(8))
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(saved)
  })
  it('rejects corrupt JSON/index bindings without overwriting the retained bytes', async () => {
    const row = await create()
    const raw = JSON.stringify({
      ...row,
      session: {
        ...row.session,
        command: { ...row.session.command!, operation_id: id(99) },
      },
    })
    db.prepare(
      'UPDATE dictionary_creation_client_journal SET payload_json = ?'
    ).run(raw)
    await expect(journal.claim(row, owner)).rejects.toThrow(
      'indexed identity mismatch'
    )
    expect(
      db
        .prepare('SELECT payload_json FROM dictionary_creation_client_journal')
        .get()?.payload_json
    ).toBe(raw)
  })
  it('rolls back a written claim when the latched owner changes before commit', async () => {
    const row = await create()
    let asserts = 0
    owner.assert = () => {
      if (++asserts === 6) throw new Error('Auth changed before commit')
    }
    await expect(journal.claim(row, owner)).rejects.toThrow('before commit')
    owner = creationOwnerFixture()
    restart()
    expect(
      await journal.read(OWNER, row.session.request.resolution_id, owner)
    ).toEqual(row)
  })
})
