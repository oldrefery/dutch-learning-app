import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { wordRepository } from '@/db/wordRepository'
import { supabase } from '@/lib/supabase'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { randomUUID } from 'expo-crypto'
import type { LocalDictionaryCardState } from '@/db/dictionaryContentRepository'
import {
  DICTIONARY_CONTENT_PROTOCOL_VERSION,
  parseDictionaryCefrAssessment,
  parseDictionaryContent,
  parseDictionaryContentCapability,
  parseDictionaryReference,
  parseDictionaryRevision,
  type DictionaryCefrAssessment,
  type DictionaryContent,
  type DictionaryContentCommand,
  type DictionaryContentOverrides,
  type DictionaryReference,
  type DictionaryRevision,
} from '@woordenaar/domain'

const CARD_CHUNK_SIZE = 500

export interface DictionaryConflictSnapshot {
  userId: string
  wordId: string
  operationIds: string[]
  localContent: DictionaryContent
  remoteContent: DictionaryContent
  remoteState: LocalDictionaryCardState
}

export class DictionaryContentConflictError extends Error {}
const QUERY_CHUNK_SIZE = 400
const CONFLICT_CODES = new Set(['40001', '23505', 'PT409'])
const CONFLICT_MESSAGES = [
  'stale-content-version',
  'operation-intent-mismatch',
  'semantic-key-conflict',
  'invalid-revision',
  'legacy-content-upgrade-required',
]

interface EffectiveCard {
  word_id: string
  content_version: number
  reference: DictionaryReference | null
  content: DictionaryContent
  cefr_status: 'unknown' | 'estimated' | 'reviewed'
}

interface ContentStateRow {
  word_id: string
  user_id: string
  content_version: number
  fallback_content: DictionaryContent | null
  overrides: DictionaryContentOverrides
  updated_at: string
}

interface CefrHeadRow {
  entry_id: string
  input_sha256: string
  assessment_id: string
}

interface DictionaryCommandReceipt {
  protocol_version: number
  operation_id: string
  word_id: string
  content_version: number
  kind: DictionaryContentCommand['kind']
  idempotent: boolean
}

interface DictionaryContentChange {
  cursor: number
  kind: 'revision-head' | 'cefr-head'
  entry_id: string
}

