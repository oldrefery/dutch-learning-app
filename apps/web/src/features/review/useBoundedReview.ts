'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toLocalDateKey } from '@woordenaar/domain'
import type { ReviewScope, ReviewWorkspaceData } from './types'

export interface BoundedReviewPayload {
  dateKey: string
  dueCount: number
  workspace: ReviewWorkspaceData
}

type Result = {
  request: { url: string; day: string }
  payload: BoundedReviewPayload | null
}

export function useBoundedReview(
  enabled: boolean,
  scope: ReviewScope,
  collectionId: string | null,
  day: string
) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [collections, setCollections] =
    useState<ReviewWorkspaceData['collections']>()
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const selectedCollection = scope === 'collection-due' ? collectionId : null
  const request = useMemo(() => {
    if (!enabled) return null
    const query = new URLSearchParams({ scope, day })
    if (selectedCollection) query.set('collectionId', selectedCollection)
    return { url: '/api/review/bounded?' + query.toString(), day, revision }
  }, [enabled, scope, selectedCollection, day, revision])

  useEffect(() => {
    // The calendar provider corrects the initial server fallback after hydration.
    if (!request || request.day !== toLocalDateKey(new Date())) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(request.url, { signal: controller.signal })
        if (!response.ok) throw new Error('Review request failed')
        const payload: BoundedReviewPayload = await response.json()
        if (payload.dateKey !== request.day)
          throw new Error('Review day changed')
        if (controller.signal.aborted) return
        setCollections(payload.workspace.collections)
        setResult({ request, payload })
      } catch {
        if (!controller.signal.aborted) setResult({ request, payload: null })
      }
    })()
    return () => controller.abort()
  }, [request])

  // A–B–A creates a new request even when the last URL equals the first one.
  const current = result?.request === request ? result : null
  return {
    collections,
    payload: current?.payload ?? null,
    failed: current?.payload === null,
    loading: enabled && !current,
    refresh,
  }
}
