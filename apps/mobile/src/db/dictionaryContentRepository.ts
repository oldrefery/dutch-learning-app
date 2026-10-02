import { getDatabase } from './initDB'
import type { SQLiteBindValue } from 'expo-sqlite'
import {
  parseDictionaryCefrAssessment,
  parseDictionaryContent,
  parseDictionaryContentCommand,
  parseDictionaryContentOverrides,
  parseDictionaryReference,
  parseDictionaryRevision,
  resolveEffectiveDictionaryContent,
  resolveInheritedCefr,
  type DictionaryCefrAssessment,
  type DictionaryContent,
  type DictionaryContentCommand,
  type DictionaryContentOverrides,
  type DictionaryReference,
  type DictionaryRevision,
  type EffectiveDictionaryContent,
  type InheritedCefrResult,
} from '@woordenaar/domain'

const MAX_QUERY_WORD_IDS = 10_000
const QUERY_CHUNK_SIZE = 400

export interface DictionaryDependencyBundle {
  revision: DictionaryRevision
  assessment?: DictionaryCefrAssessment | null
}

export interface LocalDictionaryCardState {
  word_id: string
  user_id: string
  content_version: number
  reference: DictionaryReference | null
  fallback_content: DictionaryContent | null
  overrides: DictionaryContentOverrides
  updated_at: string
}

export interface LocalDictionaryMaterialization {
  word_id: string
  content_version: number
  reference: DictionaryReference | null
  dependency_status: 'ready' | 'missing-revision'
  effective: EffectiveDictionaryContent
  cefr: InheritedCefrResult
  has_conflict?: boolean
}

export interface DictionaryConflictResolution {
  userId: string
  wordId: string
  operationIds: readonly string[]
  replacement: DictionaryContentCommand | null
}

export interface LocalDictionaryCommand {
  sequence: number
  command: DictionaryContentCommand
  status: 'pending' | 'error' | 'conflict'
  queued_at: string
  last_error: string | null
}

interface CachedRevisionIdentity {
  entry_id: string
  content_sha256: string
  cefr_input_sha256: string
  content_json: string
}

interface CachedAssessmentIdentity {
  entry_id: string
  input_sha256: string
  cefr_level: string | null
  status: string
  confidence: number | null
  method: string
  method_version: string
  locked: number
  supersedes_assessment_id: string | null
}

interface MaterializedRow {
  has_conflict: number
  word_id: string
  content_version: number
  entry_id: string | null
  pinned_revision_id: string | null
  fallback_content_json: string | null
  overrides_json: string
  revision_id: string | null
  revision_entry_id: string | null
  revision_no: number | null
  schema_version: number | null
  content_json: string | null
  content_sha256: string | null
  cefr_input_sha256: string | null
  review_status: string | null
  assessment_id: string | null
  assessment_entry_id: string | null
  assessment_input_sha256: string | null
  cefr_level: string | null
  assessment_status: string | null
  confidence: number | null
  method: string | null
  method_version: string | null
  locked: number | null
  supersedes_assessment_id: string | null
}

interface CommandRow {
  sequence: number
  payload_json: string
  status: LocalDictionaryCommand['status']
  queued_at: string
  last_error: string | null
}

const parseJson = (value: string, label: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error(`Invalid local ${label} JSON`)
  }
}

const canonicalizeJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`)
    .join(',')}}`
}

const requireParsed = <Value>(
  result:
    | { success: true; data: Value }
    | { success: false; issues: { path: string; message: string }[] },
  label: string
): Value => {
  if (result.success) return result.data
  const firstIssue = result.issues[0]
  throw new Error(
    `Invalid ${label}${firstIssue ? `: ${firstIssue.path} ${firstIssue.message}` : ''}`
  )
}

const sameNullableNumber = (
  left: number | null,
  right: number | null
): boolean => left === right

