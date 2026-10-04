import { Button } from 'react-native'
import { router, type Href } from 'expo-router'
import { ROUTES } from '@/constants/Routes'
import { Colors } from '@/constants/Colors'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { useApplicationStore } from '@/stores/useApplicationStore'

export function DictionaryImportRecoveryLink() {
  const owner = useApplicationStore(state => state.currentUserId)
  const words = useApplicationStore(state => state.words)
  const theme = useNormalizedColorScheme()
  const count = words.filter(
    word =>
      word.user_id === owner &&
      (word.dictionary_import_recovery || word.dictionary_import_conflict)
  ).length
  if (!isDictionaryContentEnabled() || !owner || !count) return null
  return (
    <Button
      title={`Saved imports (${count})`}
      color={Colors[theme].tint}
      onPress={() => router.push(ROUTES.DICTIONARY_RECOVERY as Href)}
    />
  )
}
