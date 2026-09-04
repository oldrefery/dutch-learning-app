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
  inputWithButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 12,
    minHeight: 44, // HIG minimum tap target
    backgroundColor: 'transparent',
  },
  analyzeButtonContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
