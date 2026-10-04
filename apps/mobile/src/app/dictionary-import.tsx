import { useState } from 'react'
import { Stack, router } from 'expo-router'
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { TextThemed, ViewThemed, useThemeColor } from '@/components/Themed'
import { ImportScreenContent } from '@/components/ImportScreenContent'
import { ImportHeaderButton } from '@/components/ImportHeaderButton'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useDictionaryDocumentImport } from '@/hooks/useDictionaryDocumentImport'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { MAX_DICTIONARY_TRANSFER_TEXT_LENGTH } from '@/services/dictionaryTransferService'
import { ROUTES } from '@/constants/Routes'

export default function DictionaryDocumentImportScreen() {
  const owner = useApplicationStore(state => state.currentUserId)
  if (!isDictionaryContentEnabled() || !owner)
    return (
      <ViewThemed style={styles.container}>
        <Stack.Screen options={{ title: 'Import JSON', headerShown: true }} />
        <TextThemed>
          Sign in with dictionary transfer enabled to import a document.
        </TextThemed>
      </ViewThemed>
    )
  return <OwnedDocumentImport key={owner} owner={owner} />
}

function OwnedDocumentImport({ owner }: { owner: string }) {
  const state = useDictionaryDocumentImport(owner)
  const [hideDuplicates, setHideDuplicates] = useState(true)
  const textColor = useThemeColor({}, 'text')
  const borderColor = useThemeColor({}, 'border')
  const error = state.error && (
    <TextThemed accessibilityRole="alert" style={styles.notice}>
      {state.error}
    </TextThemed>
  )
  return (
    <ViewThemed style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Import JSON',
          headerShown: true,
          headerRight: () =>
            state.preview && !state.success ? (
              <ImportHeaderButton
                importing={state.busy}
                selectedCount={state.selectedCount}
                onPress={state.importSelected}
              />
            ) : null,
        }}
      />
      {state.success ? (
        <ViewThemed style={styles.form}>
          <TextThemed>
            {state.success.importedCount}{' '}
            {state.success.importedCount === 1 ? 'word' : 'words'} saved.{' '}
            {state.success.skippedCount} duplicates skipped.
          </TextThemed>
          {error}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.button}
            onPress={() =>
              router.replace(ROUTES.COLLECTION_DETAIL(state.target!))
            }
          >
            <TextThemed>Open collection</TextThemed>
          </TouchableOpacity>
        </ViewThemed>
      ) : state.preview ? (
        <ImportScreenContent
          virtualizeWords
          sharedData={state.preview}
          wordSelections={
            hideDuplicates
              ? state.selections.filter(item => !item.isDuplicate)
              : state.selections
          }
          collections={state.collections}
          targetCollectionId={state.target}
          selectedCount={state.selectedCount}
          duplicateCount={state.duplicateCount}
          allAvailableSelected={state.allSelected}
          hideDuplicates={hideDuplicates}
          contentBeforeTarget={
            <>
              <TextThemed style={styles.notice}>
                Only word content is copied. Existing words and learning
                progress stay unchanged.
              </TextThemed>
              {error}
            </>
          }
          onSelectCollection={state.setTarget}
          onToggleSelectAll={state.toggleAll}
          onToggleWord={state.toggleWord}
          onToggleHideDuplicates={() =>
            setHideDuplicates(previous => !previous)
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <TextThemed>
            Paste a full collection JSON export. Choose words and a collection
            on the next screen.
          </TextThemed>
          <TextInput
            accessibilityLabel="Collection JSON"
            value={state.text}
            onChangeText={state.setText}
            style={[styles.input, { color: textColor, borderColor }]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            editable={!state.busy}
            maxLength={MAX_DICTIONARY_TRANSFER_TEXT_LENGTH + 1}
            textAlignVertical="top"
          />
          {error}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Preview document"
            disabled={state.busy || !state.text.trim()}
            style={styles.button}
            onPress={state.prepare}
          >
            <TextThemed>
              {state.busy ? 'Loading...' : 'Preview words'}
            </TextThemed>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 20, gap: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 200,
    maxHeight: 320,
    padding: 12,
    fontSize: 14,
  },
  button: { padding: 16, alignItems: 'center' },
  notice: { padding: 16 },
})
