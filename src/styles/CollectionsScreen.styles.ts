import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

const COLORS = {
  WHITE: Colors.background.primary,
  GRAY_600: Colors.neutral[500],
  GRAY_700: Colors.neutral[700],
  GRAY_800: Colors.neutral[800],
  BLUE_600: Colors.primary.DEFAULT,
  RED_600: Colors.error.DEFAULT,
  GREEN_600: Colors.success.DEFAULT,
} as const

const LAYOUT = {
  SPACE_BETWEEN: 'space-between',
} as const

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  collectionsSection: {
    flex: 1,
  },
  collectionsListContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: Colors.transparent.clear,
  },
  collectionsListBlur: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
  },
  collectionsListContent: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
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
    color: Colors.neutral[500],
  },
  collectionStats: {
    flexDirection: 'row',
    justifyContent: LAYOUT.SPACE_BETWEEN,
  },
  statText: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  dueText: {
    color: Colors.error.DEFAULT,
    fontWeight: '500',
  },
  masteredText: {
    color: Colors.success.DEFAULT,
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
    color: Colors.error.DEFAULT,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary.DEFAULT,
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
    color: Colors.neutral[500],
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
    color: Colors.neutral[700],
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.neutral[500],
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
    backgroundColor: Colors.primary.DEFAULT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // Separator for list items
  separator: {
    height: 1,
    marginLeft: 16,
  },
})
