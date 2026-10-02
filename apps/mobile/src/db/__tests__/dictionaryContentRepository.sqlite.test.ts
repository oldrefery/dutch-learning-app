import type { DatabaseSync } from 'node:sqlite'
import type {
  DictionaryCefrAssessment,
  DictionaryContent,
  DictionaryContentCommand,
  DictionaryRevision,
} from '@woordenaar/domain'
import { createTestDatabase } from './sqlite.fixture'
import { dictionaryContentRepository as repository } from '../dictionaryContentRepository'

jest.mock('../initDB')

const at = '2026-09-21T12:00:00.000Z'
const ownerId = '11111111-1111-4111-8111-111111111111'
const otherOwnerId = '22222222-2222-4222-8222-222222222222'
const wordId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherWordId = 'abababab-abab-4bab-8bab-abababababab'
const entryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const revisionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const assessmentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const operationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const nextOperationId = 'efefefef-efef-4fef-8fef-efefefefefef'
const contentSha = 'a'.repeat(64)
const cefrInputSha = 'b'.repeat(64)

const content: DictionaryContent = {
  dutch_lemma: 'huis',
  dutch_original: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: ['дом'] },
  examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.', ru: null }],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'huizen',
  register: 'neutral',
  synonyms: ['woning'],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: 'https://example.com/shared.jpg',
  tts_url: 'https://example.com/shared.mp3',
}

const revision: DictionaryRevision = {
  revision_id: revisionId,
  entry_id: entryId,
  revision_no: 1,
  schema_version: 1,
  content,
  content_sha256: contentSha,
  cefr_input_sha256: cefrInputSha,
  review_status: 'published',
}

const assessment: DictionaryCefrAssessment = {
  assessment_id: assessmentId,
  entry_id: entryId,
  input_sha256: cefrInputSha,
  cefr_level: 'B1',
  status: 'estimated',
  confidence: 0.86,
  method: 'test-fixture',
  method_version: '1',
  locked: false,
  supersedes_assessment_id: null,
}

const command: DictionaryContentCommand = {
  protocol_version: 1,
  operation_id: operationId,
  word_id: wordId,
  expected_content_version: 1,
  kind: 'adopt-revision',
  reference: { entry_id: entryId, revision_id: revisionId },
  overrides: {},
}

