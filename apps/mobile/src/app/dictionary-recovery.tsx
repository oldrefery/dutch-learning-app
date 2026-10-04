import { FlatList } from 'react-native'
import { Stack } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { DictionaryImportConflictResolver } from '@/components/DictionaryImportConflictResolver'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { formatWordForCopying } from '@/utils/wordTextFormatter'
import { importRecoveryStyles } from '@/styles/DictionaryImportRecovery.styles'

export default function DictionaryRecoveryScreen() {
  const owner = useApplicationStore(state => state.currentUserId)
  const words = useApplicationStore(state => state.words)
  const enabled = isDictionaryContentEnabled() && owner
  const saved = enabled
    ? words.filter(
        word =>
          word.user_id === owner &&
          (word.dictionary_import_recovery || word.dictionary_import_conflict)
      )
    : []
  return (
    <ViewThemed style={importRecoveryStyles.screen}>
      <Stack.Screen options={{ title: 'Saved imports', headerShown: true }} />
      <FlatList
        contentContainerStyle={importRecoveryStyles.content}
        data={saved}
        keyExtractor={word => `${word.user_id}:${word.word_id}`}
        ListEmptyComponent={
          <TextThemed>
            {enabled
              ? 'No saved imports need recovery.'
              : 'Sign in with dictionary imports enabled to continue.'}
          </TextThemed>
        }
        renderItem={({ item }) => (
          <ViewThemed style={importRecoveryStyles.card}>
            <TextThemed selectable>{formatWordForCopying(item)}</TextThemed>
            <DictionaryImportConflictResolver word={item} />
          </ViewThemed>
        )}
      />
    </ViewThemed>
  )
}
