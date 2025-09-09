import { StyleSheet } from 'react-native'

const COLORS = {
  WHITE: '#ffffff',
  GRAY_600: '#6b7280',
  GRAY_700: '#374151',
  GRAY_800: '#1f2937',
  BLUE_600: '#3b82f6',
  RED_600: '#dc2626',
  GREEN_600: '#16a34a',
} as const

const LAYOUT = {
  SPACE_BETWEEN: 'space-between',
} as const

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  reviewSection: {
    marginBottom: 20,
  },
  collectionsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  collectionCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: LAYOUT.SPACE_BETWEEN,
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  collectionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  collectionStats: {
    flexDirection: 'row',
    justifyContent: LAYOUT.SPACE_BETWEEN,
  },
  statText: {
    fontSize: 14,
    color: '#4b5563',
  },
  dueText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  masteredText: {
    color: '#16a34a',
    fontWeight: '500',
  },
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: LAYOUT.SPACE_BETWEEN,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
})