interface DictionaryContentChangePage {
  next_cursor: number
  has_more: boolean
  changes: DictionaryContentChange[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const requireArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Missing ${label} response`)
  return value
}

const requireInteger = (value: unknown, label: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${label}`)
  }
  return value as number
}

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${label}`)
  }
  return value
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

const chunked = <Value>(values: readonly Value[], size: number): Value[][] => {
  const chunks: Value[][] = []
  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size))
  }
  return chunks
}

const headKey = (entryId: string, inputSha256: string): string =>
  `${entryId}:${inputSha256}`

const parseEffectiveCard = (value: unknown): EffectiveCard => {
  if (!isRecord(value)) throw new Error('Invalid effective dictionary card')
  const reference =
    value.reference === null
      ? null
      : requireParsed(
          parseDictionaryReference(value.reference),
          'effective dictionary reference'
        )
  const content = requireParsed(
    parseDictionaryContent(value.content),
    'effective dictionary content'
  )
  if (
    !isRecord(value.cefr) ||
    !['unknown', 'estimated', 'reviewed'].includes(String(value.cefr.status))
  ) {
    throw new Error('Invalid effective dictionary CEFR state')
  }
  return {
    word_id: requireString(value.word_id, 'effective dictionary word ID'),
    content_version: requireInteger(
      value.content_version,
      'effective dictionary content version'
    ),
    reference,
    content,
    cefr_status: value.cefr.status as EffectiveCard['cefr_status'],
  }
}

const parseEffectiveCards = (value: unknown): EffectiveCard[] => {
  if (
    !isRecord(value) ||
    value.protocol_version !== DICTIONARY_CONTENT_PROTOCOL_VERSION
  ) {
    throw new Error('Unsupported dictionary content response')
  }
  return requireArray(value.cards, 'effective dictionary cards').map(
    parseEffectiveCard
  )
}

const validateEffectiveCardDependencies = (
  cards: readonly EffectiveCard[],
  revisionsById: ReadonlyMap<string, DictionaryRevision>,
  assessmentsByKey: ReadonlyMap<string, DictionaryCefrAssessment>
): void => {
  for (const card of cards) {
    if (card.reference === null) continue
    const revision = revisionsById.get(card.reference.revision_id)
    if (!revision || revision.entry_id !== card.reference.entry_id) {
      throw new Error(`Missing dictionary revision for ${card.word_id}`)
    }
    const assessmentKey = headKey(revision.entry_id, revision.cefr_input_sha256)
    if (
      card.cefr_status !== 'unknown' &&
      !assessmentsByKey.has(assessmentKey)
    ) {
      throw new Error(`Missing dictionary CEFR assessment for ${card.word_id}`)
    }
  }
}

const toLocalCardState = (
  card: EffectiveCard,
  state: ContentStateRow | undefined,
  userId: string,
  now: string
): LocalDictionaryCardState => {
  if (
    (!state && card.content_version > 0) ||
    (state && state.content_version !== card.content_version)
  ) {
    throw new Error(`Dictionary content version mismatch for ${card.word_id}`)
  }
  return {
    word_id: card.word_id,
    user_id: userId,
    content_version: card.content_version,
    reference: card.reference,
    fallback_content:
      card.reference === null
        ? (state?.fallback_content ?? card.content)
        : null,
    overrides: state?.overrides ?? {},
    updated_at: state?.updated_at ?? now,
  }
}

const parseContentState = (value: unknown, userId: string): ContentStateRow => {
  if (!isRecord(value) || value.user_id !== userId) {
    throw new Error('Invalid dictionary content state owner')
  }
  const fallback =
    value.fallback_content === null
      ? null
      : requireParsed(
          parseDictionaryContent(value.fallback_content),
          'dictionary fallback content'
        )
  if (!isRecord(value.overrides)) {
    throw new Error('Invalid dictionary content overrides')
  }
  return {
    word_id: requireString(value.word_id, 'dictionary content state word ID'),
    user_id: userId,
    content_version: requireInteger(
      value.content_version,
      'dictionary content state version'
    ),
    fallback_content: fallback,
    overrides: value.overrides as DictionaryContentOverrides,
    updated_at: requireString(
      value.updated_at,
      'dictionary content state timestamp'
    ),
  }
}

const parseRevision = (value: unknown): DictionaryRevision =>
  requireParsed(parseDictionaryRevision(value), 'dictionary revision')

const parseAssessment = (value: unknown): DictionaryCefrAssessment =>
  requireParsed(parseDictionaryCefrAssessment(value), 'dictionary assessment')

const parseHead = (value: unknown): CefrHeadRow => {
  if (!isRecord(value)) throw new Error('Invalid dictionary CEFR head')
  return {
    entry_id: requireString(value.entry_id, 'dictionary CEFR head entry ID'),
    input_sha256: requireString(
      value.input_sha256,
      'dictionary CEFR head input digest'
    ),
    assessment_id: requireString(
      value.assessment_id,
      'dictionary CEFR head assessment ID'
    ),
  }
}

const parseReceipt = (
  value: unknown,
  command: DictionaryContentCommand
): DictionaryCommandReceipt => {
  if (!isRecord(value)) throw new Error('Missing dictionary command receipt')
  if (
    value.protocol_version !== DICTIONARY_CONTENT_PROTOCOL_VERSION ||
    value.operation_id !== command.operation_id ||
    value.word_id !== command.word_id ||
    value.kind !== command.kind ||
    value.content_version !== command.expected_content_version + 1 ||
    typeof value.idempotent !== 'boolean'
  ) {
    throw new Error('Invalid dictionary command receipt')
  }
  return value as unknown as DictionaryCommandReceipt
}

const parseChangePage = (
  value: unknown,
  requestedAfter: number
): DictionaryContentChangePage => {
  if (
    !isRecord(value) ||
    value.protocol_version !== DICTIONARY_CONTENT_PROTOCOL_VERSION ||
    value.after !== requestedAfter ||
    typeof value.has_more !== 'boolean'
  ) {
    throw new Error('Invalid dictionary change page')
  }
  const nextCursor = requireInteger(
    value.next_cursor,
    'dictionary change next cursor'
  )
  const latestCursor = requireInteger(
    value.latest_cursor,
    'dictionary change latest cursor'
  )
  if (
    nextCursor < requestedAfter ||
    latestCursor < nextCursor ||
    (value.has_more && nextCursor === requestedAfter)
  ) {
    throw new Error('Invalid dictionary change cursor progression')
  }
  let previousCursor = requestedAfter
  const changes = requireArray(value.changes, 'dictionary changes').map(row => {
    if (
      !isRecord(row) ||
      (row.kind !== 'revision-head' && row.kind !== 'cefr-head')
    ) {
      throw new Error('Invalid dictionary change')
    }
    const kind: DictionaryContentChange['kind'] = row.kind
    const cursor = requireInteger(row.cursor, 'dictionary change cursor')
    if (cursor <= previousCursor || cursor > nextCursor) {
      throw new Error('Invalid dictionary change ordering')
    }
    previousCursor = cursor
    return {
      cursor,
      kind,
      entry_id: requireString(row.entry_id, 'dictionary change entry ID'),
    }
  })
  if (changes.length > 0 && changes[changes.length - 1].cursor !== nextCursor) {
    throw new Error('Dictionary change page cursor does not match its changes')
  }
  return { next_cursor: nextCursor, has_more: value.has_more, changes }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const isUnsupportedFunction = (error: { code?: string } | null): boolean =>
  error?.code === 'PGRST202' || error?.code === '42883'

const ensureDictionaryIdentity = async (userId: string): Promise<void> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (data.user?.id !== userId) {
    throw new Error('Authentication changed during dictionary synchronization')
  }
}

const isCommandConflict = (error: {
  code?: string
  message?: string
}): boolean =>
  CONFLICT_CODES.has(error.code ?? '') ||
  CONFLICT_MESSAGES.some(message => error.message?.includes(message))

export const dictionaryContentSync = {
  async readConflict(
    userId: string,
    wordId: string
  ): Promise<DictionaryConflictSnapshot> {
    await ensureDictionaryIdentity(userId)
    const commands = (
      await dictionaryContentRepository.getPendingCommands(userId)
    ).filter(row => row.command.word_id === wordId)
    if (!commands.some(row => row.status === 'conflict'))
      throw new Error('No content conflict to resolve')
    const local = (
      await dictionaryContentRepository.getMaterializedContent(userId, [wordId])
    ).get(wordId)
    const localContent = requireParsed(
      parseDictionaryContent(local?.effective.content),
      'local conflict content'
    )
    const { data, error } = await supabase.rpc(
      'get_dictionary_effective_content_v1',
      { p_word_ids: [wordId] }
    )
    if (error) throw error
    const cards = parseEffectiveCards(data)
    const card = cards[0]
    if (cards.length !== 1 || card.word_id !== wordId)
      throw new Error('Conflict word is unavailable')
    const states = await this.fetchContentStates(userId, [wordId])
    const state = states.find(row => row.word_id === wordId)
    if (
      (!state && card.content_version > 0) ||
      (state && state.content_version !== card.content_version)
    ) {
      throw new Error('Server content changed. Reload the conflict.')
    }
    // Validate and cache dependencies without replacing the pending local edit.
    await this.pull(userId, [wordId])
    await ensureDictionaryIdentity(userId)
    return {
      userId,
      wordId,
      operationIds: commands.map(row => row.command.operation_id),
      localContent,
      remoteContent: card.content,
      remoteState: {
        word_id: wordId,
        user_id: userId,
        reference: card.reference,
        content_version: card.content_version,
        overrides: state?.overrides ?? {},
        fallback_content: card.reference
          ? null
          : (state?.fallback_content ?? card.content),
        updated_at: state?.updated_at ?? new Date().toISOString(),
      },
    }
  },

  async resolveConflict(
    snapshot: DictionaryConflictSnapshot,
    choice: 'local' | 'server'
  ): Promise<void> {
    await ensureDictionaryIdentity(snapshot.userId)
    const { data, error } = await supabase.rpc(
      'get_dictionary_effective_content_v1',
      { p_word_ids: [snapshot.wordId] }
    )
    if (error) throw error
    const cards = parseEffectiveCards(data)
    if (
      cards.length !== 1 ||
      cards[0].word_id !== snapshot.wordId ||
      cards[0].content_version !== snapshot.remoteState.content_version
    ) {
      throw new Error('Server content changed. Reload the conflict.')
    }
    const replacement: DictionaryContentCommand | null =
      choice === 'local'
        ? {
            protocol_version: 1,
            operation_id: randomUUID(),
            word_id: snapshot.wordId,
            expected_content_version: snapshot.remoteState.content_version,
            kind: 'resolve-conflict',
            content: snapshot.localContent,
          }
        : null
    const state: LocalDictionaryCardState = replacement
      ? {
          ...snapshot.remoteState,
          content_version: replacement.expected_content_version + 1,
          reference: null,
          fallback_content: snapshot.localContent,
          overrides: {},
          updated_at: new Date().toISOString(),
        }
      : snapshot.remoteState
    await ensureDictionaryIdentity(snapshot.userId)
    await dictionaryContentRepository.saveCardStates([state], [], {
      userId: snapshot.userId,
      wordId: snapshot.wordId,
      operationIds: snapshot.operationIds,
      replacement,
    })
  },

  async isAvailable(): Promise<boolean> {
    if (!isDictionaryContentEnabled()) return false
    const { data, error } = await supabase.rpc(
      'dictionary_content_capability_v1'
    )
    if (isUnsupportedFunction(error)) return false
    if (error) throw error
    return parseDictionaryContentCapability(data).success
  },

  async pull(
    userId: string,
    requestedWordIds?: readonly string[],
    acknowledgedCommands: readonly DictionaryContentCommand[] = []
  ): Promise<number> {
    await ensureDictionaryIdentity(userId)

    const requested =
      requestedWordIds === undefined
        ? (await wordRepository.getWordsByUserId(userId)).map(
            word => word.word_id
          )
        : [...new Set(requestedWordIds)]
    if (requested.length === 0) return 0
    const requestedSet = new Set(requested)
    const effectiveCards: EffectiveCard[] = []

    for (const wordIds of chunked(requested, CARD_CHUNK_SIZE)) {
      const { data, error } = await supabase.rpc(
        'get_dictionary_effective_content_v1',
        { p_word_ids: wordIds }
      )
      if (error) throw error
      const cards = parseEffectiveCards(data)
      if (cards.some(card => !requestedSet.has(card.word_id))) {
        throw new Error('Dictionary response contains an unrequested word')
      }
      effectiveCards.push(...cards)
    }

    const cardIds = effectiveCards.map(card => card.word_id)
    const uniqueCardIds = new Set(cardIds)
    if (uniqueCardIds.size !== cardIds.length) {
      throw new Error('Dictionary response contains duplicate cards')
    }
    const states = await this.fetchContentStates(userId, cardIds)
    const revisions = await this.fetchRevisions(effectiveCards)
    const assessments = await this.fetchAssessments(revisions)

    const revisionsById = new Map(
      revisions.map(revision => [revision.revision_id, revision])
    )
    const assessmentsByKey = new Map(
      assessments.map(assessment => [
        headKey(assessment.entry_id, assessment.input_sha256),
        assessment,
      ])
    )
    validateEffectiveCardDependencies(
      effectiveCards,
      revisionsById,
      assessmentsByKey
    )

    await dictionaryContentRepository.cacheDependencies(
      revisions.map(revision => ({
        revision,
        assessment:
          assessmentsByKey.get(
            headKey(revision.entry_id, revision.cefr_input_sha256)
          ) ?? null,
      }))
    )

    const stateByWordId = new Map(states.map(state => [state.word_id, state]))
    for (const command of acknowledgedCommands) {
      const card = effectiveCards.find(row => row.word_id === command.word_id)
      if (
        !card ||
        card.content_version < command.expected_content_version + 1
      ) {
        throw new Error('Dictionary command result is incomplete')
      }
    }
    await ensureDictionaryIdentity(userId)
    const now = new Date().toISOString()
    await dictionaryContentRepository.saveCardStates(
      effectiveCards.map(card =>
        toLocalCardState(card, stateByWordId.get(card.word_id), userId, now)
      ),
      acknowledgedCommands
    )
    return effectiveCards.length
  },

  async pullRequired(
    userId: string,
    candidateWordIds: readonly string[] = []
  ): Promise<number> {
    const missingWordIds =
      await dictionaryContentRepository.getMissingCardWordIds(userId)
    const wordIds = [...new Set([...candidateWordIds, ...missingWordIds])]
    return wordIds.length === 0 ? 0 : this.pull(userId, wordIds)
  },

  async refreshChanges(userId: string): Promise<number> {
    await ensureDictionaryIdentity(userId)
    let after = await dictionaryContentRepository.getChangeCursor(userId)
    let refreshedChanges = 0
    while (true) {
      const { data, error } = await supabase.rpc(
        'get_dictionary_content_changes_v1',
        { p_after: after, p_limit: 200 }
      )
      if (error) throw error
      const page = parseChangePage(data, after)
      const entryIds = [...new Set(page.changes.map(change => change.entry_id))]
      const wordIds = await dictionaryContentRepository.getWordIdsByEntryIds(
        userId,
        entryIds
      )
      if (wordIds.length > 0) {
        // Keep known change-page work visible and retryable across failed pulls.
        await dictionaryContentRepository.requireCardRefresh(userId, wordIds)
        const hydrated = await this.pull(userId, wordIds)
        if (hydrated !== wordIds.length) {
          throw new Error('Dictionary change dependencies were not hydrated')
        }
      }
      await dictionaryContentRepository.advanceChangeCursor(
        userId,
        page.next_cursor
      )
      refreshedChanges += page.changes.length
      after = page.next_cursor
      if (!page.has_more) return refreshedChanges
    }
  },

  async fetchContentStates(
    userId: string,
    wordIds: readonly string[]
  ): Promise<ContentStateRow[]> {
    const states: ContentStateRow[] = []
    for (const chunk of chunked(wordIds, QUERY_CHUNK_SIZE)) {
      if (chunk.length === 0) continue
      const { data, error } = await supabase
        .from('word_content_state')
        .select(
          'word_id,user_id,content_version,fallback_content,overrides,updated_at'
        )
        .eq('user_id', userId)
        .in('word_id', chunk)
      if (error) throw error
      states.push(
        ...requireArray(data, 'dictionary content states').map(value =>
          parseContentState(value, userId)
        )
      )
    }
    return states
  },

  async fetchRevisions(
    cards: readonly EffectiveCard[]
  ): Promise<DictionaryRevision[]> {
    const references = cards.flatMap(card =>
      card.reference === null ? [] : [card.reference]
    )
    const revisionIds = [...new Set(references.map(row => row.revision_id))]
    const revisions: DictionaryRevision[] = []
    for (const chunk of chunked(revisionIds, QUERY_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('dictionary_revisions')
        .select(
          'revision_id,entry_id,revision_no,schema_version,content,content_sha256,cefr_input_sha256,review_status'
        )
        .in('revision_id', chunk)
      if (error) throw error
      revisions.push(
        ...requireArray(data, 'dictionary revisions').map(parseRevision)
      )
    }
    return revisions
  },

  async fetchAssessments(
    revisions: readonly DictionaryRevision[]
  ): Promise<DictionaryCefrAssessment[]> {
    const entryIds = [...new Set(revisions.map(revision => revision.entry_id))]
    const expectedHeads = new Set(
      revisions.map(revision =>
        headKey(revision.entry_id, revision.cefr_input_sha256)
      )
    )
    const heads: CefrHeadRow[] = []
    for (const chunk of chunked(entryIds, QUERY_CHUNK_SIZE)) {
      for (let offset = 0; ; offset += QUERY_CHUNK_SIZE) {
        const { data, error } = await supabase
          .from('dictionary_cefr_heads')
          .select('entry_id,input_sha256,assessment_id')
          .in('entry_id', chunk)
          .order('entry_id')
          .order('input_sha256')
          .range(offset, offset + QUERY_CHUNK_SIZE - 1)
        if (error) throw error
        const rows = requireArray(data, 'dictionary CEFR heads')
        heads.push(
          ...rows
            .map(parseHead)
            .filter(head =>
              expectedHeads.has(headKey(head.entry_id, head.input_sha256))
            )
        )
        if (rows.length < QUERY_CHUNK_SIZE) break
      }
    }

    const assessmentIds = [...new Set(heads.map(head => head.assessment_id))]
    const assessments: DictionaryCefrAssessment[] = []
    for (const chunk of chunked(assessmentIds, QUERY_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('dictionary_cefr_assessments')
        .select(
          'assessment_id,entry_id,input_sha256,cefr_level,status,confidence,method,method_version,locked,supersedes_assessment_id'
        )
        .in('assessment_id', chunk)
      if (error) throw error
      assessments.push(
        ...requireArray(data, 'dictionary CEFR assessments').map(
          parseAssessment
        )
      )
    }
    const assessmentsById = new Map(
      assessments.map(assessment => [assessment.assessment_id, assessment])
    )
    for (const head of heads) {
      const assessment = assessmentsById.get(head.assessment_id)
      if (
        !assessment ||
        assessment.entry_id !== head.entry_id ||
        assessment.input_sha256 !== head.input_sha256
      ) {
        throw new Error('Missing dictionary CEFR head dependency')
      }
    }
    return assessments
  },

  async push(userId: string): Promise<number> {
    await ensureDictionaryIdentity(userId)
    const commands =
      await dictionaryContentRepository.getPendingCommands(userId)
    const blockedWords = new Set<string>()
    const appliedByWord = new Map<
      string,
      { command: DictionaryContentCommand; receipt: DictionaryCommandReceipt }[]
    >()
    for (const pending of commands) {
      const command = pending.command
      if (pending.status === 'conflict') {
        blockedWords.add(command.word_id)
        continue
      }
      if (blockedWords.has(command.word_id)) continue
      await ensureDictionaryIdentity(userId)
      const { data, error } = await supabase.rpc(
        'apply_dictionary_content_command_v1',
        { p_command: command }
      )
      if (error) {
        const message = error.message ?? 'Dictionary command failed'
        if (isCommandConflict(error)) {
          await dictionaryContentRepository.markCommandIssue(
            userId,
            command.operation_id,
            'conflict',
            message
          )
          blockedWords.add(command.word_id)
          continue
        }
        await dictionaryContentRepository.markCommandIssue(
          userId,
          command.operation_id,
          'error',
          message
        )
        throw error
      }
      const receipt = parseReceipt(data, command)
      const applied = appliedByWord.get(command.word_id) ?? []
      applied.push({ command, receipt })
      appliedByWord.set(command.word_id, applied)
    }

    const completed = [...appliedByWord].filter(
      ([wordId]) => !blockedWords.has(wordId)
    )
    const wordIds = completed.map(([wordId]) => wordId)
    const appliedCommands = completed.flatMap(([, applied]) =>
      applied.map(item => item.command)
    )
    if (wordIds.length > 0) {
      const hydrated = await this.pull(userId, wordIds, appliedCommands)
      if (hydrated !== wordIds.length) {
        throw new Error('Dictionary command result was not hydrated')
      }
    }
    if (blockedWords.size > 0) {
      throw new DictionaryContentConflictError(
        'Dictionary content conflicts need resolution. Open the word details to compare versions. Your private edits are saved on this device.'
      )
    }
    return appliedCommands.length
  },

  describeError(error: unknown): string {
    return errorMessage(error)
  },
}
