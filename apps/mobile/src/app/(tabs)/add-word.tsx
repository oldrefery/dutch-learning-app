import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { AddWordScreen } from '@/components/AddWordScreen'

export default function AddWordScreenPage() {
  const { collectionId, batchItemId, initialWord, translationHint } =
    useLocalSearchParams<{
      collectionId?: string
      batchItemId?: string
      initialWord?: string
      translationHint?: string
    }>()

  return (
    <AddWordScreen
      preselectedCollectionId={collectionId}
      batchItemId={batchItemId}
      initialWord={initialWord}
      translationHint={translationHint}
    />
  )
}
