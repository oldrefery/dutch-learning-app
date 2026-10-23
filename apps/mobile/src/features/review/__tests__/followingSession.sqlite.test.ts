import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { revealReviewAnswer, summarizeReviewFlow } from '@woordenaar/domain'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import {
  AT,
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  WORD_B,
  REVISION_1,
  REVISION_2,
  followingBatch,
  followingPage,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import { wordRepository } from '@/db/wordRepository'
import { getDictionaryWordMaterializations } from '@/db/dictionaryWordReads'
import { applyDictionaryMaterializations } from '@/db/dictionaryWordMaterialization'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import { dictionaryFollowingRepository } from '@/db/dictionaryFollowingRepository'
import { dictionaryFollowingSync } from '@/services/dictionaryFollowingSync'
import { supabase } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { ReviewSession } from '@/types/ReviewTypes'
import { prepareNativeReviewQuestionsAsync } from '../questions'
import { createNativeReviewController } from '../controller'
import { createNativeReviewPersistence } from '../persistence'

jest.mock('@/db/initDB')
jest.mock('@/lib/sentry')
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
  isDictionaryFollowingEnabled: () => true,
}))

type ReadArgs = { p_word_ids?: string[]; p_after?: string }
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<{ data: unknown; error: null }>,
  [string, ReadArgs?]
>
const OWNED_IDS = [WORD_A, WORD_A2]
const OFFLINE = 'Synthetic offline response'
const WORDS_SQL = 'SELECT * FROM words ORDER BY word_id'
const EVENTS_SQL = 'SELECT * FROM review_events ORDER BY event_id'
const COMMANDS_SQL = 'SELECT * FROM learning_commands ORDER BY sequence'

