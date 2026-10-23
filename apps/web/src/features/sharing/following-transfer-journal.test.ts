import { FOLLOWING_TRANSFER_TEXT_LIMIT } from '@woordenaar/domain'
import { createBrowserFollowingTransferJournal } from './following-transfer-journal'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  TRANSFER_ID,
  TRANSFER_WORD,
  TRANSFER_OPERATION,
  transferSession,
  transferRevision,
} from './__fixtures__/following-transfer'

const OWNER_CHANGED = 'Owner changed'
const SESSION_CHANGED = 'Following transfer session is immutable'
const ids = () =>
  jest
    .fn()
    .mockReturnValueOnce(TRANSFER_OPERATION)
    .mockReturnValueOnce(TRANSFER_WORD)
describe('protected browser transfer sessions with cross-tab owner locks', () => {
  let values: Map<string, string>
  let storage: { getItem: jest.Mock; setItem: jest.Mock }
  let tails: Map<string, Promise<unknown>>
  const journal = () =>
    createBrowserFollowingTransferJournal({
      storage,
      withLock: (name, action) => {
        const next = (tails.get(name) ?? Promise.resolve()).then(action)
        tails.set(
          name,
          next.catch(() => {})
        )
        return next
      },
    })
  beforeEach(() => {
    values = new Map([
      ['dictionary-following-import-v2:old', 'untouched receipt'],
      ['legacy-transfer', 'untouched original'],
    ])
    tails = new Map()
    storage = {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        values.set(key, value)
      }),
    }
  })
  it('restores explicit shared provenance in another tab and fences token and source-ID replacement', async () => {
    const draft = {
      ...transferSession(),
      shared_collection: {
        share_token: TRANSFER_OTHER,
        collection_id: TRANSFER_OTHER,
        word_ids: [
          TRANSFER_WORD,
          TRANSFER_OPERATION,
          TRANSFER_OWNER,
          TRANSFER_OTHER,
        ],
      },
    }
    await journal().prepare(draft, () => {})
    const planned = await journal().decide(
      draft,
      [transferRevision],
      ids(),
      () => {}
    )
    expect((await journal().list(TRANSFER_OWNER))[0]).toEqual(planned)
    expect(planned.plan?.intents[0].intent.source).toMatchObject({
      kind: 'shared-collection',
      share_token: TRANSFER_OTHER,
      word_id: TRANSFER_WORD,
    })
    for (const shared_collection of [
      { ...draft.shared_collection, share_token: TRANSFER_OWNER },
      {
        ...draft.shared_collection,
        word_ids: draft.shared_collection.word_ids.slice().reverse(),
      },
    ])
      await expect(
        journal().prepare({ ...draft, shared_collection }, () => {})
      ).rejects.toThrow(SESSION_CHANGED)
    const key = `dictionary-following-transfer-v2:${TRANSFER_OWNER}`
    values.set(
      key,
      JSON.stringify([
        {
          ...planned,
          shared_collection: {
            ...draft.shared_collection,
            word_ids: draft.shared_collection.word_ids.slice().reverse(),
          },
        },
      ])
    )
    await expect(journal().list(TRANSFER_OWNER)).rejects.toThrow()
    values.set(key, JSON.stringify([planned]))
    expect(await journal().list(TRANSFER_OTHER)).toEqual([])
    expect(
      (await journal().list(TRANSFER_OWNER))[0].document.entries
    ).toHaveLength(4)
  })
  it('restores official provenance in a new tab and rejects changed selection-to-source identity', async () => {
    const draft = {
      ...transferSession(),
      official_pack: {
        pack_id: 'official-pack',
        version: '1.0.0',
        manifest_sha256: 'a'.repeat(64),
        entry_ids: ['one', 'two', 'three', 'four'],
      },
    }
    await journal().prepare(draft, () => {})
    const saved = await journal().decide(
      draft,
      [transferRevision],
      ids(),
      () => {}
    )
    const restored = (await journal().list(TRANSFER_OWNER))[0]
    expect(restored).toEqual(saved)
    expect(restored.plan?.intents[0].intent.source).toMatchObject({
      kind: 'official-pack',
      pack_entry_id: 'one',
    })
    expect(await journal().list(TRANSFER_OTHER)).toEqual([])
    await expect(
      journal().prepare(
        {
          ...draft,
          official_pack: {
            ...draft.official_pack,
            entry_ids: draft.official_pack.entry_ids.slice().reverse(),
          },
        },
        () => {}
      )
    ).rejects.toThrow(SESSION_CHANGED)
    expect((await journal().list(TRANSFER_OWNER))[0]).toEqual(saved)
  })
  it('restores the entire document and exact plan through new journal instances', async () => {
    const draft = await journal().prepare(transferSession(), () => {})
    const saved = await journal().decide(
      draft,
      [transferRevision],
      ids(),
      () => {}
    )
    expect(await journal().list(TRANSFER_OWNER)).toEqual([saved])
    expect(saved.document).toEqual(transferSession().document)
    expect(saved.plan?.review).toEqual([
      { index: 1, reason: 'content-difference' },
      { index: 2, reason: 'unresolved-reference' },
    ])
    expect(values.get('legacy-transfer')).toBe('untouched original')
    expect(values.get('dictionary-following-import-v2:old')).toBe(
      'untouched receipt'
    )
  })
  it('serializes competing tabs and keeps the first durable mapping', async () => {
    const draft = await journal().prepare(transferSession(), () => {})
    const results = await Promise.allSettled([
      journal().decide(draft, [transferRevision], ids(), () => {}),
      journal().decide(draft, [], ids(), () => {}),
    ])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(
      (await journal().list(TRANSFER_OWNER))[0].plan?.intents[0].intent
        .operation_id
    ).toBe(TRANSFER_OPERATION)
    await expect(
      journal().prepare({ ...draft, selected_indexes: [1] }, () => {})
    ).rejects.toThrow(SESSION_CHANGED)
  })
  it('isolates owners even with equal local session IDs', async () => {
    await journal().prepare(transferSession(), () => {})
    await journal().prepare(
      { ...transferSession(), user_id: TRANSFER_OTHER },
      () => {}
    )
    expect((await journal().list(TRANSFER_OWNER))[0].user_id).toBe(
      TRANSFER_OWNER
    )
    expect((await journal().list(TRANSFER_OTHER))[0].user_id).toBe(
      TRANSFER_OTHER
    )
  })
  it('does not overwrite a draft when local storage quota is exhausted', async () => {
    const draft = await journal().prepare(transferSession(), () => {})
    const before = [...values]
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })
    await expect(
      journal().decide(draft, [transferRevision], ids(), () => {})
    ).rejects.toThrow('QuotaExceededError')
    expect([...values]).toEqual(before)
    expect(await journal().list(TRANSFER_OWNER)).toEqual([draft])
  })
  it('fences an owner change while waiting for the tab lock', async () => {
    const guard = jest.fn(() => {
      throw new Error(OWNER_CHANGED)
    })
    await expect(journal().prepare(transferSession(), guard)).rejects.toThrow(
      OWNER_CHANGED
    )
    expect(storage.setItem).not.toHaveBeenCalled()
  })
  it('refuses tampered mappings, foreign-owner documents and oversized persisted input', async () => {
    const key = `dictionary-following-transfer-v2:${TRANSFER_OWNER}`
    const draft = await journal().prepare(transferSession(), () => {})
    const saved = await journal().decide(
      draft,
      [transferRevision],
      ids(),
      () => {}
    )
    values.set(
      key,
      JSON.stringify([{ ...saved, plan: { ...saved.plan, review: [] } }])
    )
    await expect(journal().list(TRANSFER_OWNER)).rejects.toThrow()
    values.set(key, JSON.stringify([{ ...draft, user_id: TRANSFER_OTHER }]))
    await expect(journal().list(TRANSFER_OWNER)).rejects.toThrow(
      'identity mismatch'
    )
    values.set(key, ' '.repeat(FOLLOWING_TRANSFER_TEXT_LIMIT + 1))
    await expect(journal().list(TRANSFER_OWNER)).rejects.toThrow('limit')
  })
  it('enforces count limits without evicting originals or reusing reserved word/operation IDs', async () => {
    const draft = await journal().prepare(transferSession(), () => {})
    await journal().decide(draft, [transferRevision], ids(), () => {})
    const second = { ...transferSession(), session_id: TRANSFER_OTHER }
    await journal().prepare(second, () => {})
    await expect(
      journal().decide(second, [transferRevision], ids(), () => {})
    ).rejects.toThrow('identity mismatch')
    for (let index = 2; index < 10; index++)
      await journal().prepare(
        {
          ...transferSession(),
          session_id: `14141414-1414-4141-8141-${String(index).padStart(12, '0')}`,
        },
        () => {}
      )
    const before = [...values]
    await expect(
      journal().prepare(
        { ...transferSession(), session_id: TRANSFER_WORD },
        () => {}
      )
    ).rejects.toThrow('limit')
    expect([...values]).toEqual(before)
    expect((await journal().list(TRANSFER_OWNER))[0].session_id).toBe(
      TRANSFER_ID
    )
  })
})
