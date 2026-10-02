'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/features/words/word-detail'
import type { WordActionState } from '@/features/words/form-state'
import {
  applyDictionaryCommand,
  readDictionaryWriteState,
  staleContentMessage,
} from './commands'
import {
  getAvailableRevision,
  hydrateOwnedWords,
  isDictionaryContentEnabled,
} from './repository'

export async function adoptDictionaryRevision(
  collectionId: string,
  wordId: string,
  _state: WordActionState,
  formData: FormData
): Promise<WordActionState> {
  const auth = await requireAuthContext()
  if (
    auth.accessLevel !== 'full_access' ||
    !isDictionaryContentEnabled() ||
    !isUuid(collectionId) ||
    !isUuid(wordId)
  ) {
    return { status: 'error', message: 'This content update is not available.' }
  }
  try {
    const client = await createClient()
    const owned = await client
      .from('words')
      .select('word_id')
      .eq('word_id', wordId)
      .eq('collection_id', collectionId)
      .eq('user_id', auth.userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (owned.error || !owned.data)
      throw new Error('The word could not be found.')
    const [word] = await hydrateOwnedWords(client, [owned.data])
    const reference = word.dictionary?.reference
    if (!reference) throw new Error(staleContentMessage)
    const candidate = await getAvailableRevision(client, reference)
    if (!candidate || candidate.revision_id !== formData.get('revisionId'))
      throw new Error(staleContentMessage)
    const state = await readDictionaryWriteState(
      client,
      auth.userId,
      wordId,
      formData
    )
    await applyDictionaryCommand(client, {
      protocol_version: 1,
      operation_id: randomUUID(),
      word_id: wordId,
      expected_content_version: state.version,
      kind: 'adopt-revision',
      reference: candidate,
      overrides: state.overrides,
    })
    revalidatePath('/app', 'layout')
    return {
      status: 'success',
      message:
        'Dictionary content updated. Private changes and learning progress were preserved.',
    }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Could not update the dictionary content.',
    }
  }
}