describe('following content through actual native review and file restart', () => {
  let db: DatabaseSync, directory: string, path: string
  let sequence: string, revision: string, offline: boolean
  const readWords = async () => {
    const words = await Promise.all(
      OWNED_IDS.map(async id => {
        const word = await wordRepository.getWordByIdAndUserId(id, OWNER_A)
        if (!word) throw new Error('Fixture word is unavailable')
        return word
      })
    )
    return applyDictionaryMaterializations(
      words,
      await getDictionaryWordMaterializations(OWNER_A, OWNED_IDS)
    )
  }
  const start = async () => {
    const words = await readWords()
    useApplicationStore.setState({ currentUserId: OWNER_A, words })
    const session: ReviewSession = {
      words,
      config: { scope: 'all-due', mode: 'meaning-recall' },
      adaptiveModeByWordId: {},
      currentIndex: 0,
      completedCount: 0,
    }
    const questions = await prepareNativeReviewQuestionsAsync(
      session,
      words,
      OWNER_A,
      new AbortController().signal,
      () => {},
      async () => {}
    )
    if (!questions) throw new Error('Fixture preparation was cancelled')
    return createNativeReviewController(
      {
        userId: OWNER_A,
        sessionId: randomUUID(),
        now: Date.now(),
        manualRecognition: false,
        questions,
      },
      createNativeReviewPersistence(OWNER_A),
      randomUUID
    )
  }
  const answer = async (controller: Awaited<ReturnType<typeof start>>) => {
    const active = controller.getSnapshot().active!
    controller.transition(flow =>
      revealReviewAnswer(flow, active.question.id, Date.now())
    )
    await controller.submit('good')
  }
  const learning = () => ({
    words: db.prepare(WORDS_SQL).all(),
    events: db.prepare(EVENTS_SQL).all(),
    commands: db.prepare(COMMANDS_SQL).all(),
  })
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
    useApplicationStore.setState({ words: [], reviewSession: null })
  }
  beforeEach(async () => {
    jest.clearAllMocks()
    directory = mkdtempSync(join(tmpdir(), 'following-review-session-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    for (const id of [...OWNED_IDS, WORD_B])
      db.prepare(
        `INSERT INTO words(word_id,user_id,dutch_lemma,translations,
        next_review_date,created_at,updated_at,interval_days,repetition_count,
        easiness_factor,sync_status) VALUES(?,?,?,'{"en":["private original"],"ru":[]}',
        '2026-10-11',?,?,7,8,2.35,'synced')`
      ).run(id, id === WORD_B ? OWNER_B : OWNER_A, `private-${id}`, AT, AT)
    sequence = '9007199254740993'
    revision = REVISION_1
    offline = false
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: OWNER_A } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    rpc.mockImplementation(async (name, args) => {
      if (offline) throw new Error(OFFLINE)
      let data: unknown
      if (name === 'dictionary_content_capability_v2')
        data = {
          dictionary_content_protocol: 2,
          read_protocol_versions: [1, 2],
          command_protocol_versions: [1],
          following_enabled: true,
          shared_analysis_enabled: false,
        }
      else if (name === 'get_dictionary_effective_content_v2')
        data = followingBatch(sequence, revision, args?.p_word_ids ?? [])
      else if (name === 'get_dictionary_content_changes_v2')
        data = followingPage(args?.p_after ?? '0', sequence, revision)
      else throw new Error(`Unexpected fixture RPC: ${name}`)
      return { data, error: null }
    })
    await dictionaryFollowingSync.pull(OWNER_A, OWNED_IDS)
    await dictionaryFollowingSync.refreshChanges(OWNER_A)
    rpc.mockClear()
  })
  afterEach(() => {
    jest.restoreAllMocks()
    db.close()
    rmSync(directory, { recursive: true, force: true })
    useApplicationStore.setState({ currentUserId: null, words: [] })
  })

  it('A13 finishes old questions after shared hydration; the next session reads the new revision without rewriting learning', async () => {
    const controller = await start()
    const before = learning()
    sequence = '9007199254740994'
    revision = REVISION_2
    await dictionaryFollowingSync.refreshChanges(OWNER_A)
    expect(learning()).toEqual(before)
    expect((await readWords())[0].translations.en).toEqual(['home'])
    expect(
      controller.getSnapshot().active?.question.payload.word
    ).toMatchObject({
      translations: { en: ['house'] },
      dictionary_content_state: { reference: { revision_id: REVISION_1 } },
    })
    await answer(controller)
    expect(useApplicationStore.getState().words[0]).toMatchObject({
      translations: { en: ['house'] },
      dictionary_content_state: { reference: { revision_id: REVISION_1 } },
      repetition_count: 9,
    })
    expect(controller.getSnapshot().active?.question.payload.translation).toBe(
      'house'
    )
    await answer(controller)
    expect(summarizeReviewFlow(controller.getSnapshot()).finished).toBe(true)
    expect(controller.getSnapshot().history).toHaveLength(2)
    expect(
      controller
        .getSnapshot()
        .history.every(
          item =>
            item.question.question.payload.word.dictionary_content_state
              ?.reference?.revision_id === REVISION_1
        )
    ).toBe(true)
    const afterReviews = learning()
    const next = await start()
    expect(next.getSnapshot().active?.question.payload.word).toMatchObject({
      translations: { en: ['home'] },
      dictionary_content_state: { reference: { revision_id: REVISION_2 } },
    })
    expect(learning()).toEqual(afterReviews)
  })

  it('A12 retains two offline reviews across file restart, failed refresh, hydration and repeated local acknowledgements', async () => {
    offline = true
    const controller = await start()
    await answer(controller)
    await answer(controller)
    expect(rpc).not.toHaveBeenCalled()
    const pending = await reviewEventRepository.getPendingSyncEvents(OWNER_A)
    expect(pending).toHaveLength(2)
    expect(new Set(pending.map(event => event.event_id)).size).toBe(2)
    expect(await reviewEventRepository.getPendingSyncEvents(OWNER_B)).toEqual(
      []
    )
    const before = learning()
    restart()
    expect(learning()).toEqual(before)
    expect(
      (await start()).getSnapshot().active?.question.payload.translation
    ).toBe('house')
    await expect(
      dictionaryFollowingSync.pull(OWNER_A, OWNED_IDS)
    ).rejects.toThrow(OFFLINE)
    expect(
      await dictionaryFollowingRepository.getPendingRefreshWordIds(OWNER_A)
    ).toEqual(OWNED_IDS)
    expect(await dictionaryFollowingRepository.getChangeCursor(OWNER_A)).toBe(
      '9007199254740993'
    )
    expect(learning()).toEqual(before)
    offline = false
    sequence = '9007199254740994'
    revision = REVISION_2
    await dictionaryFollowingSync.refreshChanges(OWNER_A)
    expect(learning()).toEqual(before)
    expect(
      (await start()).getSnapshot().active?.question.payload.translation
    ).toBe('home')
    // Synthetic remote acknowledgement only; no server or device acceptance claim.
    const acks = pending.map(event => ({
      event_id: event.event_id,
      created_at: AT,
    }))
    await reviewEventRepository.reconcilePushedEvents(OWNER_A, acks)
    const acknowledged = learning()
    await reviewEventRepository.reconcilePushedEvents(OWNER_A, acks)
    expect(learning()).toEqual({
      ...acknowledged,
      // A repeated acknowledgement may refresh transport timestamps only.
      events: acknowledged.events.map(event => ({
        ...event,
        synced_at: expect.any(String),
        last_sync_attempt_at: expect.any(String),
      })),
    })
    expect(await reviewEventRepository.getPendingSyncEvents(OWNER_A)).toEqual(
      []
    )
    expect(db.prepare(WORDS_SQL).all()).toEqual(before.words)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    expect(db.prepare(EVENTS_SQL).all()).toHaveLength(2)
    restart()
    expect(await reviewEventRepository.getPendingSyncEvents(OWNER_A)).toEqual(
      []
    )
    expect(
      (await readWords())[0].dictionary_content_state?.reference?.revision_id
    ).toBe(REVISION_2)
  })
})
