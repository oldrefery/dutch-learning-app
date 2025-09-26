import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

export const wordInputStyles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
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
