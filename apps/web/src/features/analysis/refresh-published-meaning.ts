'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryAnalysisDatabase } from '@woordenaar/supabase-contracts'
import {
  createDictionaryAnalysisRemoteClient,
  dictionaryAnalysisActionMessage,
  isDictionaryAnalysisTerminal,
  parseDictionaryEntryHistoryV2,
  withDictionaryAnalysisOwner,
  type DictionaryCollectionExportV2,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createBrowserAnalysisJournal } from '@/features/dictionary/analysis-journal'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'

type Entry = DictionaryCollectionExportV2['entries'][number]

export async function refreshPublishedMeaning(userId: string, entry: Entry) {
  const reference = entry.shared_reference?.reference
  if (!reference) throw new Error('This meaning has no shared reference.')
  const { entry_id, revision_id } = reference
  const sdk =
    createClient() as unknown as SupabaseClient<DictionaryAnalysisDatabase>
  return withDictionaryAnalysisOwner(userId, sdk.auth, async owner => {
    const readHead = async () => {
      const { data, error } = await sdk.rpc('get_dictionary_entry_history_v2', {
        p_entry: entry_id,
        p_limit: 1,
      })
      await owner.check()
      const history = parseDictionaryEntryHistoryV2(data, entry_id, null, 1)
      if (error || !history.success)
        throw new Error('Could not verify the current dictionary version.')
      return history.data
    }
    let updated: Entry | undefined
    const reload = async () => {
      const result = await lookupPublishedMeanings(
        userId,
        entry.content.dutch_lemma,
        true,
        owner.assert,
        true
      )
      updated = result.entries.find(
        item => item.shared_reference?.reference.entry_id === entry_id
      )
      if (!updated)
        throw new Error('This published meaning is no longer available.')
    }
    const journal = createBrowserAnalysisJournal(async operation => {
      const head = await readHead()
      if (
        operation.command.entry_id !== entry_id ||
        head.current_revision_id !== operation.command.expected_revision_id ||
        head.current_head_sequence !== operation.command.expected_head_sequence
      )
        throw new Error(
          'The shared meaning has changed. Analyze the word again to load it.'
        )
    }, `${entry_id}:${revision_id}`)
    const client = createDictionaryAnalysisRemoteClient({
      userId,
      journal,
      enabled: () => true,
      publishedEntryOnly: true,
      remote: {
        rpc: (name, args) => sdk.rpc(name, args),
        getSession: () => sdk.auth.getSession(),
        invoke: (name, options) => sdk.functions.invoke(name, options),
      },
      refresh: async operation => {
        const receipt = operation.response
        const head = await readHead()
        if (
          !receipt ||
          'outcome' in receipt ||
          !receipt.published_head_sequence ||
          (head.current_head_sequence === receipt.published_head_sequence &&
            head.current_revision_id !== receipt.published_revision_id) ||
          BigInt(head.current_head_sequence) <
            BigInt(receipt.published_head_sequence)
        )
          throw new Error('The new dictionary version could not be confirmed.')
        await reload()
        if (
          updated?.shared_reference?.reference.revision_id !==
          head.current_revision_id
        )
          throw new Error(
            'The shared meaning changed again. Analyze the word to see its latest version.'
          )
      },
    })
    const previous = await journal.read(userId, entry_id)
    if (
      previous?.submitted &&
      !isDictionaryAnalysisTerminal(previous.response)
    ) {
      const recovered = await client.retryUnconfirmed(previous, owner)
      return { updated, message: dictionaryAnalysisActionMessage(recovered) }
    }
    if (!(await client.isAvailable(owner)))
      throw new Error(
        'Shared dictionary publishing is currently unavailable. The existing meaning is still available to save.'
      )
    const head = await readHead()
    if (head.current_revision_id !== revision_id) {
      await reload()
      return {
        updated,
        message:
          'Another update was already published. Showing the latest shared meaning.',
      }
    }
    const preparation = await sdk.rpc('prepare_published_analysis_v1', {
      p_entry: entry_id,
      p_revision: revision_id,
    })
    await owner.check()
    if (preparation.error)
      throw new Error('Could not prepare the shared meaning for analysis.')
    if (preparation.data === 'head-conflict') {
      await reload()
      return {
        updated,
        message: 'The shared meaning changed. Showing the current version.',
      }
    }
    if (preparation.data !== 'ready')
      throw new Error(
        'A reviewed definition and example are needed before refreshing this meaning.'
      )
    const candidate = {
      user_id: userId,
      word_id: entry_id,
      submitted: false,
      response: null,
      command: {
        protocol_version: 2 as const,
        operation_id: crypto.randomUUID(),
        entry_id,
        expected_revision_id: revision_id,
        expected_head_sequence: head.current_head_sequence,
      },
    }
    const result = previous?.submitted
      ? await client.nextAttempt(previous, candidate, owner)
      : await client.submit(candidate, owner)
    return { updated, message: dictionaryAnalysisActionMessage(result) }
  })
}
