import { dictionaryModeReconciliationRepository as modeRepository } from './dictionaryModeReconciliationRepository'
import type { Word } from '@/types/database'
import {
  applyDictionaryMaterialization,
  applyDictionaryMaterializations,
} from './dictionaryWordMaterialization'
import {
  isDictionaryContentEnabled,
  isDictionaryFollowingEnabled,
} from '@/constants/dictionaryContent'
import {
  dictionaryContentRepository,
  type LocalDictionaryMaterialization,
} from './dictionaryContentRepository'
import {
  dictionaryFollowingRepository,
  type CachedDictionaryEffectiveCard,
} from './dictionaryFollowingRepository'

export type DictionaryWordMaterialization =
  | LocalDictionaryMaterialization
  | (CachedDictionaryEffectiveCard & {
      dependency_status: 'ready'
      has_conflict: boolean
    })

const readSelection = async (userId: string) => {
  const pending = await dictionaryContentRepository.getPendingCommands(userId)
  const selectedIds = await modeRepository.getSelectedWordIds(userId)
  const requiredIds = await modeRepository.getRequiredWordIds(userId)
  return {
    pendingIds: new Set(pending.map(item => item.command.word_id)),
    selectedIds,
    requiredIds,
  }
}

const shouldSelectCachedCard = (
  id: string,
  mode: CachedDictionaryEffectiveCard['card']['mode'],
  selection: Awaited<ReturnType<typeof readSelection>>
): boolean =>
  mode === 'follow' ||
  ((isDictionaryFollowingEnabled() || selection.selectedIds.has(id)) &&
    !selection.pendingIds.has(id))

export const getDictionaryWordMaterializations = async (
  userId: string,
  wordIds: readonly string[]
): Promise<Map<string, DictionaryWordMaterialization>> => {
  if (!isDictionaryContentEnabled() || wordIds.length === 0) return new Map()
  const ids = [...new Set(wordIds)]
  const cached = await dictionaryFollowingRepository.getCachedCards(userId, ids)
  const selection = await readSelection(userId)
  const { pendingIds, requiredIds } = selection
  // Following content remains shared even after withdrawing the v2 build flag.
  // Legacy pending edits still use their preserved v1 projection/originals.
  const selected = new Map(
    [...cached].filter(([id, item]) =>
      shouldSelectCachedCard(id, item.card.mode, selection)
    )
  )
  const legacyIds = ids.filter(id => !selected.has(id))
  const result = new Map<string, DictionaryWordMaterialization>(
    legacyIds.length === 0
      ? []
      : await dictionaryContentRepository.getMaterializedContent(
          userId,
          legacyIds
        )
  )
  selected.forEach((item, id) =>
    result.set(id, {
      ...item,
      dependency_status: 'ready',
      has_conflict: pendingIds.has(id) || requiredIds.has(id),
    })
  )
  for (const id of requiredIds) {
    const item = result.get(id)
    if (item) result.set(id, { ...item, has_conflict: true })
  }
  return result
}

export const getDictionaryWordProjections = async (
  userId: string,
  words: readonly Word[]
): Promise<Word[]> => {
  if (!isDictionaryContentEnabled() || words.length === 0) return [...words]
  const byId = new Map(words.map(word => [word.word_id, word]))
  const ids = [...byId.keys()]
  // Preserve per-input learning fields even for callers supplying duplicate IDs.
  if (byId.size !== words.length)
    return applyDictionaryMaterializations(
      words,
      await getDictionaryWordMaterializations(userId, ids)
    )

  const projected = await dictionaryFollowingRepository.mapCachedCards(
    userId,
    ids,
    item => {
      const word = byId.get(item.card.word_id)
      if (!word) throw new Error('Dictionary projection identity conflict')
      return {
        mode: item.card.mode,
        word: applyDictionaryMaterialization(word, {
          ...item,
          dependency_status: 'ready',
          has_conflict: false,
        }),
      }
    }
  )
  // Keep cache, pending-command and reconciliation reads in their original order.
  const selection = await readSelection(userId)
  for (const [id, item] of projected)
    if (!shouldSelectCachedCard(id, item.mode, selection)) projected.delete(id)
  const legacyIds = ids.filter(id => !projected.has(id))
  const legacy =
    legacyIds.length === 0
      ? new Map<string, LocalDictionaryMaterialization>()
      : await dictionaryContentRepository.getMaterializedContent(
          userId,
          legacyIds
        )

  return words.map(word => {
    const id = word.word_id
    const item = projected.get(id)
    if (item) {
      const conflict =
        selection.pendingIds.has(id) || selection.requiredIds.has(id)
      return conflict
        ? { ...item.word, dictionary_content_conflict: true }
        : item.word
    }
    const materialization = legacy.get(id)
    return applyDictionaryMaterialization(
      word,
      materialization && selection.requiredIds.has(id)
        ? { ...materialization, has_conflict: true }
        : materialization
    )
  })
}
