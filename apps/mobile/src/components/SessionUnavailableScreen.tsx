import { StyleSheet, TouchableOpacity } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

export function SessionUnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <ViewThemed style={styles.container} testID="session-unavailable">
      <TextThemed style={styles.title}>Unable to check your session</TextThemed>
      <TextThemed style={styles.message}>
        Check your connection and try again. Your saved session has not been
        cleared.
      </TextThemed>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onRetry}
        style={styles.button}
        testID="retry-session-button"
      >
        <TextThemed>Try again</TextThemed>
      </TouchableOpacity>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  message: { textAlign: 'center' },
  button: {
    minHeight: 48,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary.DEFAULT,
  },
})
