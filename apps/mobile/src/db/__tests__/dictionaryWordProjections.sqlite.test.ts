import { parseDictionaryReadContent } from '@woordenaar/domain'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { createTestDatabase } from './sqlite.fixture'
import { createMockWord } from '@/__tests__/helpers/factories'
import { dictionaryFollowingRepository as cache } from '../dictionaryFollowingRepository'
import { dictionaryContentRepository as legacy } from '../dictionaryContentRepository'
import { dictionaryModeReconciliationRepository as modes } from '../dictionaryModeReconciliationRepository'
import {
  getDictionaryWordMaterializations,
  getDictionaryWordProjections,
} from '../dictionaryWordReads'
import { applyDictionaryMaterializations } from '../dictionaryWordMaterialization'
import {
  AT,
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  REVISION_1,
  REVISION_2,
  followingBatch,
  followingContent,
} from './dictionaryFollowing.fixture'

jest.mock('../initDB')
const flags = [
  'EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED',
  'EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED',
] as const
const savedFlags = flags.map(key => process.env[key])
const ids = [WORD_A, WORD_A2]
const input = () =>
  ids.map((word_id, index) =>
    createMockWord({
      word_id,
      user_id: OWNER_A,
      collection_id: null,
      created_at: AT,
      updated_at: AT,
      next_review_date: AT,
      interval_days: index + 7,
      repetition_count: index + 12,
      translations: { en: ['private'] },
    })
  )

describe('bounded dictionary display projection on real SQLite', () => {
  let db: DatabaseSync
  let directory: string
  beforeEach(() => {
    flags.forEach(key => {
      process.env[key] = 'true'
    })
    directory = mkdtempSync(join(tmpdir(), 'dictionary-projections-'))
    db = createTestDatabase(join(directory, 'fixture.sqlite'))
    for (const id of ids)
      db.prepare(
        `INSERT INTO words(word_id,user_id,dutch_lemma,translations,next_review_date,created_at,updated_at) VALUES (?,?,?,'{}','2026-10-11',?,?)`
      ).run(id, OWNER_A, id, AT, AT)
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
    jest.restoreAllMocks()
  })
  afterAll(() =>
    flags.forEach((key, index) => {
      if (savedFlags[index] === undefined) delete process.env[key]
      else process.env[key] = savedFlags[index]
    })
  )
  const hydrate = async (mode: 'follow' | 'legacy') => {
    const batch = followingBatch(undefined, REVISION_1, ids)
    if (mode === 'legacy') {
      const parsedContent = parseDictionaryReadContent(followingContent)
      if (!parsedContent.success) throw new Error('Invalid legacy test fixture')
      batch.revisions = []
      batch.cards = batch.cards.map(card => ({
        ...card,
        mode: 'legacy',
        head_sequence: null,
        adopted_revision_id: null,
        reference: null,
        legacy_content: parsedContent.data,
      }))
    }
    await cache.commitHydration(
      await cache.prepareHydration(OWNER_A, ids),
      [batch],
      () => {}
    )
  }
  const compare = async () => {
    const words = input(),
      before = structuredClone(words)
    const expected = applyDictionaryMaterializations(
      words,
      await getDictionaryWordMaterializations(OWNER_A, ids)
    )
    const actual = await getDictionaryWordProjections(OWNER_A, words)
    expect(actual).toEqual(expected)
    expect(words).toEqual(before)
    expect(
      actual.map(word => [word.interval_days, word.repetition_count])
    ).toEqual([
      [7, 12],
      [8, 13],
    ])
    return actual
  }
  it.each(['follow', 'legacy'] as const)(
    'preserves %s projection, flag withdrawal, selection, pending edits and required reconciliation',
    async mode => {
      await hydrate(mode)
      await compare()
      process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
      await compare()
      db.prepare(
        'INSERT INTO dictionary_mode_reconciliations(operation_id,user_id,word_id,decision_json,applied_at) VALUES (?,?,?,?,?)'
      ).run(REVISION_2, OWNER_A, WORD_A, '{}', AT)
      await compare()
      await legacy.queueCommand(OWNER_A, {
        protocol_version: 1,
        operation_id: REVISION_1,
        word_id: WORD_A,
        expected_content_version: 0,
        kind: 'create-private',
        content: followingContent,
      })
      await compare()
      await modes.require(OWNER_A, WORD_A2, () => {})
      const result = await compare()
      if (mode === 'follow')
        expect(result.every(word => word.dictionary_content_conflict)).toBe(
          true
        )
      process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'false'
      expect(await getDictionaryWordProjections(OWNER_A, input())).toEqual(
        input()
      )
    }
  )
  it('returns independent nested content, preserves duplicate input learning fields and excludes another owner cache', async () => {
    await hydrate('follow')
    const actual = await compare()
    actual[0].translations.en?.push('local mutation')
    expect(actual[1].translations.en).toEqual(['house'])
    expect((await compare())[0].translations.en).toEqual(['house'])
    const words = [input()[0], { ...input()[0], interval_days: 99 }]
    expect(await getDictionaryWordProjections(OWNER_A, words)).toEqual(
      applyDictionaryMaterializations(
        words,
        await getDictionaryWordMaterializations(OWNER_A, [WORD_A])
      )
    )
    expect(await getDictionaryWordProjections(OWNER_B, input())).toEqual(
      input()
    )
  })
  it('rejects corrupt later data before returning any display result', async () => {
    await hydrate('follow')
    db.prepare(
      "UPDATE dictionary_effective_card_cache SET card_json = '{}' WHERE word_id = ?"
    ).run(WORD_A2)
    const words = input(),
      before = structuredClone(words)
    await expect(getDictionaryWordProjections(OWNER_A, words)).rejects.toThrow()
    expect(words).toEqual(before)
  })
})
