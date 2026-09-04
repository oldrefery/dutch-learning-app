'use client'

import { useEffect } from 'react'
import { markAnalysisHistorySaved } from './analysis-history'

export function MarkAnalysisSaved({
  collectionName,
  dutchLemma,
  userId,
}: {
  collectionName: string
  dutchLemma: string
  userId: string
}) {
  useEffect(() => {
    markAnalysisHistorySaved(userId, dutchLemma, collectionName)
  }, [collectionName, dutchLemma, userId])

  return null
}
