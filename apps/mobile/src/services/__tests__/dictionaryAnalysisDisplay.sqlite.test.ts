import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { refreshDictionaryAnalysisDisplay } from '../dictionaryAnalysisDisplay'
import { useApplicationStore } from '@/stores/useApplicationStore'
import * as reads from '@/db/dictionaryWordReads'
import { dictionaryFollowingRepository as cache } from '@/db/dictionaryFollowingRepository'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { createMockWord } from '@/__tests__/helpers/factories'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  AT,
  ENTRY,
  REVISION_1,
  REVISION_2,
  followingBatch,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import type { ApplicationState } from '@/types/ApplicationStoreTypes'
import type { Word } from '@/types/database'

jest.mock('@/db/initDB')
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn(), setState: jest.fn() },
}))
const HEAD = '9007199254740994'
const flags = [
  'EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED',
  'EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED',
] as const
const originalFlags = flags.map(key => process.env[key])
const originalRead = reads.getDictionaryWordMaterializations
const initialWord = (id: string): Word =>
  createMockWord({
    user_id: OWNER_A,
    word_id: id,
    repetition_count: 8,
    interval_days: 7,
    dictionary_content_state: {
      protocol_version: 2,
      mode: 'follow',
      content_version: '1',
      reference: { entry_id: ENTRY, revision_id: REVISION_1 },
      adopted_revision_id: REVISION_1,
      head_sequence: '9007199254740993',
      watermark: '9007199254740993',
    },
  })
describe('analysis display from file-backed shared cache', () => {
  let directory: string, db: DatabaseSync
  let state: Pick<ApplicationState, 'currentUserId' | 'words'>
  beforeEach(async () => {
    jest.clearAllMocks()
    flags.forEach(key => {
      process.env[key] = 'true'
    })
    state = {
      currentUserId: OWNER_A,
      words: [initialWord(WORD_A), initialWord(WORD_A2)],
    }
    jest
      .mocked(useApplicationStore.getState)
      .mockImplementation(() => state as ApplicationState)
    jest.mocked(useApplicationStore.setState).mockImplementation(value => {
      Object.assign(
        state,
        typeof value === 'function' ? value(state as ApplicationState) : value
      )
    })
    directory = mkdtempSync(join(tmpdir(), 'analysis-display-sqlite-'))
    db = createTestDatabase(join(directory, 'fixture.sqlite'))
    for (const word of state.words)
      db.prepare(
        `INSERT INTO words(word_id,user_id,dutch_lemma,translations,next_review_date,created_at,updated_at)
      VALUES (?,?,?,'{}','2026-10-11',?,?)`
      ).run(word.word_id, OWNER_A, `fixture-${word.word_id}`, AT, AT)
    const request = await cache.prepareHydration(OWNER_A, [WORD_A, WORD_A2])
    await cache.commitHydration(
      request,
      [followingBatch(HEAD, REVISION_2, [WORD_A, WORD_A2])],
      () => {}
    )
  })
  afterEach(() => {
    jest.restoreAllMocks()
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  afterAll(() =>
    flags.forEach((key, index) => {
      if (originalFlags[index] === undefined) delete process.env[key]
      else process.env[key] = originalFlags[index]
    })
  )
  const deferRead = () => {
    let release = () => {}
    const wait = new Promise<void>(resolve => {
      release = resolve
    })
    jest
      .spyOn(reads, 'getDictionaryWordMaterializations')
      .mockImplementationOnce(async (...args) => {
        const result = await originalRead(...args)
        await wait
        return result
      })
    return release
  }
  it('reprojects shared siblings and retains reviews and queue data completed during async cache reading', async () => {
    const rows = db.prepare('SELECT * FROM words ORDER BY word_id').all()
    const release = deferRead(),
      pending = refreshDictionaryAnalysisDisplay(OWNER_A, () => {})
    state.words = state.words.map(word => ({
      ...word,
      repetition_count: 31,
      interval_days: 90,
      next_review_date: '2026-12-25',
      easiness_factor: 2.9,
    }))
    release()
    await pending
    for (const word of state.words) {
      expect(word.dictionary_content_state?.head_sequence).toBe(HEAD)
      expect(word.repetition_count).toBe(31)
      expect(word.interval_days).toBe(90)
      expect(word.next_review_date).toBe('2026-12-25')
      expect(word.easiness_factor).toBe(2.9)
    }
    expect(db.prepare('SELECT * FROM words ORDER BY word_id').all()).toEqual(
      rows
    )
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual([])
    expect(
      db.prepare('SELECT * FROM dictionary_content_commands').all()
    ).toEqual([])
  })
  it.each(['owner', 'lifetime'])(
    'does not write any display state after %s changes during read',
    async kind => {
      let live = true
      const release = deferRead(),
        pending = refreshDictionaryAnalysisDisplay(OWNER_A, () => {
          if (!live) throw new Error('Synthetic closed view')
        })
      if (kind === 'owner') state.currentUserId = OWNER_B
      else live = false
      release()
      await expect(pending).rejects.toThrow()
      expect(useApplicationStore.setState).not.toHaveBeenCalled()
    }
  )
  it('retains a newer visible rollback instead of restoring the older cache head', async () => {
    const word = state.words[0]
    state.words = [
      {
        ...word,
        dictionary_content_state: {
          ...word.dictionary_content_state!,
          head_sequence: '9007199254740995',
          reference: { entry_id: ENTRY, revision_id: REVISION_1 },
        },
      },
    ]
    const before = state.words[0]
    await refreshDictionaryAnalysisDisplay(OWNER_A, () => {})
    expect(state.words[0]).toBe(before)
  })
  it('never restores following mode or projects shared data into a foreign owner row', async () => {
    state.words = [
      { ...state.words[0], dictionary_content_state: undefined },
      { ...state.words[1], user_id: OWNER_B },
    ]
    const before = [...state.words]
    await refreshDictionaryAnalysisDisplay(OWNER_A, () => {})
    expect(state.words[0]).toBe(before[0])
    expect(state.words[1]).toBe(before[1])
  })
  it('rejects same-sequence different revision before store mutation', async () => {
    state.words[0].dictionary_content_state!.head_sequence = HEAD
    await expect(
      refreshDictionaryAnalysisDisplay(OWNER_A, () => {})
    ).rejects.toThrow('revision changed')
    expect(
      state.words[0].dictionary_content_state?.reference?.revision_id
    ).toBe(REVISION_1)
  })
})
