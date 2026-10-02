import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  dictionaryImportRecovery,
  type ImportRecoverySnapshot,
} from '@/services/dictionaryImportRecovery'
import { getImportErrorMessage } from '@/services/dictionaryImportErrors'
import { syncManager } from '@/services/syncManager'
import type { Word } from '@/types/database'

export function useDictionaryImportRecovery(word: Word) {
  const [snapshot, setSnapshot] = useState<ImportRecoverySnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [invalidated, setInvalidated] = useState(false)
  const active = useRef(true)
  const inFlight = useRef(false)
  useEffect(() => {
    active.current = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === word.user_id) return
      active.current = false
      setSnapshot(null)
      setInvalidated(true)
    })
    return () => {
      active.current = false
      subscription.unsubscribe()
    }
  }, [word.user_id])
  const isCurrent = () =>
    active.current &&
    useApplicationStore.getState().currentUserId === word.user_id &&
    useApplicationStore
      .getState()
      .words.some(
        candidate =>
          candidate.word_id === word.word_id &&
          candidate.user_id === word.user_id
      )
  const assertCurrent = () => {
    if (!isCurrent())
      throw new Error('Saved import view changed. Reopen it to continue.')
  }
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || !isCurrent()) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (failure) {
      if (isCurrent()) {
        setSnapshot(null)
        setError(getImportErrorMessage(failure))
      }
    } finally {
      inFlight.current = false
      if (isCurrent()) setBusy(false)
    }
  }
  const read = () =>
    run(async () => {
      const current = await dictionaryImportRecovery.readCurrent(
        word.user_id,
        word.word_id
      )
      assertCurrent()
      setSnapshot(current)
    })
  const recover = (targetId: string) =>
    run(async () => {
      if (!snapshot) return
      await dictionaryImportRecovery.prepare(snapshot, targetId, assertCurrent)
      assertCurrent()
      setSnapshot(null)
      setNotice('Recovery saved on this device. Waiting for sync.')
      await useApplicationStore.getState().fetchWords()
      assertCurrent()
      const result = await syncManager.performSync(word.user_id)
      assertCurrent()
      if (result.userId && result.userId !== word.user_id) return
      await useApplicationStore.getState().fetchWords()
      assertCurrent()
      if (!result.success)
        setError(
          result.error ?? 'Recovery remains saved. Sync again when online.'
        )
    })
  return { snapshot, busy, error, notice, invalidated, read, recover }
}
