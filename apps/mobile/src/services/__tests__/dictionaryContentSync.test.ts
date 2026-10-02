import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { wordRepository } from '@/db/wordRepository'
import { supabase } from '@/lib/supabase'
import type {
  DictionaryContent,
  DictionaryContentCommand,
} from '@woordenaar/domain'
import type { PostgrestSingleResponse } from '@supabase/supabase-js'
import { dictionaryContentSync } from '../dictionaryContentSync'
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))

jest.mock('@/db/dictionaryContentRepository', () => ({
  dictionaryContentRepository: {
    acknowledgeCommand: jest.fn(),
    cacheDependencies: jest.fn(),
    getChangeCursor: jest.fn(),
    getMaterializedContent: jest.fn(),
    getMissingCardWordIds: jest.fn(),
    getPendingCommands: jest.fn(),
    getWordIdsByEntryIds: jest.fn(),
    markCommandIssue: jest.fn(),
    requireCardRefresh: jest.fn(),
    saveCardStates: jest.fn(),
    advanceChangeCursor: jest.fn(),
  },
}))
jest.mock('@/db/wordRepository', () => ({
  wordRepository: { getWordsByUserId: jest.fn() },
}))
jest.mock('@/lib/supabase')

const USER_ID = '98f2a74c-e25a-4cd9-809b-91bdbd34e3ee'
const WORD_ID = '3c74297a-56a4-4ec0-830d-871dba0ee0c2'
const ENTRY_ID = 'ff6eae80-7fca-49df-8bb3-86d0c14e38e1'
const CREATE_PRIVATE = 'create-private' as const
const REVISION_ID = 'c0340c22-1e70-48f8-b681-30e380083a55'
const ASSESSMENT_ID = 'eb083c6f-e302-46ba-9797-46d465537442'
const TIMESTAMP = '2026-09-21T14:00:00.000Z'
const CONTENT_SHA = 'a'.repeat(64)
const CEFR_SHA = 'b'.repeat(64)

const content: DictionaryContent = {
  dutch_lemma: 'huis',
  dutch_original: null,
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: ['дом'] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'huizen',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}

const command: DictionaryContentCommand = {
  protocol_version: 1,
  operation_id: '9a3f0bb9-3bd8-4358-a590-f82b7d17f34f',
  word_id: WORD_ID,
  expected_content_version: 0,
  kind: CREATE_PRIVATE,
  content,
}

const rpcResult = (
  data: unknown,
  error: { code: string; message: string } | null = null
): PostgrestSingleResponse<unknown> =>
  error
    ? {
        data: null,
        error: { ...error, details: '', hint: '', name: 'PostgrestError' },
        count: null,
        status: 400,
        statusText: 'Error',
      }
    : { data, error: null, count: null, status: 200, statusText: 'OK' }

const linkedCard = {
  word_id: WORD_ID,
  content_version: 2,
  reference: { entry_id: ENTRY_ID, revision_id: REVISION_ID },
  source: 'pinned',
  content,
  removed_fields: [],
  cefr: { level: 'A2', status: 'estimated', confidence: 0.8 },
}

const revision = {
  revision_id: REVISION_ID,
  entry_id: ENTRY_ID,
  revision_no: 1,
  schema_version: 1,
  content,
  content_sha256: CONTENT_SHA,
  cefr_input_sha256: CEFR_SHA,
  review_status: 'published',
}

const state = {
  word_id: WORD_ID,
  user_id: USER_ID,
  content_version: 2,
  fallback_content: null,
  overrides: {},
  updated_at: TIMESTAMP,
}

const head = {
  entry_id: ENTRY_ID,
  input_sha256: CEFR_SHA,
  assessment_id: ASSESSMENT_ID,
}

const assessment = {
  assessment_id: ASSESSMENT_ID,
  entry_id: ENTRY_ID,
  input_sha256: CEFR_SHA,
  cefr_level: 'A2',
  status: 'estimated',
  confidence: 0.8,
  method: 'frequency-model',
  method_version: '1',
  locked: false,
  supersedes_assessment_id: null,
}

