import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { AddWordScreen } from '@/components/AddWordScreen'

export default function AddWordScreenPage() {
  const { collectionId } = useLocalSearchParams<{ collectionId?: string }>()

  return <AddWordScreen preselectedCollectionId={collectionId} />
}
