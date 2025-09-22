import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

export const addWordScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.legacy.transparent, // Will inherit from navigation theme
  },
  analysisContainer: {
    flex: 1,
    backgroundColor: Colors.legacy.transparent,
  },
  wordCardContainer: {
    flex: 1,
    backgroundColor: Colors.legacy.transparent,
  },
  addToCollectionContainer: {
    backgroundColor: Colors.legacy.transparent,
    paddingTop: 8,
    // No flex - takes only the space it needs
  },
  universalWordCard: {
    flex: 1,
  },
})