describe('dictionary content storage on SQLite', () => {
  let db: DatabaseSync

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(at))
    db = createTestDatabase()
    const insertWord = db.prepare(
      `INSERT INTO words(
        word_id, user_id, dutch_lemma, translations, next_review_date,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, 'huis', '{}', '2026-09-22', ?, ?, 'synced')`
    )
    insertWord.run(wordId, ownerId, at, at)
    insertWord.run(otherWordId, otherOwnerId, at, at)
  })

  afterEach(() => {
    db.close()
    jest.useRealTimers()
  })

  it('preserves a pending private edit against equal and higher remote versions', async () => {
    const local = {
      word_id: wordId,
      user_id: ownerId,
      content_version: 2,
      reference: null,
      fallback_content: { ...content, plural: 'local edit' },
      overrides: {},
      updated_at: at,
    }
    await repository.saveCardStates([local])
    await repository.queueCommand(ownerId, command)
    for (const version of [2, 3]) {
      await repository.saveCardStates([
        {
          ...local,
          content_version: version,
          fallback_content: content,
        },
      ])
      expect(
        (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
      ).toMatchObject({ effective: { content: { plural: 'local edit' } } })
    }
  })

  it('atomically acknowledges hydrated commands while preserving edits queued during the request', async () => {
    const local = {
      word_id: wordId,
      user_id: ownerId,
      content_version: 3,
      reference: null,
      fallback_content: { ...content, plural: 'newer edit' },
      overrides: {},
      updated_at: at,
    }
    await repository.saveCardStates([local])
    await repository.queueCommand(ownerId, command)
    const next = {
      ...command,
      operation_id: nextOperationId,
      expected_content_version: 2,
    }
    await repository.queueCommand(ownerId, next)
    await repository.saveCardStates(
      [{ ...local, content_version: 2, fallback_content: content }],
      [command]
    )
    expect(
      (await repository.getPendingCommands(ownerId)).map(row => row.command)
    ).toEqual([next])
    expect(
      (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
    ).toMatchObject({ effective: { content: { plural: 'newer edit' } } })

    db.exec(`CREATE TRIGGER fail_card_update BEFORE UPDATE ON dictionary_card_content
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`)
    await expect(repository.saveCardStates([local], [next])).rejects.toThrow(
      'disk failure'
    )
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(1)
    db.exec('DROP TRIGGER fail_card_update')
    await repository.saveCardStates([{ ...local, content_version: 4 }], [next])
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(0)
  })

  it('retains hydration debt for an existing card until the retry succeeds', async () => {
    const state = {
      word_id: wordId,
      user_id: ownerId,
      content_version: 1,
      reference: null,
      fallback_content: content,
      overrides: {},
      updated_at: at,
    }
    await repository.saveCardStates([state])
    expect(await repository.getMissingCardWordIds(ownerId)).toEqual([])
    await repository.requireCardRefresh(ownerId, [wordId, otherWordId])
    expect(await repository.getMissingCardWordIds(ownerId)).toEqual([wordId])
    await expect(
      repository.saveCardStates([{ ...state, content_version: -1 }])
    ).rejects.toThrow()
    expect(await repository.getMissingCardWordIds(ownerId)).toEqual([wordId])
    await repository.saveCardStates([state])
    expect(await repository.getMissingCardWordIds(ownerId)).toEqual([])
  })

  it('requires a fresh explicit conflict choice and preserves learning state', async () => {
    const state = {
      word_id: wordId,
      user_id: ownerId,
      content_version: 2,
      reference: null,
      fallback_content: content,
      overrides: {},
      updated_at: at,
    }
    await repository.saveCardStates([state])
    await repository.queueCommand(ownerId, command)
    await repository.markCommandIssue(
      ownerId,
      operationId,
      'conflict',
      'stale-content-version'
    )
    const originalWord = db
      .prepare('SELECT * FROM words WHERE word_id = ?')
      .get(wordId)
    const resolution = {
      userId: ownerId,
      wordId,
      operationIds: [operationId],
      replacement: null,
    }
    const later = {
      ...command,
      operation_id: nextOperationId,
      expected_content_version: 2,
    }
    await repository.queueCommand(ownerId, later)
    await expect(
      repository.saveCardStates([state], [], resolution)
    ).rejects.toThrow('Private edits changed')
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(2)
    await repository.saveCardStates([{ ...state, content_version: 1 }], [], {
      ...resolution,
      operationIds: [operationId, later.operation_id],
    })
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(0)
    expect(
      (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
    ).toMatchObject({ content_version: 1, has_conflict: false })
    expect(
      db.prepare('SELECT * FROM words WHERE word_id = ?').get(wordId)
    ).toEqual(originalWord)
  })

  it('keeps an explicitly chosen local version as a new versioned private command', async () => {
    const state = {
      word_id: wordId,
      user_id: ownerId,
      content_version: 2,
      reference: null,
      fallback_content: content,
      overrides: {},
      updated_at: at,
    }
    await repository.saveCardStates([state])
    await repository.queueCommand(ownerId, command)
    await repository.markCommandIssue(
      ownerId,
      operationId,
      'conflict',
      'stale-content-version'
    )
    const replacement: DictionaryContentCommand = {
      protocol_version: 1,
      operation_id: nextOperationId,
      word_id: wordId,
      expected_content_version: 4,
      kind: 'resolve-conflict',
      content,
    }
    await repository.saveCardStates([{ ...state, content_version: 5 }], [], {
      userId: ownerId,
      wordId,
      operationIds: [operationId],
      replacement,
    })
    expect(
      (await repository.getPendingCommands(ownerId)).map(row => row.command)
    ).toEqual([replacement])
    expect(
      (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
    ).toMatchObject({
      content_version: 5,
      has_conflict: false,
      reference: null,
    })
  })

  it('clears an explicitly absent CEFR head without deleting its immutable assessment', async () => {
    await repository.cacheDependencies([{ revision, assessment }])
    await repository.cacheDependencies([{ revision, assessment: null }])
    expect(
      db.prepare('SELECT * FROM dictionary_cefr_head_cache').all()
    ).toHaveLength(0)
    expect(
      db.prepare('SELECT * FROM dictionary_cefr_assessment_cache').all()
    ).toHaveLength(1)
  })

  it('materializes pinned content, media overrides and inherited CEFR in one bulk read', async () => {
    await repository.cacheDependencies([{ revision, assessment }])
    await repository.saveCardStates([
      {
        word_id: wordId,
        user_id: ownerId,
        content_version: 1,
        reference: { entry_id: entryId, revision_id: revisionId },
        fallback_content: null,
        overrides: {
          image_url: { op: 'set', value: 'https://example.com/private.jpg' },
        },
        updated_at: at,
      },
    ])

    const materialized = await repository.getMaterializedContent(ownerId, [
      wordId,
      wordId,
    ])

    expect(materialized.size).toBe(1)
    expect(materialized.get(wordId)).toMatchObject({
      word_id: wordId,
      content_version: 1,
      dependency_status: 'ready',
      effective: {
        source: 'pinned',
        content: {
          dutch_lemma: 'huis',
          image_url: 'https://example.com/private.jpg',
          tts_url: 'https://example.com/shared.mp3',
        },
      },
      cefr: { level: 'B1', status: 'estimated', reason: 'inherited' },
    })
    expect(
      db
        .prepare('SELECT count(*) AS count FROM dictionary_revision_cache')
        .get()
    ).toEqual({ count: 1 })
    expect(
      db
        .prepare(
          'SELECT count(*) AS count FROM dictionary_cefr_assessment_cache'
        )
        .get()
    ).toEqual({ count: 1 })
  })

  it('keeps a linked card readable as missing until its referenced dependency arrives', async () => {
    await repository.saveCardStates([
      {
        word_id: wordId,
        user_id: ownerId,
        content_version: 2,
        reference: { entry_id: entryId, revision_id: revisionId },
        fallback_content: null,
        overrides: {},
        updated_at: at,
      },
    ])

    expect(
      (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
    ).toMatchObject({
      dependency_status: 'missing-revision',
      effective: { source: 'missing', content: null },
      cefr: {
        level: null,
        status: 'unknown',
        reason: 'unlinked-or-missing-revision',
      },
    })

    await repository.cacheDependencies([{ revision, assessment }])
    expect(
      (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
    ).toMatchObject({
      dependency_status: 'ready',
      effective: { source: 'pinned' },
      cefr: { level: 'B1', reason: 'inherited' },
    })
  })

  it('supports private fallback and refuses to overwrite a newer card version', async () => {
    await repository.saveCardStates([
      {
        word_id: wordId,
        user_id: ownerId,
        content_version: 4,
        reference: null,
        fallback_content: content,
        overrides: { tts_url: { op: 'remove' } },
        updated_at: at,
      },
    ])
    await repository.saveCardStates([
      {
        word_id: wordId,
        user_id: ownerId,
        content_version: 3,
        reference: { entry_id: entryId, revision_id: revisionId },
        fallback_content: null,
        overrides: {},
        updated_at: '2026-09-21T13:00:00.000Z',
      },
    ])

    expect(
      (await repository.getMaterializedContent(ownerId, [wordId])).get(wordId)
    ).toMatchObject({
      content_version: 4,
      reference: null,
      effective: {
        source: 'fallback',
        content: { dutch_lemma: 'huis', tts_url: null },
        removed_fields: ['tts_url'],
      },
      cefr: { level: null, status: 'unknown' },
    })
  })

  it('enforces owner isolation and rolls back a mixed-owner card batch', async () => {
    await expect(
      repository.saveCardStates([
        {
          word_id: wordId,
          user_id: ownerId,
          content_version: 1,
          reference: null,
          fallback_content: content,
          overrides: {},
          updated_at: at,
        },
        {
          word_id: otherWordId,
          user_id: ownerId,
          content_version: 1,
          reference: null,
          fallback_content: content,
          overrides: {},
          updated_at: at,
        },
      ])
    ).rejects.toThrow('dictionary card owner mismatch')

    expect(db.prepare('SELECT * FROM dictionary_card_content').all()).toEqual(
      []
    )
    expect(
      await repository.getMaterializedContent(otherOwnerId, [wordId])
    ).toEqual(new Map())
  })

  it('accepts exact immutable retries and atomically rejects revision identity conflicts', async () => {
    await repository.cacheDependencies([{ revision, assessment }])
    await repository.cacheDependencies([{ revision, assessment }])

    const secondRevision: DictionaryRevision = {
      ...revision,
      revision_id: 'cfcfcfcf-cfcf-4fcf-8fcf-cfcfcfcfcfcf',
      revision_no: 2,
      content_sha256: 'c'.repeat(64),
    }
    await expect(
      repository.cacheDependencies([
        { revision: secondRevision },
        {
          revision: { ...revision, content_sha256: 'd'.repeat(64) },
          assessment,
        },
      ])
    ).rejects.toThrow('Dictionary revision identity conflict')

    expect(
      db
        .prepare(
          'SELECT revision_id, content_sha256 FROM dictionary_revision_cache ORDER BY revision_no'
        )
        .all()
    ).toEqual([{ revision_id: revisionId, content_sha256: contentSha }])
  })

  it('queues commands durably in sequence, idempotently, and retries after storage failure', async () => {
    await repository.queueCommand(ownerId, command, at)
    await repository.queueCommand(ownerId, command, at)
    expect(await repository.getPendingCommands(ownerId)).toMatchObject([
      { sequence: 1, command, status: 'pending', queued_at: at },
    ])

    await expect(
      repository.queueCommand(ownerId, {
        ...command,
        expected_content_version: 2,
      })
    ).rejects.toThrow('Dictionary command identity conflict')

    const retryCommand: DictionaryContentCommand = {
      ...command,
      operation_id: nextOperationId,
    }
    db.exec(`CREATE TRIGGER fail_dictionary_command
      BEFORE INSERT ON dictionary_content_commands
      WHEN NEW.operation_id = '${retryCommand.operation_id}'
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`)
    await expect(
      repository.queueCommand(ownerId, retryCommand)
    ).rejects.toThrow('disk failure')
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(1)
    db.exec('DROP TRIGGER fail_dictionary_command')
    await repository.queueCommand(ownerId, retryCommand)
    expect(
      (await repository.getPendingCommands(ownerId)).map(
        item => item.command.operation_id
      )
    ).toEqual([operationId, retryCommand.operation_id])
  })

  it('rejects foreign and tombstoned command ownership without disturbing the queue', async () => {
    await repository.queueCommand(ownerId, command)
    await expect(
      repository.queueCommand(otherOwnerId, command)
    ).rejects.toThrow('Dictionary command identity conflict')
    db.prepare('UPDATE words SET deleted_at = ? WHERE word_id = ?').run(
      at,
      wordId
    )
    await expect(
      repository.queueCommand(ownerId, command)
    ).resolves.toBeUndefined()
    await expect(
      repository.queueCommand(ownerId, {
        ...command,
        operation_id: 'edededed-eded-4ded-8ded-edededededed',
      })
    ).rejects.toThrow('dictionary command owner mismatch')
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(0)
    expect(
      db.prepare('SELECT * FROM dictionary_content_commands').all()
    ).toHaveLength(1)
  })

  it('scopes command reconciliation and advances change cursors monotonically', async () => {
    await repository.queueCommand(ownerId, command)
    await repository.markCommandIssue(
      otherOwnerId,
      operationId,
      'conflict',
      'foreign'
    )
    expect((await repository.getPendingCommands(ownerId))[0]).toMatchObject({
      status: 'pending',
      last_error: null,
    })
    await repository.markCommandIssue(ownerId, operationId, 'error', 'network')
    expect((await repository.getPendingCommands(ownerId))[0]).toMatchObject({
      status: 'error',
      last_error: 'network',
    })
    await repository.acknowledgeCommand(otherOwnerId, operationId)
    expect(await repository.getPendingCommands(ownerId)).toHaveLength(1)
    await repository.acknowledgeCommand(ownerId, operationId)
    expect(await repository.getPendingCommands(ownerId)).toEqual([])

    expect(await repository.getChangeCursor(ownerId)).toBe(0)
    await repository.advanceChangeCursor(ownerId, 12, at)
    await repository.advanceChangeCursor(ownerId, 9, '2026-09-21T13:00:00.000Z')
    expect(await repository.getChangeCursor(ownerId)).toBe(12)
    expect(
      db
        .prepare(
          'SELECT committed_version, updated_at FROM dictionary_change_cursors WHERE user_id = ?'
        )
        .get(ownerId)
    ).toEqual({ committed_version: 12, updated_at: at })
    await expect(repository.advanceChangeCursor(ownerId, -1)).rejects.toThrow(
      'Invalid dictionary change cursor'
    )
  })

  it('finds missing cards and scopes linked entry lookups to their owner', async () => {
    expect(await repository.getMissingCardWordIds(ownerId)).toEqual([wordId])
    expect(await repository.getMissingCardWordIds(otherOwnerId)).toEqual([
      otherWordId,
    ])

    await repository.saveCardStates([
      {
        word_id: wordId,
        user_id: ownerId,
        content_version: 1,
        reference: { entry_id: entryId, revision_id: revisionId },
        fallback_content: null,
        overrides: {},
        updated_at: at,
      },
    ])

    expect(await repository.getMissingCardWordIds(ownerId)).toEqual([])
    expect(await repository.getWordIdsByEntryIds(ownerId, [entryId])).toEqual([
      wordId,
    ])
    expect(
      await repository.getWordIdsByEntryIds(otherOwnerId, [entryId])
    ).toEqual([])
  })
})
