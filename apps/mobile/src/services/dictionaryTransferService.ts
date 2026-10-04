import {
  parseDictionaryCollectionExport,
  toLocalDateKey,
  type DictionaryContent,
} from '@woordenaar/domain'
import { randomUUID } from 'expo-crypto'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { applyDictionaryMaterializations } from '@/db/dictionaryWordMaterialization'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { isValidExpressionType } from '@/types/ExpressionTypes'
import type { Word } from '@/types/database'
import type { ImportPreviewData } from '@/types/ImportTypes'

export const MAX_DICTIONARY_TRANSFER_TEXT_LENGTH = 10_000_000

export function parseDictionaryTransferText(text: string) {
  if (text.length > MAX_DICTIONARY_TRANSFER_TEXT_LENGTH)
    throw new Error('This dictionary document is too large.')
  try {
    return parseDictionaryCollectionExport(JSON.parse(text) as unknown)
  } catch {
    throw new Error('Invalid dictionary collection document.')
  }
}

export function serializeDictionaryTransfer(value: unknown): string {
  const text = JSON.stringify(parseDictionaryCollectionExport(value))
  if (text.length > MAX_DICTIONARY_TRANSFER_TEXT_LENGTH)
    throw new Error('This dictionary document is too large.')
  return text
}

const createPrivateCopy = (
  content: DictionaryContent,
  wordId: string,
  userId: string,
  collectionId: string | null,
  now: string
): Word => {
  if (
    content.expression_type !== null &&
    !isValidExpressionType(content.expression_type)
  )
    throw new Error('This dictionary expression type is not supported.')
  return {
    ...content,
    expression_type: content.expression_type,
    examples: content.examples.map(example => ({
      ...example,
      ru: example.ru ?? undefined,
    })),
    conjugation:
      content.conjugation === null
        ? null
        : {
            ...content.conjugation,
            simple_past_plural:
              content.conjugation.simple_past_plural ?? undefined,
          },
    usage_notes:
      content.usage_notes === null
        ? null
        : {
            ...content.usage_notes,
            contrasts: content.usage_notes.contrasts.map(contrast => ({
              ...contrast,
              example:
                contrast.example === null
                  ? undefined
                  : {
                      ...contrast.example,
                      ru: contrast.example.ru ?? undefined,
                    },
            })),
          },
    word_id: wordId,
    user_id: userId,
    collection_id: collectionId,
    interval_days: 0,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: toLocalDateKey(new Date(now)),
    last_reviewed_at: null,
    created_at: now,
    updated_at: now,
  }
}

/** Preview identifiers are document indexes, never personal or dictionary IDs. */
export function previewDictionaryTransfer(text: string): ImportPreviewData {
  const document = parseDictionaryTransferText(text)
  const now = new Date().toISOString()
  return {
    collection: { name: document.collection.name },
    words: document.entries.map((entry, index) => {
      const {
        user_id: _owner,
        interval_days: _interval,
        repetition_count: _count,
        easiness_factor: _factor,
        next_review_date: _next,
        last_reviewed_at: _last,
        ...word
      } = createPrivateCopy(entry.content, String(index), '', null, now)
      return word
    }),
  }
}

export async function importOfflineDictionaryCollection(
  text: string,
  collectionId: string,
  selectedEntryIds: readonly string[],
  expectedOwner: string
) {
  if (!isDictionaryContentEnabled())
    throw new Error('Dictionary transfer is unavailable.')
  const assertOwner = () => {
    const activeOwner = useApplicationStore.getState().currentUserId
    if (!activeOwner || activeOwner !== expectedOwner)
      throw new Error('The active account changed.')
  }
  assertOwner()
  const document = parseDictionaryTransferText(text)
  const selected = new Set(selectedEntryIds)
  if (
    !selected.size ||
    selected.size !== selectedEntryIds.length ||
    selectedEntryIds.some(
      id => !/^(0|[1-9]\d*)$/.test(id) || Number(id) >= document.entries.length
    )
  )
    throw new Error('Please select valid document entries to import.')
  const now = new Date().toISOString()
  const words = document.entries.flatMap((entry, index) =>
    selected.has(String(index))
      ? [
          createPrivateCopy(
            entry.content,
            randomUUID(),
            expectedOwner,
            collectionId,
            now
          ),
        ]
      : []
  )
  const inserted = await wordRepository.importPrivateCopies(
    words,
    expectedOwner,
    collectionId,
    assertOwner
  )
  return {
    importedCount: inserted.length,
    skippedCount: words.length - inserted.length,
  }
}

/** Export current owned offline content; learning state and reference IDs stay local. */
export async function exportOfflineDictionaryCollection(collectionId: string) {
  const userId = useApplicationStore.getState().currentUserId
  if (!userId) throw new Error('Authentication is required.')
  const collections = await collectionRepository.getCollectionsByUserId(userId)
  const collection = collections.find(
    item => item.collection_id === collectionId
  )
  if (!collection) throw new Error('Collection not found or access denied.')
  const words = (await wordRepository.getWordsByUserId(userId)).filter(
    word => word.collection_id === collectionId
  )
  const materializations = isDictionaryContentEnabled()
    ? await dictionaryContentRepository.getMaterializedContent(
        userId,
        words.map(word => word.word_id)
      )
    : new Map()
  if (
    isDictionaryContentEnabled() &&
    words.some(word => {
      const card = materializations.get(word.word_id)
      return (
        !card ||
        card.dependency_status !== 'ready' ||
        card.effective.content === null
      )
    })
  )
    throw new Error('Dictionary content is incomplete. Sync before exporting.')
  if (useApplicationStore.getState().currentUserId !== userId)
    throw new Error('The active account changed.')
  return parseDictionaryCollectionExport({
    schema_version: 1,
    collection: { name: collection.name },
    entries: applyDictionaryMaterializations(words, materializations).map(
      word => ({ content: wordToDictionaryContent(word) })
    ),
  })
}
