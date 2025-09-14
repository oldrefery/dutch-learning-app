import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

export const addToCollectionStyles = StyleSheet.create({
  addToCollectionSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  addToCollectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  collectionSelectorContainer: {
    marginBottom: 20,
  },
  collectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: Colors.primary.DEFAULT,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonDisabled: {
    backgroundColor: Colors.neutral[400],
  },
  addButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral[300],
  },
  cancelButtonText: {
    color: Colors.neutral[500],
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonTextDisabled: {
    color: Colors.neutral[400],
  },
})