export class DictionaryContentRepository {
  async cacheDependencies(
    bundles: readonly DictionaryDependencyBundle[]
  ): Promise<void> {
    if (bundles.length === 0) return
    const parsed = bundles.map(bundle => {
      const revision = requireParsed(
        parseDictionaryRevision(bundle.revision),
        'dictionary revision'
      )
      const assessment =
        bundle.assessment === undefined || bundle.assessment === null
          ? null
          : requireParsed(
              parseDictionaryCefrAssessment(bundle.assessment),
              'dictionary CEFR assessment'
            )
      if (
        assessment !== null &&
        (assessment.entry_id !== revision.entry_id ||
          assessment.input_sha256 !== revision.cefr_input_sha256)
      ) {
        throw new Error('Dictionary assessment does not match its revision')
      }
      return {
        revision,
        assessment,
        refreshHead: bundle.assessment !== undefined,
      }
    })
    const db = await getDatabase()
    const cachedAt = new Date().toISOString()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const bundle of parsed) {
        await this.insertImmutableRevision(
          transaction,
          bundle.revision,
          cachedAt
        )
        if (bundle.assessment !== null) {
          await this.insertImmutableAssessment(
            transaction,
            bundle.assessment,
            cachedAt
          )
          await transaction.runAsync(
            `INSERT INTO dictionary_cefr_head_cache(
              entry_id, input_sha256, assessment_id, cached_at
            ) VALUES (?, ?, ?, ?)
            ON CONFLICT(entry_id, input_sha256) DO UPDATE SET
              assessment_id = excluded.assessment_id,
              cached_at = excluded.cached_at`,
            bundle.assessment.entry_id,
            bundle.assessment.input_sha256,
            bundle.assessment.assessment_id,
            cachedAt
          )
        } else if (bundle.refreshHead) {
          await transaction.runAsync(
            `DELETE FROM dictionary_cefr_head_cache WHERE entry_id = ? AND input_sha256 = ?`,
            bundle.revision.entry_id,
            bundle.revision.cefr_input_sha256
          )
        }
      }
    })
  }

  private async insertImmutableRevision(
    transaction: Awaited<ReturnType<typeof getDatabase>>,
    revision: DictionaryRevision,
    cachedAt: string
  ): Promise<void> {
    const contentJson = canonicalizeJson(revision.content)
    await transaction.runAsync(
      `INSERT OR IGNORE INTO dictionary_revision_cache(
        revision_id, entry_id, revision_no, schema_version, content_json,
        content_sha256, cefr_input_sha256, review_status, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      revision.revision_id,
      revision.entry_id,
      revision.revision_no,
      revision.schema_version,
      contentJson,
      revision.content_sha256,
      revision.cefr_input_sha256,
      revision.review_status,
      cachedAt
    )
    const existing = await transaction.getFirstAsync<CachedRevisionIdentity>(
      `SELECT entry_id, content_sha256, cefr_input_sha256, content_json
       FROM dictionary_revision_cache WHERE revision_id = ?`,
      [revision.revision_id]
    )
    if (
      existing === null ||
      existing.entry_id !== revision.entry_id ||
      existing.content_sha256 !== revision.content_sha256 ||
      existing.cefr_input_sha256 !== revision.cefr_input_sha256 ||
      existing.content_json !== contentJson
    ) {
      throw new Error('Dictionary revision identity conflict')
    }
  }

  private async insertImmutableAssessment(
    transaction: Awaited<ReturnType<typeof getDatabase>>,
    assessment: DictionaryCefrAssessment,
    cachedAt: string
  ): Promise<void> {
    await transaction.runAsync(
      `INSERT OR IGNORE INTO dictionary_cefr_assessment_cache(
        assessment_id, entry_id, input_sha256, cefr_level, status, confidence,
        method, method_version, locked, supersedes_assessment_id, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      assessment.assessment_id,
      assessment.entry_id,
      assessment.input_sha256,
      assessment.cefr_level,
      assessment.status,
      assessment.confidence,
      assessment.method,
      assessment.method_version,
      assessment.locked ? 1 : 0,
      assessment.supersedes_assessment_id,
      cachedAt
    )
    const existing = await transaction.getFirstAsync<CachedAssessmentIdentity>(
      `SELECT entry_id, input_sha256, cefr_level, status, confidence, method,
          method_version, locked, supersedes_assessment_id
         FROM dictionary_cefr_assessment_cache WHERE assessment_id = ?`,
      [assessment.assessment_id]
    )
    if (
      existing === null ||
      existing.entry_id !== assessment.entry_id ||
      existing.input_sha256 !== assessment.input_sha256 ||
      existing.cefr_level !== assessment.cefr_level ||
      existing.status !== assessment.status ||
      !sameNullableNumber(existing.confidence, assessment.confidence) ||
      existing.method !== assessment.method ||
      existing.method_version !== assessment.method_version ||
      Boolean(existing.locked) !== assessment.locked ||
      existing.supersedes_assessment_id !== assessment.supersedes_assessment_id
    ) {
      throw new Error('Dictionary assessment identity conflict')
    }
  }

  private async applyConflictResolution(
    transaction: Awaited<ReturnType<typeof getDatabase>>,
    parsed: readonly LocalDictionaryCardState[],
    resolution: DictionaryConflictResolution
  ): Promise<void> {
    if (
      parsed.length !== 1 ||
      parsed[0].word_id !== resolution.wordId ||
      parsed[0].user_id !== resolution.userId
    ) {
      throw new Error('Invalid conflict resolution owner')
    }
    const pending = await transaction.getAllAsync<{
      operation_id: string
      status: string
    }>(
      `SELECT operation_id, status FROM dictionary_content_commands
       WHERE user_id = ? AND word_id = ? ORDER BY sequence`,
      [resolution.userId, resolution.wordId]
    )
    if (
      !pending.some(row => row.status === 'conflict') ||
      JSON.stringify(pending.map(row => row.operation_id)) !==
        JSON.stringify(resolution.operationIds)
    ) {
      throw new Error(
        'Private edits changed. Reload the conflict before resolving it.'
      )
    }
    await transaction.runAsync(
      'DELETE FROM dictionary_content_commands WHERE user_id = ? AND word_id = ?',
      resolution.userId,
      resolution.wordId
    )
    if (!resolution.replacement) return
    const command = requireParsed(
      parseDictionaryContentCommand(resolution.replacement),
      'conflict resolution command'
    )
    if (
      command.word_id !== resolution.wordId ||
      command.kind !== 'resolve-conflict' ||
      command.expected_content_version + 1 !== parsed[0].content_version
    ) {
      throw new Error('Invalid conflict resolution command')
    }
    await transaction.runAsync(
      `INSERT INTO dictionary_content_commands(operation_id, user_id, word_id,
        kind, expected_content_version, payload_json, queued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      command.operation_id,
      resolution.userId,
      command.word_id,
      command.kind,
      command.expected_content_version,
      JSON.stringify(command),
      new Date().toISOString()
    )
  }

  async saveCardStates(
    states: readonly LocalDictionaryCardState[],
    acknowledgedCommands: readonly DictionaryContentCommand[] = [],
    resolution?: DictionaryConflictResolution
  ): Promise<void> {
    if (states.length === 0) return
    const parsed = states.map(state => this.parseCardState(state))
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      if (resolution)
        await this.applyConflictResolution(transaction, parsed, resolution)
      for (const state of parsed) {
        if (
          resolution ||
          acknowledgedCommands.some(
            command => command.word_id === state.word_id
          )
        ) {
          await transaction.runAsync(
            `INSERT OR IGNORE INTO dictionary_personal_refresh_queue(word_id, user_id) VALUES (?, ?)`,
            state.word_id,
            state.user_id
          )
        }
      }
      for (const command of acknowledgedCommands) {
        const state = parsed.find(row => row.word_id === command.word_id)
        if (
          !state ||
          state.content_version < command.expected_content_version + 1
        ) {
          throw new Error('Dictionary command result is incomplete')
        }
        await transaction.runAsync(
          `DELETE FROM dictionary_content_commands
           WHERE user_id = ? AND word_id = ? AND operation_id = ?`,
          state.user_id,
          state.word_id,
          command.operation_id
        )
      }
      for (const state of parsed) {
        await transaction.runAsync(
          'DELETE FROM dictionary_card_refresh_queue WHERE user_id = ? AND word_id = ?',
          state.user_id,
          state.word_id
        )
        // Projected versions are not server versions. An equal or newer remote
        // state cannot supersede a still-pending private edit.
        const pending = await transaction.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM dictionary_content_commands
           WHERE user_id = ? AND word_id = ?`,
          [state.user_id, state.word_id]
        )
        if (pending && pending.count > 0 && !resolution) continue
        await transaction.runAsync(
          `INSERT INTO dictionary_card_content(
            word_id, user_id, content_version, entry_id, revision_id,
            fallback_content_json, overrides_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(word_id) DO UPDATE SET
            user_id = excluded.user_id,
            content_version = excluded.content_version,
            entry_id = excluded.entry_id,
            revision_id = excluded.revision_id,
            fallback_content_json = excluded.fallback_content_json,
            overrides_json = excluded.overrides_json,
            updated_at = excluded.updated_at
          WHERE excluded.content_version >= dictionary_card_content.content_version OR ? = 1`,
          state.word_id,
          state.user_id,
          state.content_version,
          state.reference?.entry_id ?? null,
          state.reference?.revision_id ?? null,
          state.fallback_content === null
            ? null
            : canonicalizeJson(state.fallback_content),
          canonicalizeJson(state.overrides),
          state.updated_at,
          resolution ? 1 : 0
        )
      }
    })
  }

  private parseCardState(
    state: LocalDictionaryCardState
  ): LocalDictionaryCardState {
    if (
      !Number.isSafeInteger(state.content_version) ||
      state.content_version < 0
    ) {
      throw new Error('Invalid dictionary card content version')
    }
    const reference =
      state.reference === null
        ? null
        : requireParsed(
            parseDictionaryReference(state.reference),
            'dictionary card reference'
          )
    const fallback =
      state.fallback_content === null
        ? null
        : requireParsed(
            parseDictionaryContent(state.fallback_content),
            'dictionary fallback content'
          )
    const overrides = requireParsed(
      parseDictionaryContentOverrides(state.overrides),
      'dictionary overrides'
    )
    if ((reference === null) === (fallback === null)) {
      throw new Error(
        'Dictionary card requires exactly one reference or private fallback'
      )
    }
    return { ...state, reference, fallback_content: fallback, overrides }
  }

  async queueCommand(
    userId: string,
    value: DictionaryContentCommand,
    queuedAt = new Date().toISOString()
  ): Promise<void> {
    const command = requireParsed(
      parseDictionaryContentCommand(value),
      'dictionary content command'
    )
    const payload = JSON.stringify(command)
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      const existing = await transaction.getFirstAsync<{
        user_id: string
        word_id: string
        payload_json: string
      }>(
        `SELECT user_id, word_id, payload_json FROM dictionary_content_commands
         WHERE operation_id = ?`,
        [command.operation_id]
      )
      if (existing !== null) {
        if (
          existing.user_id !== userId ||
          existing.word_id !== command.word_id ||
          existing.payload_json !== payload
        ) {
          throw new Error('Dictionary command identity conflict')
        }
        return
      }
      await transaction.runAsync(
        `INSERT INTO dictionary_content_commands(
          operation_id, user_id, word_id, kind, expected_content_version,
          payload_json, queued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        command.operation_id,
        userId,
        command.word_id,
        command.kind,
        command.expected_content_version,
        payload,
        queuedAt
      )
    })
  }

  async getPendingCommands(userId: string): Promise<LocalDictionaryCommand[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<CommandRow>(
      `SELECT commands.sequence, commands.payload_json, commands.status,
              commands.queued_at, commands.last_error
       FROM dictionary_content_commands commands
       JOIN words ON words.word_id = commands.word_id AND words.user_id = commands.user_id
       WHERE commands.user_id = ? AND words.deleted_at IS NULL ORDER BY commands.sequence`,
      [userId]
    )
    return rows.map(row => ({
      sequence: row.sequence,
      command: requireParsed(
        parseDictionaryContentCommand(
          parseJson(row.payload_json, 'dictionary command')
        ),
        'cached dictionary command'
      ),
      status: row.status,
      queued_at: row.queued_at,
      last_error: row.last_error,
    }))
  }

  async markCommandIssue(
    userId: string,
    operationId: string,
    status: 'error' | 'conflict',
    message: string
  ): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `UPDATE dictionary_content_commands
       SET status = ?, last_error = ?
       WHERE user_id = ? AND operation_id = ?`,
      status,
      message,
      userId,
      operationId
    )
  }

  async acknowledgeCommand(userId: string, operationId: string): Promise<void> {
    const db = await getDatabase()
    await db.runAsync(
      `DELETE FROM dictionary_content_commands
       WHERE user_id = ? AND operation_id = ?`,
      userId,
      operationId
    )
  }

  async getChangeCursor(userId: string): Promise<number> {
    const db = await getDatabase()
    const row = await db.getFirstAsync<{ committed_version: number }>(
      `SELECT committed_version FROM dictionary_change_cursors
       WHERE user_id = ?`,
      [userId]
    )
    return row?.committed_version ?? 0
  }

  async getMissingCardWordIds(userId: string): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.getAllAsync<{ word_id: string }>(
      `SELECT words.word_id
       FROM words
       LEFT JOIN dictionary_card_content cards
         ON cards.word_id = words.word_id AND cards.user_id = words.user_id
       LEFT JOIN dictionary_card_refresh_queue refresh
         ON refresh.word_id = words.word_id AND refresh.user_id = words.user_id
       WHERE words.user_id = ?
         AND words.deleted_at IS NULL
         AND (cards.word_id IS NULL OR refresh.word_id IS NOT NULL)
       ORDER BY words.word_id`,
      [userId]
    )
    return rows.map(row => row.word_id)
  }

  async requireCardRefresh(
    userId: string,
    wordIds: readonly string[]
  ): Promise<void> {
    if (wordIds.length === 0) return
    const db = await getDatabase()
    await db.withExclusiveTransactionAsync(async transaction => {
      for (const wordId of wordIds) {
        await transaction.runAsync(
          `INSERT OR IGNORE INTO dictionary_card_refresh_queue(word_id, user_id)
           SELECT word_id, user_id FROM words
           WHERE word_id = ? AND user_id = ? AND deleted_at IS NULL`,
          wordId,
          userId
        )
      }
    })
  }

  async getWordIdsByEntryIds(
    userId: string,
    entryIds: readonly string[]
  ): Promise<string[]> {
    const uniqueIds = [...new Set(entryIds)]
    const wordIds: string[] = []
    const db = await getDatabase()
    for (
      let offset = 0;
      offset < uniqueIds.length;
      offset += QUERY_CHUNK_SIZE
    ) {
      const chunk = uniqueIds.slice(offset, offset + QUERY_CHUNK_SIZE)
      if (chunk.length === 0) continue
      const placeholders = chunk.map(() => '?').join(',')
      const rows = await db.getAllAsync<{ word_id: string }>(
        `SELECT cards.word_id FROM dictionary_card_content cards
         JOIN words ON words.word_id = cards.word_id AND words.user_id = cards.user_id
         WHERE cards.user_id = ? AND cards.entry_id IN (${placeholders})
           AND words.deleted_at IS NULL
         ORDER BY cards.word_id`,
        [userId, ...chunk] as SQLiteBindValue[]
      )
      wordIds.push(...rows.map(row => row.word_id))
    }
    return [...new Set(wordIds)]
  }

  async advanceChangeCursor(
    userId: string,
    committedVersion: number,
    updatedAt = new Date().toISOString()
  ): Promise<void> {
    if (!Number.isSafeInteger(committedVersion) || committedVersion < 0) {
      throw new Error('Invalid dictionary change cursor')
    }
    const db = await getDatabase()
    await db.runAsync(
      `INSERT INTO dictionary_change_cursors(
        user_id, committed_version, updated_at
      ) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        committed_version = excluded.committed_version,
        updated_at = excluded.updated_at
      WHERE excluded.committed_version >= dictionary_change_cursors.committed_version`,
      userId,
      committedVersion,
      updatedAt
    )
  }

  async getMaterializedContent(
    userId: string,
    wordIds: readonly string[]
  ): Promise<Map<string, LocalDictionaryMaterialization>> {
    const uniqueIds = [...new Set(wordIds)]
    if (uniqueIds.length > MAX_QUERY_WORD_IDS) {
      throw new Error(`Cannot hydrate more than ${MAX_QUERY_WORD_IDS} word IDs`)
    }
    const result = new Map<string, LocalDictionaryMaterialization>()
    const db = await getDatabase()
    for (
      let offset = 0;
      offset < uniqueIds.length;
      offset += QUERY_CHUNK_SIZE
    ) {
      const chunk = uniqueIds.slice(offset, offset + QUERY_CHUNK_SIZE)
      if (chunk.length === 0) continue
      const placeholders = chunk.map(() => '?').join(',')
      const rows = await db.getAllAsync<MaterializedRow>(
        `SELECT
          EXISTS(SELECT 1 FROM dictionary_content_commands commands
            WHERE commands.word_id = cards.word_id AND commands.user_id = cards.user_id
              AND commands.status = 'conflict') AS has_conflict,
          cards.word_id, cards.content_version, cards.entry_id,
          cards.revision_id AS pinned_revision_id,
          cards.fallback_content_json, cards.overrides_json,
          revisions.revision_id, revisions.entry_id AS revision_entry_id,
          revisions.revision_no, revisions.schema_version,
          revisions.content_json, revisions.content_sha256,
          revisions.cefr_input_sha256, revisions.review_status,
          assessments.assessment_id,
          assessments.entry_id AS assessment_entry_id,
          assessments.input_sha256 AS assessment_input_sha256,
          assessments.cefr_level, assessments.status AS assessment_status,
          assessments.confidence, assessments.method,
          assessments.method_version, assessments.locked,
          assessments.supersedes_assessment_id
        FROM dictionary_card_content cards
        LEFT JOIN dictionary_revision_cache revisions
          ON revisions.entry_id = cards.entry_id
          AND revisions.revision_id = cards.revision_id
        LEFT JOIN dictionary_cefr_head_cache heads
          ON heads.entry_id = revisions.entry_id
          AND heads.input_sha256 = revisions.cefr_input_sha256
        LEFT JOIN dictionary_cefr_assessment_cache assessments
          ON assessments.entry_id = heads.entry_id
          AND assessments.input_sha256 = heads.input_sha256
          AND assessments.assessment_id = heads.assessment_id
        WHERE cards.user_id = ? AND cards.word_id IN (${placeholders})
        ORDER BY cards.word_id`,
        [userId, ...chunk] as SQLiteBindValue[]
      )
      rows.forEach(row => result.set(row.word_id, this.materializeRow(row)))
    }
    return result
  }

  private materializeRow(row: MaterializedRow): LocalDictionaryMaterialization {
    const reference =
      row.entry_id === null || row.pinned_revision_id === null
        ? null
        : requireParsed(
            parseDictionaryReference({
              entry_id: row.entry_id,
              revision_id: row.pinned_revision_id,
            }),
            'cached dictionary reference'
          )
    const fallback =
      row.fallback_content_json === null
        ? null
        : requireParsed(
            parseDictionaryContent(
              parseJson(
                row.fallback_content_json,
                'dictionary fallback content'
              )
            ),
            'cached dictionary fallback content'
          )
    const overrides = requireParsed(
      parseDictionaryContentOverrides(
        parseJson(row.overrides_json, 'dictionary overrides')
      ),
      'cached dictionary overrides'
    )
    const revision = this.parseCachedRevision(row)
    const assessment = this.parseCachedAssessment(row)
    return {
      word_id: row.word_id,
      has_conflict: Boolean(row.has_conflict),
      content_version: row.content_version,
      reference,
      dependency_status:
        reference !== null && revision === null ? 'missing-revision' : 'ready',
      effective: resolveEffectiveDictionaryContent({
        reference,
        revision,
        fallback_content: fallback,
        overrides,
      }),
      cefr: resolveInheritedCefr({
        reference,
        revision,
        overrides,
        assessment,
      }),
    }
  }

  private parseCachedRevision(row: MaterializedRow): DictionaryRevision | null {
    if (row.revision_id === null) return null
    return requireParsed(
      parseDictionaryRevision({
        revision_id: row.revision_id,
        entry_id: row.revision_entry_id,
        revision_no: row.revision_no,
        schema_version: row.schema_version,
        content: parseJson(row.content_json ?? '', 'dictionary revision'),
        content_sha256: row.content_sha256,
        cefr_input_sha256: row.cefr_input_sha256,
        review_status: row.review_status,
      }),
      'cached dictionary revision'
    )
  }

  private parseCachedAssessment(
    row: MaterializedRow
  ): DictionaryCefrAssessment | null {
    if (row.assessment_id === null) return null
    return requireParsed(
      parseDictionaryCefrAssessment({
        assessment_id: row.assessment_id,
        entry_id: row.assessment_entry_id,
        input_sha256: row.assessment_input_sha256,
        cefr_level: row.cefr_level,
        status: row.assessment_status,
        confidence: row.confidence,
        method: row.method,
        method_version: row.method_version,
        locked: Boolean(row.locked),
        supersedes_assessment_id: row.supersedes_assessment_id,
      }),
      'cached dictionary assessment'
    )
  }
}

export const dictionaryContentRepository = new DictionaryContentRepository()
