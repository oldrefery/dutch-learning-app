import { StyleSheet } from 'react-native'
import { Colors } from '@/constants/Colors'

export const analysisResultStyles = StyleSheet.create({
  resultContainer: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  resultCard: {
    backgroundColor: Colors.background.primary,
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: Colors.legacy.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.neutral[900],
  },
  checkingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  checkingText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.neutral[500],
  },
  alreadyExistsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  alreadyExistsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success.DEFAULT,
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  resultSection: {
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[700],
    width: 80,
    marginRight: 12,
  },
  resultValue: {
    fontSize: 14,
    color: Colors.neutral[800],
    flex: 1,
  },
  wordWithPronunciation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  pronunciationButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: Colors.neutral[100],
  },
  translationText: {
    fontSize: 14,
    color: Colors.neutral[800],
    marginLeft: 16,
    marginBottom: 4,
  },
  exampleCard: {
    backgroundColor: Colors.neutral[50],
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 16,
  },
  exampleDutch: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[800],
    marginBottom: 4,
  },
  exampleTranslation: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginBottom: 2,
  },
  associationImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginLeft: 16,
    marginTop: 8,
  },
  prefixText: {
    fontWeight: 'bold',
    color: Colors.error.DEFAULT, // Red color to highlight the separable prefix
  },
  imageContainer: {
    marginLeft: 16,
    marginTop: 8,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeImageText: {
    marginLeft: 6,
    fontSize: 14,
    color: Colors.primary.DEFAULT,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
