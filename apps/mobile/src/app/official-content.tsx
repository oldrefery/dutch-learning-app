import { Stack } from 'expo-router'
import { OfficialContentCatalogScreen } from '@/components/OfficialContentCatalogScreen'

export default function OfficialContentScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Official Packs' }} />
      <OfficialContentCatalogScreen />
    </>
  )
}
