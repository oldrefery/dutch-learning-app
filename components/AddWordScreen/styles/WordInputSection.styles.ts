import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

export const wordInputStyles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: Colors.background.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral[500],
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
    paddingVertical: 12,
  },
  analyzeButton: {
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: Colors.neutral[400],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral[500],
  },
})