const installTableRows = (
  rowsByTable: Readonly<Record<string, readonly unknown[]>>
): void => {
  jest.mocked(supabase.from).mockImplementation(table => {
    const result = { data: rowsByTable[table] ?? [], error: null }
    const inFilter = jest.fn().mockResolvedValue(result)
    const pageQuery = {
      order: jest.fn(),
      range: jest.fn().mockResolvedValue(result),
    }
    pageQuery.order.mockReturnValue(pageQuery)
    return {
      select: jest.fn().mockReturnValue(
        table === 'word_content_state'
          ? {
              eq: jest.fn().mockReturnValue({ in: inFilter }),
            }
          : table === 'dictionary_cefr_heads'
            ? { in: jest.fn().mockReturnValue(pageQuery) }
            : { in: inFilter }
      ),
    } as unknown as ReturnType<typeof supabase.from>
  })
}

describe('dictionaryContentSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(supabase.auth, { getUser: jest.fn() })
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    jest.mocked(wordRepository.getWordsByUserId).mockResolvedValue([])
    jest
      .mocked(dictionaryContentRepository.cacheDependencies)
      .mockResolvedValue()
    jest.mocked(dictionaryContentRepository.saveCardStates).mockResolvedValue()
    jest
      .mocked(dictionaryContentRepository.requireCardRefresh)
      .mockResolvedValue()
    jest
      .mocked(dictionaryContentRepository.acknowledgeCommand)
      .mockResolvedValue()
    jest
      .mocked(dictionaryContentRepository.markCommandIssue)
      .mockResolvedValue()
    jest
      .mocked(dictionaryContentRepository.getMissingCardWordIds)
      .mockResolvedValue([])
    jest
      .mocked(dictionaryContentRepository.getChangeCursor)
      .mockResolvedValue(0)
    jest
      .mocked(dictionaryContentRepository.getWordIdsByEntryIds)
      .mockResolvedValue([])
    jest
      .mocked(dictionaryContentRepository.advanceChangeCursor)
      .mockResolvedValue()
  })

  it('treats an absent protocol function as unavailable', async () => {
    jest
      .mocked(supabase.rpc)
      .mockResolvedValue(
        rpcResult(null, { code: 'PGRST202', message: 'missing' })
      )

    await expect(dictionaryContentSync.isAvailable()).resolves.toBe(false)
  })

  it('stops before account-scoped reads when authentication changes', async () => {
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'a337e11e-5d9e-4af8-8c84-724fe44d3730' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)

    await expect(
      dictionaryContentSync.pull(USER_ID, [WORD_ID])
    ).rejects.toThrow(
      'Authentication changed during dictionary synchronization'
    )
    expect(wordRepository.getWordsByUserId).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('persists dependencies before the linked card state', async () => {
    jest
      .mocked(supabase.rpc)
      .mockResolvedValue(
        rpcResult({ protocol_version: 1, cards: [linkedCard] })
      )
    installTableRows({
      word_content_state: [state],
      dictionary_revisions: [revision],
      dictionary_cefr_heads: [head],
      dictionary_cefr_assessments: [assessment],
    })

    await expect(dictionaryContentSync.pull(USER_ID, [WORD_ID])).resolves.toBe(
      1
    )

    expect(dictionaryContentRepository.cacheDependencies).toHaveBeenCalledWith([
      { revision, assessment },
    ])
    expect(dictionaryContentRepository.saveCardStates).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          word_id: WORD_ID,
          content_version: 2,
          reference: { entry_id: ENTRY_ID, revision_id: REVISION_ID },
        }),
      ],
      []
    )
    expect(
      jest.mocked(dictionaryContentRepository.cacheDependencies).mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      jest.mocked(dictionaryContentRepository.saveCardStates).mock
        .invocationCallOrder[0]
    )
  })

  it('does not persist a card when its pinned revision is missing', async () => {
    jest
      .mocked(supabase.rpc)
      .mockResolvedValue(
        rpcResult({ protocol_version: 1, cards: [linkedCard] })
      )
    installTableRows({
      word_content_state: [state],
      dictionary_revisions: [],
      dictionary_cefr_heads: [],
      dictionary_cefr_assessments: [],
    })

    await expect(
      dictionaryContentSync.pull(USER_ID, [WORD_ID])
    ).rejects.toThrow(`Missing dictionary revision for ${WORD_ID}`)
    expect(dictionaryContentRepository.saveCardStates).not.toHaveBeenCalled()
  })

  it('does not acknowledge a receipt when its private state is missing', async () => {
    jest.mocked(supabase.rpc).mockResolvedValue(
      rpcResult({
        protocol_version: 1,
        cards: [{ ...linkedCard, reference: null, content_version: 1 }],
      })
    )
    installTableRows({})
    await expect(
      dictionaryContentSync.pull(USER_ID, [WORD_ID], [command])
    ).rejects.toThrow('Dictionary content version mismatch')
    expect(dictionaryContentRepository.saveCardStates).not.toHaveBeenCalled()
  })

  it('reconciles a successful receipt even if another device advanced the server version', async () => {
    jest.mocked(supabase.rpc).mockResolvedValue(
      rpcResult({
        protocol_version: 1,
        cards: [{ ...linkedCard, reference: null, content_version: 3 }],
      })
    )
    installTableRows({
      word_content_state: [
        { ...state, content_version: 3, fallback_content: content },
      ],
    })
    await expect(
      dictionaryContentSync.pull(USER_ID, [WORD_ID], [command])
    ).resolves.toBe(1)
    expect(dictionaryContentRepository.saveCardStates).toHaveBeenCalledWith(
      [expect.objectContaining({ content_version: 3 })],
      [command]
    )
  })

  it('keeps the conflict intact if the server changes while the comparison is open', async () => {
    jest.mocked(supabase.rpc).mockResolvedValue(
      rpcResult({
        protocol_version: 1,
        cards: [{ ...linkedCard, reference: null, content_version: 4 }],
      })
    )
    await expect(
      dictionaryContentSync.resolveConflict(
        {
          userId: USER_ID,
          wordId: WORD_ID,
          operationIds: [command.operation_id],
          localContent: content,
          remoteContent: content,
          remoteState: { ...state, reference: null, fallback_content: content },
        },
        'local'
      )
    ).rejects.toThrow('Server content changed')
    expect(dictionaryContentRepository.saveCardStates).not.toHaveBeenCalled()
  })

  it('reports retained conflicts instead of claiming successful synchronization', async () => {
    jest
      .mocked(dictionaryContentRepository.getPendingCommands)
      .mockResolvedValue([
        {
          command,
          sequence: 1,
          status: 'conflict',
          queued_at: TIMESTAMP,
          last_error: 'stale',
        },
      ])
    await expect(dictionaryContentSync.push(USER_ID)).rejects.toThrow(
      'Open the word details'
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('hydrates successful commands for multiple words in one bulk call', async () => {
    const second = {
      ...command,
      word_id: 'e84f181b-61a6-489a-9805-0b9d5d698c85',
      operation_id: 'a337e11e-5d9e-4af8-8c84-724fe44d3730',
    }
    const commands = [command, second]
    jest
      .mocked(dictionaryContentRepository.getPendingCommands)
      .mockResolvedValue(
        commands.map((item, index) => ({
          command: item,
          sequence: index + 1,
          status: 'pending',
          queued_at: TIMESTAMP,
          last_error: null,
        }))
      )
    for (const item of commands) {
      jest.mocked(supabase.rpc).mockResolvedValueOnce(
        rpcResult({
          protocol_version: 1,
          operation_id: item.operation_id,
          word_id: item.word_id,
          content_version: 1,
          kind: item.kind,
          idempotent: false,
        })
      )
    }
    const pull = jest.spyOn(dictionaryContentSync, 'pull').mockResolvedValue(2)
    await expect(dictionaryContentSync.push(USER_ID)).resolves.toBe(2)
    expect(pull).toHaveBeenCalledTimes(1)
    expect(pull).toHaveBeenCalledWith(
      USER_ID,
      commands.map(row => row.word_id),
      commands
    )
  })

  it('acknowledges a command only after its result is hydrated locally', async () => {
    jest
      .mocked(dictionaryContentRepository.getPendingCommands)
      .mockResolvedValue([
        {
          sequence: 1,
          command,
          status: 'pending',
          queued_at: TIMESTAMP,
          last_error: null,
        },
      ])
    jest.mocked(supabase.rpc).mockResolvedValue(
      rpcResult({
        protocol_version: 1,
        operation_id: command.operation_id,
        word_id: WORD_ID,
        content_version: 1,
        kind: CREATE_PRIVATE,
        idempotent: false,
      })
    )
    const pull = jest.spyOn(dictionaryContentSync, 'pull').mockResolvedValue(1)
    jest
      .mocked(dictionaryContentRepository.getMaterializedContent)
      .mockResolvedValue(
        new Map([
          [
            WORD_ID,
            {
              word_id: WORD_ID,
              content_version: 1,
              reference: null,
              dependency_status: 'ready',
              effective: { content, source: 'fallback', removed_fields: [] },
              cefr: {
                level: null,
                status: 'unknown',
                reason: 'unlinked-or-missing-revision',
              },
            },
          ],
        ])
      )

    await expect(dictionaryContentSync.push(USER_ID)).resolves.toBe(1)

    expect(pull).toHaveBeenCalledWith(USER_ID, [WORD_ID], [command])
    expect(
      dictionaryContentRepository.acknowledgeCommand
    ).not.toHaveBeenCalled()
  })

  it('keeps the command when hydration after the receipt is incomplete', async () => {
    jest
      .mocked(dictionaryContentRepository.getPendingCommands)
      .mockResolvedValue([
        {
          sequence: 1,
          command,
          status: 'pending',
          queued_at: TIMESTAMP,
          last_error: null,
        },
      ])
    jest.mocked(supabase.rpc).mockResolvedValue(
      rpcResult({
        protocol_version: 1,
        operation_id: command.operation_id,
        word_id: WORD_ID,
        content_version: 1,
        kind: CREATE_PRIVATE,
        idempotent: false,
      })
    )
    jest.spyOn(dictionaryContentSync, 'pull').mockResolvedValue(0)

    await expect(dictionaryContentSync.push(USER_ID)).rejects.toThrow(
      'Dictionary command result was not hydrated'
    )
    expect(
      dictionaryContentRepository.acknowledgeCommand
    ).not.toHaveBeenCalled()
  })

  it('hydrates once after applying an offline command chain for one word', async () => {
    const replacement: DictionaryContentCommand = {
      protocol_version: 1,
      operation_id: '152db60a-64d5-4276-b2f9-47ca6a1932a4',
      word_id: WORD_ID,
      expected_content_version: 1,
      kind: 'resolve-conflict',
      content: { ...content, plural: 'huizen' },
    }
    jest
      .mocked(dictionaryContentRepository.getPendingCommands)
      .mockResolvedValue([
        {
          sequence: 1,
          command,
          status: 'pending',
          queued_at: TIMESTAMP,
          last_error: null,
        },
        {
          sequence: 2,
          command: replacement,
          status: 'pending',
          queued_at: TIMESTAMP,
          last_error: null,
        },
      ])
    jest
      .mocked(supabase.rpc)
      .mockResolvedValueOnce(
        rpcResult({
          protocol_version: 1,
          operation_id: command.operation_id,
          word_id: WORD_ID,
          content_version: 1,
          kind: command.kind,
          idempotent: false,
        })
      )
      .mockResolvedValueOnce(
        rpcResult({
          protocol_version: 1,
          operation_id: replacement.operation_id,
          word_id: WORD_ID,
          content_version: 2,
          kind: replacement.kind,
          idempotent: false,
        })
      )
    const pull = jest.spyOn(dictionaryContentSync, 'pull').mockResolvedValue(1)
    jest
      .mocked(dictionaryContentRepository.getMaterializedContent)
      .mockResolvedValue(
        new Map([
          [
            WORD_ID,
            {
              word_id: WORD_ID,
              content_version: 2,
              reference: null,
              dependency_status: 'ready',
              effective: { content, source: 'fallback', removed_fields: [] },
              cefr: {
                level: null,
                status: 'unknown',
                reason: 'unlinked-or-missing-revision',
              },
            },
          ],
        ])
      )

    await expect(dictionaryContentSync.push(USER_ID)).resolves.toBe(2)
    expect(pull).toHaveBeenCalledTimes(1)
    expect(pull).toHaveBeenCalledWith(
      USER_ID,
      [WORD_ID],
      [command, replacement]
    )
  })

  it('does not convert an authentication failure into a content conflict', async () => {
    jest
      .mocked(dictionaryContentRepository.getPendingCommands)
      .mockResolvedValue([
        {
          sequence: 1,
          command,
          status: 'pending',
          queued_at: TIMESTAMP,
          last_error: null,
        },
      ])
    const authFailure = { code: '42501', message: 'permission denied' }
    jest.mocked(supabase.rpc).mockResolvedValue(rpcResult(null, authFailure))

    await expect(dictionaryContentSync.push(USER_ID)).rejects.toMatchObject(
      authFailure
    )
    expect(dictionaryContentRepository.markCommandIssue).toHaveBeenCalledWith(
      USER_ID,
      command.operation_id,
      'error',
      authFailure.message
    )
    expect(
      dictionaryContentRepository.markCommandIssue
    ).not.toHaveBeenCalledWith(
      USER_ID,
      command.operation_id,
      'conflict',
      expect.any(String)
    )
  })

  it('hydrates candidate and locally missing cards without a full account pull', async () => {
    const missingWordId = 'a5ab4fb8-7d01-4af0-acf0-d6840796d869'
    jest
      .mocked(dictionaryContentRepository.getMissingCardWordIds)
      .mockResolvedValue([missingWordId, WORD_ID])
    const pull = jest.spyOn(dictionaryContentSync, 'pull').mockResolvedValue(2)

    await expect(
      dictionaryContentSync.pullRequired(USER_ID, [WORD_ID])
    ).resolves.toBe(2)
    expect(pull).toHaveBeenCalledWith(USER_ID, [WORD_ID, missingWordId])
  })

  it('advances the revision cursor only after affected cards are hydrated', async () => {
    jest
      .mocked(dictionaryContentRepository.getChangeCursor)
      .mockResolvedValue(4)
    jest
      .mocked(dictionaryContentRepository.getWordIdsByEntryIds)
      .mockResolvedValue([WORD_ID])
    jest.mocked(supabase.rpc).mockResolvedValue(
      rpcResult({
        protocol_version: 1,
        after: 4,
        next_cursor: 5,
        latest_cursor: 5,
        has_more: false,
        changes: [
          {
            cursor: 5,
            kind: 'cefr-head',
            entry_id: ENTRY_ID,
            revision_id: null,
            assessment_id: ASSESSMENT_ID,
          },
        ],
      })
    )
    const pull = jest.spyOn(dictionaryContentSync, 'pull').mockResolvedValue(1)

    await expect(dictionaryContentSync.refreshChanges(USER_ID)).resolves.toBe(1)
    expect(pull).toHaveBeenCalledWith(USER_ID, [WORD_ID])
    expect(dictionaryContentRepository.requireCardRefresh).toHaveBeenCalledWith(
      USER_ID,
      [WORD_ID]
    )
    expect(
      jest.mocked(dictionaryContentRepository.requireCardRefresh).mock
        .invocationCallOrder[0]
    ).toBeLessThan(pull.mock.invocationCallOrder[0])
    expect(
      dictionaryContentRepository.advanceChangeCursor
    ).toHaveBeenCalledWith(USER_ID, 5)
    expect(pull.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(dictionaryContentRepository.advanceChangeCursor).mock
        .invocationCallOrder[0]
    )
  })

  it.each(['incomplete', 'rejected'] as const)(
    'retains change-page debt after an %s pull and retries the same cursor',
    async failure => {
      jest
        .mocked(dictionaryContentRepository.getChangeCursor)
        .mockResolvedValue(4)
      jest
        .mocked(dictionaryContentRepository.getWordIdsByEntryIds)
        .mockResolvedValue([WORD_ID])
      jest.mocked(supabase.rpc).mockResolvedValue(
        rpcResult({
          protocol_version: 1,
          after: 4,
          next_cursor: 5,
          latest_cursor: 5,
          has_more: false,
          changes: [
            {
              cursor: 5,
              kind: 'revision-head',
              entry_id: ENTRY_ID,
              revision_id: REVISION_ID,
              assessment_id: null,
            },
          ],
        })
      )
      const pull = jest.spyOn(dictionaryContentSync, 'pull')
      if (failure === 'incomplete') pull.mockResolvedValueOnce(0)
      else pull.mockRejectedValueOnce(new Error('Missing revision'))

      await expect(
        dictionaryContentSync.refreshChanges(USER_ID)
      ).rejects.toThrow(
        failure === 'incomplete'
          ? 'Dictionary change dependencies were not hydrated'
          : 'Missing revision'
      )
      expect(
        dictionaryContentRepository.requireCardRefresh
      ).toHaveBeenCalledWith(USER_ID, [WORD_ID])
      expect(
        jest.mocked(dictionaryContentRepository.requireCardRefresh).mock
          .invocationCallOrder[0]
      ).toBeLessThan(pull.mock.invocationCallOrder[0])
      expect(
        dictionaryContentRepository.advanceChangeCursor
      ).not.toHaveBeenCalled()
      pull.mockResolvedValueOnce(1)
      await expect(dictionaryContentSync.refreshChanges(USER_ID)).resolves.toBe(
        1
      )
      expect(supabase.rpc).toHaveBeenNthCalledWith(
        2,
        'get_dictionary_content_changes_v1',
        {
          p_after: 4,
          p_limit: 200,
        }
      )
      expect(
        dictionaryContentRepository.advanceChangeCursor
      ).toHaveBeenCalledTimes(1)
      expect(
        dictionaryContentRepository.advanceChangeCursor
      ).toHaveBeenCalledWith(USER_ID, 5)
    }
  )
})
