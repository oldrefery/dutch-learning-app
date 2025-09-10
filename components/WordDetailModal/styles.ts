import { StyleSheet, Dimensions } from 'react-native'
import { Colors } from '@/constants/Colors'

const { height: screenHeight } = Dimensions.get('window')

export const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: screenHeight * 0.8, // 80% of screen
    minHeight: screenHeight * 0.7,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: Colors.neutral[300],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginRight: 8,
  },
  articleText: {
    fontSize: 18,
    color: Colors.neutral[600],
    fontStyle: 'italic',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    borderRadius: 12,
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  translationsContainer: {
    gap: 8,
  },
  translationItem: {
    backgroundColor: Colors.neutral[50],
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary.DEFAULT,
  },
  translationText: {
    fontSize: 16,
    color: Colors.neutral[900],
    lineHeight: 22,
  },
  translationTextRussian: {
    fontSize: 16,
    color: Colors.neutral[600],
    lineHeight: 22,
    fontStyle: 'italic',
  },
  partOfSpeechText: {
    fontSize: 16,
    color: Colors.neutral[600],
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  examplesContainer: {
    gap: 12,
  },
  exampleItem: {
    backgroundColor: Colors.neutral[50],
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary.DEFAULT,
  },
  exampleDutch: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  exampleEnglish: {
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 20,
  },
  exampleRussian: {
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 20,
    fontStyle: 'italic',
    marginTop: 4,
  },
  progressContainer: {
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[900],
  },
  noExamplesText: {
    fontSize: 14,
    color: Colors.neutral[600],
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reviewBadge: {
    backgroundColor: Colors.warning.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.warning.DEFAULT,
  },
})
