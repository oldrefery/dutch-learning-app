'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DictionaryCollectionExportV2 } from '@woordenaar/domain'
import { Button } from '@/components/ui/Button'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'
import { formatWordTranslations } from './format-word-translations'
import { refreshPublishedMeaning } from './refresh-published-meaning'

type Entry = DictionaryCollectionExportV2['entries'][number]

export function CollectionSharedAnalysis({
  userId,
  lemma,
  article,
  partOfSpeech,
  entryId,
}: {
  userId: string
  lemma: string
  article: string | null
  partOfSpeech: string | null
  entryId?: string
}) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Entry[]>([])
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function refresh() {
    if (busy) return
    setBusy(true)
    setStatus('')
    setError('')
    try {
      const document = await lookupPublishedMeanings(
        userId,
        lemma,
        true,
        () => {},
        true
      )
      const matches = document.entries.filter(
        ({ shared_reference, content }) =>
          shared_reference &&
          (entryId
            ? shared_reference.reference.entry_id === entryId
            : (!article || content.article === article) &&
              (!partOfSpeech || content.part_of_speech === partOfSpeech))
      )
      if (!matches.length) {
        setCandidates([])
        setChosen('')
        setStatus(
          'No matching published meaning was found in the shared dictionary.'
        )
        return
      }
      const entry =
        matches.length === 1
          ? matches[0]
          : matches.find(
              item => item.shared_reference?.reference.entry_id === chosen
            )
      if (!entry) {
        setChosen('')
        setCandidates(matches)
        return
      }

      const result = await refreshPublishedMeaning(userId, entry)
      setStatus(result.message ?? 'Check the shared analysis status again.')
      if (result.updated) router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not refresh the shared meaning.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Shared analysis"
      className="dw-surface grid justify-items-start gap-3 p-5"
    >
      <p className="dw-support">
        Updates the published dictionary meaning for everyone.
      </p>
      {candidates.length > 1 && (
        <label className="grid gap-1">
          Choose a meaning
          <select
            className="dw-field"
            disabled={busy}
            value={chosen}
            onChange={event => setChosen(event.target.value)}
          >
            <option value="" disabled>
              Select a shared meaning
            </option>
            {candidates.map(({ content, shared_reference }) => {
              const id = shared_reference!.reference.entry_id
              return (
                <option key={id} value={id}>
                  {content.article} {content.dutch_lemma} ·{' '}
                  {formatWordTranslations(content.translations)}
                </option>
              )
            })}
          </select>
        </label>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={busy || (candidates.length > 1 && !chosen)}
        onClick={() => void refresh()}
      >
        {busy ? 'Refreshing…' : 'Refresh shared analysis'}
      </Button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
